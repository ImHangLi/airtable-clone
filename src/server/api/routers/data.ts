import { eq, asc, desc, inArray, and, sql, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { tables, columns, rows, cells } from "~/server/db/schema";

const sortConfigSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

const filterConfigSchema = z.object({
  id: z.string(),
  columnId: z.string(),
  operator: z.enum([
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "greater_than",
    "less_than",
    "is_empty",
    "is_not_empty",
  ]),
  value: z.string(),
  order: z.number(),
  logicalOperator: z.enum(["and", "or"]).optional(),
});

const unifiedTableDataSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  limit: z.number().min(1).max(200).default(100),
  cursor: z.number().nullish(), // Use cursor for tRPC infinite query compatibility
  sorting: z.array(sortConfigSchema).optional(),
  filtering: z.array(filterConfigSchema).optional(),
  search: z.string().max(100).optional(),
});

const searchStatsSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  search: z.string().min(1).max(100),
});

// --- Helper types & functions added for clarity ---------------------------------
// Helper aliases to avoid long generic names
type FilterConfig = z.infer<typeof filterConfigSchema>;
type SortConfig = z.infer<typeof sortConfigSchema>;

/**
 * Build an array of SQL expressions (to be AND-combined) from the provided filter list.
 * The logic is identical to the old inline implementation but wrapped in a pure function
 * so that the main resolver reads like a high-level recipe instead of a 200-line monster.
 */
export function buildFilterConditions(
  filtering: FilterConfig[] | undefined,
  columnMap: Map<string, typeof columns.$inferSelect>,
): SQL[] {
  const expressions: SQL[] = [];

  if (!filtering || filtering.length === 0) return expressions;

  // Keep logic parity with the previous implementation
  const sorted = [...filtering].sort((a, b) => a.order - b.order);

  const positive: typeof sorted = [];
  const negative: typeof sorted = [];

  for (const f of sorted) {
    const col = columnMap.get(f.columnId);
    if (!col) continue;

    const isNegative = ["not_equals", "not_contains", "is_empty"].includes(
      f.operator,
    );
    (isNegative ? negative : positive).push(f);
  }

  // ----- Positive filters (EXISTS / aggregation trick) -----------------------
  if (positive.length > 0) {
    const subConditions: SQL[] = [];

    for (const f of positive) {
      const column = columnMap.get(f.columnId);
      if (!column) continue;

      const isNumber = column.type === "number";
      const { operator, value } = f;
      let cond: SQL | null = null;

      switch (operator) {
        case "is_not_empty":
          cond = sql`(c.column_id = ${f.columnId} AND (${isNumber ? sql`c.value_number IS NOT NULL` : sql`c.value_text IS NOT NULL AND c.value_text != ''`}))`;
          break;
        case "equals":
          if (isNumber) {
            const num = parseFloat(value);
            if (!isNaN(num))
              cond = sql`(c.column_id = ${f.columnId} AND c.value_number = ${num})`;
          } else {
            cond = sql`(c.column_id = ${f.columnId} AND c.value_text = ${value})`;
          }
          break;
        case "contains":
          if (!isNumber) {
            cond = sql`(c.column_id = ${f.columnId} AND c.value_text ILIKE ${`%${value}%`})`;
          }
          break;
        case "greater_than":
          if (isNumber) {
            const num = parseFloat(value);
            if (!isNaN(num))
              cond = sql`(c.column_id = ${f.columnId} AND c.value_number > ${num})`;
          }
          break;
        case "less_than":
          if (isNumber) {
            const num = parseFloat(value);
            if (!isNaN(num))
              cond = sql`(c.column_id = ${f.columnId} AND c.value_number < ${num})`;
          }
          break;
      }
      if (cond) subConditions.push(cond);
    }

    if (subConditions.length > 0) {
      const combined = subConditions.reduce(
        (acc, curr) => sql`${acc} OR ${curr}`,
      );

      const hasOr = positive.some((p) => p.logicalOperator === "or");
      if (hasOr || positive.length === 1) {
        expressions.push(
          sql`EXISTS (SELECT 1 FROM ${cells} c WHERE c.row_id = ${rows.id} AND (${combined}))`,
        );
      } else {
        expressions.push(
          sql`${positive.length} = (SELECT COUNT(DISTINCT c.column_id) FROM ${cells} c WHERE c.row_id = ${rows.id} AND (${combined}))`,
        );
      }
    }
  }

  // ----- Negative filters (NOT EXISTS) ---------------------------------------
  for (const f of negative) {
    const column = columnMap.get(f.columnId);
    if (!column) continue;
    const isNumber = column.type === "number";
    const { operator, value } = f;
    let cond: SQL | null = null;

    switch (operator) {
      case "is_empty":
        cond = sql`NOT EXISTS (SELECT 1 FROM ${cells} c WHERE c.row_id = ${rows.id} AND c.column_id = ${f.columnId} AND (${isNumber ? sql`c.value_number IS NOT NULL` : sql`c.value_text IS NOT NULL AND c.value_text != ''`}))`;
        break;
      case "not_equals":
        if (isNumber) {
          const num = parseFloat(value);
          if (!isNaN(num))
            cond = sql`NOT EXISTS (SELECT 1 FROM ${cells} c WHERE c.row_id = ${rows.id} AND c.column_id = ${f.columnId} AND c.value_number = ${num})`;
        } else {
          cond = sql`NOT EXISTS (SELECT 1 FROM ${cells} c WHERE c.row_id = ${rows.id} AND c.column_id = ${f.columnId} AND c.value_text = ${value})`;
        }
        break;
      case "not_contains":
        if (!isNumber)
          cond = sql`NOT EXISTS (SELECT 1 FROM ${cells} c WHERE c.row_id = ${rows.id} AND c.column_id = ${f.columnId} AND c.value_text ILIKE ${`%${value}%`})`;
        break;
    }
    if (cond) expressions.push(cond);
  }

  return expressions;
}

