import { eq, asc, desc, inArray, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { tables, columns, rows, cells } from "~/server/db/schema";

const sortConfigSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

const unifiedTableDataSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  limit: z.number().min(1).max(200).default(100),
  cursor: z.number().nullish(), // Use cursor for tRPC infinite query compatibility
  sorting: z.array(sortConfigSchema).optional(),
  search: z.string().max(100).optional(),
});

export const dataRouter = createTRPCRouter({
  // Infinite query endpoint for table data
  getInfiniteTableData: protectedProcedure
    .input(unifiedTableDataSchema)
    .query(async ({ ctx, input }) => {
      try {
        const { tableId, limit, cursor, sorting, search } = input;

        // Use cursor as offset (cursor is the offset for next page)
        const offset = cursor ?? 0;

        // Normalize search term
        const searchTerm = search?.trim();
        const hasSearch = Boolean(searchTerm);

        // Get table info and columns in parallel
        const [tableInfoResult, tableColumns] = await Promise.all([
          ctx.db
            .select({
              id: tables.id,
              name: tables.name,
              base_id: tables.base_id,
            })
            .from(tables)
            .where(eq(tables.id, tableId))
            .limit(1),
          ctx.db
            .select()
            .from(columns)
            .where(eq(columns.table_id, tableId))
            .orderBy(asc(columns.position)),
        ]);

        const tableInfo = tableInfoResult[0];
        if (!tableInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Table not found",
          });
        }

        // Build sort clauses with proper NULL handling
        const sortClauses = [];
        if (sorting && sorting.length > 0) {
          for (const sortConfig of sorting) {
            const column = tableColumns.find((col) => col.id === sortConfig.id);
            if (!column) continue;

            if (column.type === "number") {
              const subquery = sql`(
                SELECT COALESCE(c.value_number, 0)
                FROM ${cells} c 
                WHERE c.row_id = ${rows.id} 
                AND c.column_id = ${sortConfig.id}
                LIMIT 1
              )`;
              sortClauses.push(
                sortConfig.desc ? desc(subquery) : asc(subquery),
              );
            } else {
              const subquery = sql`(
                SELECT COALESCE(c.value_text, '')
                FROM ${cells} c 
                WHERE c.row_id = ${rows.id} 
                AND c.column_id = ${sortConfig.id}
                LIMIT 1
              )`;
              sortClauses.push(
                sortConfig.desc ? desc(subquery) : asc(subquery),
              );
            }
          }
        }
        // Always add created_at and id for consistent pagination
        sortClauses.push(asc(rows.created_at), asc(rows.id));

        // Build base conditions
        const baseConditions = [eq(rows.table_id, tableId)];

        // Add search condition if provided
        if (hasSearch && searchTerm) {
          const searchPattern = `%${searchTerm}%`;
          baseConditions.push(sql`EXISTS (
            SELECT 1 FROM ${cells} c
            WHERE c.row_id = ${rows.id}
            AND (
              c.value_text ILIKE ${searchPattern}
              OR CAST(c.value_number AS TEXT) ILIKE ${searchPattern}
            )
          )`);
        }

        // Execute main query with offset-based pagination
        const tableRows = await ctx.db
          .select({
            id: rows.id,
            base_id: rows.base_id,
            table_id: rows.table_id,
            created_at: rows.created_at,
            updated_at: rows.updated_at,
          })
          .from(rows)
          .where(and(...baseConditions))
          .orderBy(...sortClauses)
          .offset(offset)
          .limit(limit + 1); // +1 to check if there's a next page

        // Check if there's a next page and calculate next offset
        let nextCursor: number | undefined = undefined;
        if (tableRows.length > limit) {
          tableRows.pop(); // Remove the extra row
          nextCursor = offset + limit;
        }

        // Get cells for all rows efficiently
        const rowIds = tableRows.map((row) => row.id);
        let allCells: Array<{
          row_id: string;
          column_id: string;
          value_text: string | null;
          value_number: number | null;
        }> = [];

        if (rowIds.length > 0) {
          allCells = await ctx.db
            .select({
              row_id: cells.row_id,
              column_id: cells.column_id,
              value_text: cells.value_text,
              value_number: cells.value_number,
            })
            .from(cells)
            .where(inArray(cells.row_id, rowIds));
        }

        // Build cells map efficiently
        const cellsByRowId = new Map<string, Record<string, string | number>>();
        rowIds.forEach((rowId) => {
          cellsByRowId.set(rowId, {});
        });
        allCells.forEach((cell) => {
          const existingCells = cellsByRowId.get(cell.row_id) ?? {};
          existingCells[cell.column_id] =
            cell.value_text ?? cell.value_number ?? "";
          cellsByRowId.set(cell.row_id, existingCells);
        });

        // Format rows with cells
        const rowsWithCells = tableRows.map((row) => ({
          id: row.id,
          cells: cellsByRowId.get(row.id) ?? {},
        }));

        // Get total row count efficiently
        let totalRowCount: number;
        if (hasSearch && searchTerm) {
          const searchCountResult = await ctx.db
            .select({ count: sql<number>`count(*)` })
            .from(rows)
            .where(and(...baseConditions));
          totalRowCount = Number(searchCountResult[0]?.count ?? 0);
        } else {
          const totalCountResult = await ctx.db
            .select({ count: sql<number>`count(*)` })
            .from(rows)
            .where(eq(rows.table_id, tableId));
          totalRowCount = Number(totalCountResult[0]?.count ?? 0);
        }

        return {
          tableInfo: {
            name: tableInfo.name,
            columns: tableColumns,
          },
          items: rowsWithCells,
          nextCursor, // Return as number for tRPC infinite query
          totalRowCount,
          isSearchResult: hasSearch,
        };
      } catch (error) {
        console.error("Error getting infinite table data:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get table data",
        });
      }
    }),
});
