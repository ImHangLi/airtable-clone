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

export const dataRouter = createTRPCRouter({
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

        // Add filter conditions with proper OR/AND logic support
        if (filtering && filtering.length > 0) {
          // Sort filters by order for consistent application
          const sortedFilters = [...filtering].sort(
            (a, b) => a.order - b.order,
          );

          // Separate positive and negative filters for optimization
          const positiveFilters: typeof sortedFilters = [];
          const negativeFilters: typeof sortedFilters = [];

          for (const filter of sortedFilters) {
            const column = columnMap.get(filter.columnId);
            if (!column) continue;

            // Classify filters as positive (EXISTS) or negative (NOT EXISTS)
            const isNegative = [
              "not_equals",
              "not_contains",
              "is_empty",
            ].includes(filter.operator);

            if (isNegative) {
              negativeFilters.push(filter);
            } else {
              positiveFilters.push(filter);
            }
          }

          // Handle positive filters with optimized approach that supports OR logic
          if (positiveFilters.length > 0) {
            // Build filter conditions for the optimized approach
            const filterConditions: SQL[] = [];

            for (const filter of positiveFilters) {
              const column = columnMap.get(filter.columnId);
              if (!column) continue;

              const { operator, value } = filter;
              const isNumberColumn = column.type === "number";

              let condition: SQL | null = null;

              switch (operator) {
                case "is_not_empty":
                  condition = sql`(
                    c.column_id = ${filter.columnId} AND (
                      ${isNumberColumn ? sql`c.value_number IS NOT NULL` : sql`c.value_text IS NOT NULL AND c.value_text != ''`}
                    )
                  )`;
                  break;

                case "equals":
                  if (isNumberColumn) {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                      condition = sql`(c.column_id = ${filter.columnId} AND c.value_number = ${numValue})`;
                    }
                  } else {
                    condition = sql`(c.column_id = ${filter.columnId} AND c.value_text = ${value})`;
                  }
                  break;

                case "contains":
                  if (!isNumberColumn) {
                    const pattern = `%${value}%`;
                    condition = sql`(c.column_id = ${filter.columnId} AND c.value_text ILIKE ${pattern})`;
                  }
                  break;

                case "greater_than":
                  if (isNumberColumn) {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                      condition = sql`(c.column_id = ${filter.columnId} AND c.value_number > ${numValue})`;
                    }
                  }
                  break;

                case "less_than":
                  if (isNumberColumn) {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                      condition = sql`(c.column_id = ${filter.columnId} AND c.value_number < ${numValue})`;
                    }
                  }
                  break;
              }

              if (condition) {
                filterConditions.push(condition);
              }
            }

            // Use optimized EXISTS with proper OR/AND logic
            if (filterConditions.length > 0) {
              // Build the combined condition with proper logical operators
              const combinedCondition = filterConditions.reduce(
                (acc, condition, index) => {
                  if (index === 0) return condition;

                  // Use the logical operator from the current filter
                  const currentFilter = positiveFilters[index];
                  const logicalOp =
                    currentFilter?.logicalOperator?.toLowerCase() ?? "and";

                  if (logicalOp === "or") {
                    return sql`${acc} OR ${condition}`;
                  } else {
                    return sql`${acc} OR ${condition}`; // For aggregation approach, we use OR and count
                  }
                },
              );

              // Determine if we need AND logic (all filters must match) or OR logic (any filter can match)
              const hasOrLogic = positiveFilters.some(
                (f) => f.logicalOperator === "or",
              );

              if (hasOrLogic || positiveFilters.length === 1) {
                // Simple EXISTS with OR conditions
                baseConditions.push(sql`EXISTS (
                  SELECT 1 FROM ${cells} c
                  WHERE c.row_id = ${rows.id}
                  AND (${combinedCondition})
                )`);
              } else {
                // For AND logic, use aggregation to ensure all filters match
                const requiredMatches = positiveFilters.length;
                baseConditions.push(sql`${requiredMatches} = (
                  SELECT COUNT(DISTINCT c.column_id)
                  FROM ${cells} c
                  WHERE c.row_id = ${rows.id}
                  AND (${combinedCondition})
                )`);
              }
            }
          }

          // Handle negative filters with individual EXISTS (these are harder to optimize)
          for (const filter of negativeFilters) {
            const column = columnMap.get(filter.columnId);
            if (!column) continue;

            const { operator, value } = filter;
            const isNumberColumn = column.type === "number";

            let filterCondition: SQL | null = null;

            switch (operator) {
              case "is_empty":
                filterCondition = sql`NOT EXISTS (
                  SELECT 1 FROM ${cells} c
                  WHERE c.row_id = ${rows.id}
                  AND c.column_id = ${filter.columnId}
                  AND (
                    ${isNumberColumn ? sql`c.value_number IS NOT NULL` : sql`c.value_text IS NOT NULL AND c.value_text != ''`}
                  )
                )`;
                break;

              case "not_equals":
                if (isNumberColumn) {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                    filterCondition = sql`NOT EXISTS (
                      SELECT 1 FROM ${cells} c
                      WHERE c.row_id = ${rows.id}
                      AND c.column_id = ${filter.columnId}
                      AND c.value_number = ${numValue}
                    )`;
                  }
                } else {
                  filterCondition = sql`NOT EXISTS (
                    SELECT 1 FROM ${cells} c
                    WHERE c.row_id = ${rows.id}
                    AND c.column_id = ${filter.columnId}
                    AND c.value_text = ${value}
                  )`;
                }
                break;

              case "not_contains":
                if (!isNumberColumn) {
                  const pattern = `%${value}%`;
                  filterCondition = sql`NOT EXISTS (
                    SELECT 1 FROM ${cells} c
                    WHERE c.row_id = ${rows.id}
                    AND c.column_id = ${filter.columnId}
                    AND c.value_text ILIKE ${pattern}
                  )`;
                }
                break;
            }

            if (filterCondition) {
              baseConditions.push(filterCondition);
            }
          }
        }

        // Build optimized sort clauses using CTEs for better performance
        const sortClauses = [];
        if (sorting && sorting.length > 0) {
          for (const sortConfig of sorting) {
            const column = columnMap.get(sortConfig.id);
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
            .where(and(...baseConditions))
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