/**
 * Build ORDER BY clauses for the provided sort config array.
 */
export function buildSortClauses(
  sorting: SortConfig[] | undefined,
  columnMap: Map<string, typeof columns.$inferSelect>,
): SQL[] {
  const clauses: SQL[] = [];

  if (!sorting || sorting.length === 0) return clauses;

  for (const s of sorting) {
    const column = columnMap.get(s.id);
    if (!column) continue;

    let sub: SQL;
    if (column.type === "number") {
      sub = sql`(
        SELECT COALESCE(c.value_number, 0)
        FROM ${cells} c
        WHERE c.row_id = ${rows.id} AND c.column_id = ${s.id}
        LIMIT 1
      )`;
    } else {
      sub = sql`(
        SELECT COALESCE(c.value_text, '')
        FROM ${cells} c
        WHERE c.row_id = ${rows.id} AND c.column_id = ${s.id}
        LIMIT 1
      )`;
    }
    clauses.push(s.desc ? desc(sub) : asc(sub));
  }

  return clauses;
}
// --- End helper section --------------------------------------------------------

export const dataRouter = createTRPCRouter({
  getSearchStats: protectedProcedure
    .input(searchStatsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const { tableId, search } = input;
        const searchTerm = search.trim();

        if (!searchTerm) {
          return {
            totalMatches: 0,
            uniqueRows: 0,
            uniqueFields: 0,
          };
        }

        // Optimized query using SQL aggregation
        const statsResult = await ctx.db
          .select({
            totalMatches: sql<number>`COUNT(*)`,
            uniqueRows: sql<number>`COUNT(DISTINCT ${cells.row_id})`,
            uniqueFields: sql<number>`COUNT(DISTINCT ${cells.column_id})`,
          })
          .from(cells)
          .innerJoin(rows, eq(cells.row_id, rows.id))
          .innerJoin(tables, eq(rows.table_id, tables.id))
          .where(
            and(
              eq(tables.id, tableId),
              sql`(
                (${cells.value_text} ILIKE ${`%${searchTerm}%`} AND ${cells.value_text} IS NOT NULL AND ${cells.value_text} != '') OR
                (CAST(${cells.value_number} AS TEXT) ILIKE ${`%${searchTerm}%`} AND ${cells.value_number} IS NOT NULL)
              )`,
            ),
          );

        const stats = statsResult[0];

        return {
          totalMatches: Number(stats?.totalMatches ?? 0),
          uniqueRows: Number(stats?.uniqueRows ?? 0),
          uniqueFields: Number(stats?.uniqueFields ?? 0),
        };
      } catch (error) {
        console.error("Error getting search stats:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get search statistics",
        });
      }
    }),

  getInfiniteTableData: protectedProcedure
    .input(unifiedTableDataSchema)
    .query(async ({ ctx, input }) => {
      try {
        const { tableId, limit, cursor, sorting, filtering, search } = input;

        // Use cursor as offset (cursor is the offset for next page)
        const offset = cursor ?? 0;

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

        // Create column lookup map for better performance
        const columnMap = new Map(tableColumns.map((col) => [col.id, col]));

        // Build base conditions
        const baseConditions: SQL[] = [eq(rows.table_id, tableId)];

        // Build filter SQL expressions using helper
        baseConditions.push(...buildFilterConditions(filtering, columnMap));

        // Build sort clauses using helper
        const sortClauses = buildSortClauses(sorting, columnMap);

        // Add default sorting for consistency
        sortClauses.push(asc(rows.created_at), asc(rows.id));

        // Execute main query and total count in parallel for better performance
        const hasFilters = filtering && filtering.length > 0;

        const [tableRows, totalCountResult] = await Promise.all([
          // Main query with optimized pagination
          ctx.db
            .select({
              id: rows.id,
              base_id: rows.base_id,
              table_id: rows.table_id,
              created_at: rows.created_at,
              updated_at: rows.updated_at,
            })
            .from(rows)
            .where(
              and(
                ...baseConditions,
                sql`EXISTS (SELECT 1 FROM ${cells} c WHERE c.row_id = ${rows.id} AND (c.value_text ILIKE ${`%${searchTerm}%`} OR c.value_number = ${parseFloat(searchTerm ?? "")}))`,
              ),
            )
            .orderBy(...sortClauses)
            .offset(offset)
            .limit(limit + 1), // +1 to check if there's a next page

          // Total count query (only when filters are applied)
          hasFilters
            ? ctx.db
                .select({ count: sql<number>`count(*)` })
                .from(rows)
                .where(and(...baseConditions))
            : ctx.db
                .select({ count: sql<number>`count(*)` })
                .from(rows)
                .where(eq(rows.table_id, tableId)),
        ]);

        // Calculate pagination
        let nextCursor: number | undefined = undefined;
        if (tableRows.length > limit) {
          tableRows.pop(); // Remove the extra row
          nextCursor = offset + limit;
        }

        const totalRowCount = Number(totalCountResult[0]?.count ?? 0);

        // Early return if no rows
        if (tableRows.length === 0) {
          return {
            tableInfo: {
              name: tableInfo.name,
              columns: tableColumns,
            },
            items: [],
            searchMatches: [],
            nextCursor,
            totalRowCount,
            isFilterResult: hasFilters,
          };
        }

        const rowIds = tableRows.map((row) => row.id);

        // Get cells and search matches in parallel
        const cellsPromise = ctx.db
          .select({
            row_id: cells.row_id,
            column_id: cells.column_id,
            value_text: cells.value_text,
            value_number: cells.value_number,
          })
          .from(cells)
          .where(inArray(cells.row_id, rowIds));

        const searchMatchesPromise =
          hasSearch && searchTerm
            ? ctx.db
                .select({
                  row_id: cells.row_id,
                  column_id: cells.column_id,
                  value_text: cells.value_text,
                  value_number: cells.value_number,
                })
                .from(cells)
                .where(
                  and(
                    inArray(cells.row_id, rowIds),
                    sql`(
                    (${cells.value_text} ILIKE ${`%${searchTerm}%`} AND ${cells.value_text} IS NOT NULL AND ${cells.value_text} != '') OR
                    (CAST(${cells.value_number} AS TEXT) ILIKE ${`%${searchTerm}%`} AND ${cells.value_number} IS NOT NULL)
                  )`,
                  ),
                )
            : Promise.resolve([]);

        const [allCells, searchResults] = await Promise.all([
          cellsPromise,
          searchMatchesPromise,
        ]);

        // Build cells map efficiently with optimized memory allocation
        const cellsByRowId = new Map<string, Record<string, string | number>>();

        // Initialize with default values using more efficient approach
        for (const rowId of rowIds) {
          const defaultCells: Record<string, string | number> = {};
          for (const column of tableColumns) {
            defaultCells[column.id] = ""; // Default empty string for all cell types
          }
          cellsByRowId.set(rowId, defaultCells);
        }

        // Populate with actual cell values
        for (const cell of allCells) {
          const existingCells = cellsByRowId.get(cell.row_id);
          if (existingCells) {
            existingCells[cell.column_id] =
              cell.value_text ?? cell.value_number ?? "";
          }
        }

        // Process search matches efficiently
        let searchMatches: Array<{
          rowId: string;
          columnId: string;
          cellValue: string;
        }> = [];

        if (hasSearch && searchResults.length > 0) {
          // Create optimized lookup maps
          const rowOrderMap = new Map<string, number>();
          const columnOrderMap = new Map<string, number>();

          rowIds.forEach((rowId, index) => {
            rowOrderMap.set(rowId, index);
          });

          tableColumns.forEach((column, index) => {
            columnOrderMap.set(column.id, index);
          });

          // Sort and format matches efficiently
          searchMatches = searchResults
            .map((match) => ({
              rowId: match.row_id,
              columnId: match.column_id,
              cellValue: match.value_text ?? String(match.value_number),
              rowOrder: rowOrderMap.get(match.row_id) ?? 999999,
              columnOrder: columnOrderMap.get(match.column_id) ?? 999999,
            }))
            .sort((a, b) => {
              // First sort by row (top to bottom)
              if (a.rowOrder !== b.rowOrder) {
                return a.rowOrder - b.rowOrder;
              }
              // Then sort by column (left to right)
              return a.columnOrder - b.columnOrder;
            })
            .map(({ rowId, columnId, cellValue }) => ({
              rowId,
              columnId,
              cellValue,
            }));
        }

        // Format final response efficiently
        const rowsWithCells = tableRows.map((row) => ({
          id: row.id,
          cells: cellsByRowId.get(row.id) ?? {},
        }));

        return {
          tableInfo: {
            name: tableInfo.name,
            columns: tableColumns,
          },
          items: rowsWithCells,
          searchMatches,
          nextCursor,
          totalRowCount,
          isFilterResult: hasFilters,
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
