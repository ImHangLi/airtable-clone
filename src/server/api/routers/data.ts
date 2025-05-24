import { eq, asc, desc, gt, lt, inArray, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { tables, columns, rows, cells } from "~/server/db/schema";

const getInfiniteTableDataSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  limit: z.number().min(1).max(200).default(100),
  cursor: z.string().optional(),
  direction: z.enum(["forward", "backward"]).default("forward"),
});

export const dataRouter = createTRPCRouter({
  // Get paginated table data for virtual scrolling
  getInfiniteTableData: protectedProcedure
    .input(getInfiniteTableDataSchema)
    .query(async ({ ctx, input }) => {
      try {
        const { tableId, limit, cursor, direction } = input;

        // Get table info
        const [tableInfo] = await ctx.db
          .select()
          .from(tables)
          .where(eq(tables.id, tableId))
          .limit(1);

        if (!tableInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Table not found",
          });
        }

        // Get table columns
        const tableColumns = await ctx.db
          .select()
          .from(columns)
          .where(eq(columns.table_id, tableId))
          .orderBy(asc(columns.position));

        // Get paginated rows
        let tableRows;

        if (cursor) {
          // Get cursor row's created_at for comparison
          const [cursorRow] = await ctx.db
            .select({ created_at: rows.created_at })
            .from(rows)
            .where(eq(rows.id, cursor))
            .limit(1);

          if (!cursorRow) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid cursor",
            });
          }

          // Apply cursor-based pagination
          if (direction === "forward") {
            tableRows = await ctx.db
              .select()
              .from(rows)
              .where(
                and(
                  eq(rows.table_id, tableId),
                  gt(rows.created_at, cursorRow.created_at),
                ),
              )
              .orderBy(asc(rows.created_at))
              .limit(limit + 1);
          } else {
            tableRows = await ctx.db
              .select()
              .from(rows)
              .where(
                and(
                  eq(rows.table_id, tableId),
                  lt(rows.created_at, cursorRow.created_at),
                ),
              )
              .orderBy(desc(rows.created_at))
              .limit(limit + 1);
          }
        } else {
          // No cursor, get first page
          tableRows = await ctx.db
            .select()
            .from(rows)
            .where(eq(rows.table_id, tableId))
            .orderBy(
              direction === "forward"
                ? asc(rows.created_at)
                : desc(rows.created_at),
            )
            .limit(limit + 1);
        }

        // Check if there's a next page
        let nextCursor: string | undefined;
        if (tableRows.length > limit) {
          const nextItem = tableRows.pop()!;
          nextCursor = nextItem.id;
        }

        // Get cells for all rows efficiently using IN clause
        const rowIds = tableRows.map((row) => row.id);

        let allCells: (typeof cells.$inferSelect)[] = [];
        if (rowIds.length > 0) {
          allCells = await ctx.db
            .select()
            .from(cells)
            .where(inArray(cells.row_id, rowIds));
        }

        // Build a map of cells by row_id for efficient lookup
        const cellsByRowId = new Map<string, Record<string, string | number>>();

        // Initialize empty cell data for each row
        rowIds.forEach((rowId) => {
          cellsByRowId.set(rowId, {});
        });

        // Populate cells data
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

        // Get total row count for the table
        const totalCountResult = await ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(rows)
          .where(eq(rows.table_id, tableId));

        const totalRowCount = totalCountResult[0]?.count ?? 0;

        return {
          tableInfo: {
            name: tableInfo.name,
            columns: tableColumns,
          },
          rows: rowsWithCells,
          nextCursor,
          totalRowCount: Number(totalRowCount),
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
