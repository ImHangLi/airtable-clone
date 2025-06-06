import { eq, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { columns, rows, cells } from "~/server/db/schema";
import { randomUUID } from "crypto";
import { faker } from "@faker-js/faker";
import { z } from "zod";
import { getCellValue } from "./cell";

// Row-related schemas
export const createRowSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  baseId: z.string().uuid("Invalid base ID"),
});

export const createRowWithCellValuesSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  cellValues: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .and(z.object({ baseId: z.string().uuid("Invalid base ID") })),
});

export const deleteRowSchema = z.object({
  rowId: z.string().uuid("Invalid row ID"),
});

export const addManyRowsSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  baseId: z.string().uuid("Invalid base ID"),
});

export const rowRouter = createTRPCRouter({
  // Create a new row with empty string cells
  createRow: protectedProcedure
    .input(createRowSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      try {
        const newRowId = randomUUID();

        await ctx.db.insert(rows).values({
          id: newRowId,
          table_id: input.tableId,
          base_id: input.baseId,
        });

        const tableColumns = await ctx.db
          .select()
          .from(columns)
          .where(eq(columns.table_id, input.tableId))
          .orderBy(asc(columns.position));

        const cellsToInsert = tableColumns.map((column) => ({
          row_id: newRowId,
          column_id: column.id,
          base_id: input.baseId,
          value_text: null,
          value_number: null,
        }));

        await ctx.db.insert(cells).values(cellsToInsert);

        return { id: newRowId };
      } catch (error) {
        console.error("Error creating row:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create row",
        });
      }
    }),

  // Create row with cell values
  createRowWithCellValues: protectedProcedure
    .input(createRowWithCellValuesSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      try {
        const { tableId, cellValues } = input;
        const baseId = cellValues.baseId;

        // Get all column types in a single query
        const columnTypes = await ctx.db
          .select({ id: columns.id, type: columns.type })
          .from(columns)
          .where(eq(columns.table_id, tableId));

        // Create a map of column IDs to their types for O(1) lookup
        const columnTypeMap = new Map(
          columnTypes.map((col) => [col.id, col.type]),
        );

        let newRowId: string;

        // Insert row and cells in a transaction for atomicity
        await ctx.db.transaction(async (tx) => {
          // Insert the row
          newRowId = randomUUID();
          await tx.insert(rows).values({
            id: newRowId,
            table_id: tableId,
            base_id: baseId,
          });

          // Batch insert all cells at once
          const formattedCellValues = await Promise.all(
            Object.entries(cellValues).map(async ([columnId, value]) => {
              if (columnId === "baseId") return null; // Skip baseId from cellValues

              const columnType = columnTypeMap.get(columnId);
              if (!columnType) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: `Column ${columnId} not found`,
                });
              }

              const { value_text, value_number } = await getCellValue(
                columnType,
                value,
              );

              return {
                row_id: newRowId,
                column_id: columnId,
                base_id: baseId,
                value_text,
                value_number,
              };
            }),
          );

          // Filter out null values (from baseId)
          const validCellValues = formattedCellValues.filter(
            (cell): cell is NonNullable<typeof cell> => cell !== null,
          );

          if (validCellValues.length > 0) {
            await tx.insert(cells).values(validCellValues);
          }
        });

        return { id: newRowId! }; // Return the new row ID
      } catch (error) {
        console.error("Error creating row with cell values:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create row with cell values",
        });
      }
    }),

  // Delete a row and all its cells
  deleteRow: protectedProcedure
    .input(deleteRowSchema)
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      try {
        // Delete all cells for this row first (cascade should handle this but being explicit)
        await ctx.db.delete(cells).where(eq(cells.row_id, input.rowId));

        // Then delete the row
        await ctx.db.delete(rows).where(eq(rows.id, input.rowId));

        return { success: true };
      } catch (error) {
        console.error("Error deleting row:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete row",
        });
      }
    }),

  // Add 100k rows
  addManyRows: protectedProcedure
    .input(addManyRowsSchema)
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<{ success: boolean; rowsAdded: number }> => {
        try {
          const { tableId, baseId } = input;

          // Get table columns for generating cell data
          const tableColumns = await ctx.db
            .select()
            .from(columns)
            .where(eq(columns.table_id, tableId))
            .orderBy(asc(columns.position));

          if (tableColumns.length === 0) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "No columns found for table",
            });
          }

          const BATCH_SIZE = 500; // Batch size for database operations
          const SYNC_ROWS = 1000; // Number of rows to insert synchronously
          const TOTAL_ROWS = 100000;
          const BATCH_DELAY = 25; // Reduced delay for better performance

          const createBatch = (batchSize: number) => {
            const rowsToInsert = [];
            const cellsToInsert = [];

            for (let i = 0; i < batchSize; i++) {
              const rowId = randomUUID();

              rowsToInsert.push({
                id: rowId,
                table_id: tableId,
                base_id: baseId,
              });

              for (const column of tableColumns) {
                let valueText = null;
                let valueNumber = null;

                if (column.type === "text") {
                  if (column.name.toLowerCase().includes("name")) {
                    valueText = faker.person.fullName();
                  } else if (column.name.toLowerCase().includes("email")) {
                    valueText = faker.internet.email();
                  } else {
                    valueText = faker.lorem.word();
                  }
                } else if (column.type === "number") {
                  valueNumber = faker.number.int({ min: 1, max: 1000 });
                }

                cellsToInsert.push({
                  row_id: rowId,
                  column_id: column.id,
                  base_id: baseId,
                  value_text: valueText,
                  value_number: valueNumber,
                });
              }
            }

            return { rowsToInsert, cellsToInsert };
          };

          // Insert the first 1000 rows synchronously for immediate feedback
          for (
            let syncBatch = 0;
            syncBatch < SYNC_ROWS / BATCH_SIZE;
            syncBatch++
          ) {
            const { rowsToInsert, cellsToInsert } = createBatch(BATCH_SIZE);

            await ctx.db.insert(rows).values(rowsToInsert);
            await ctx.db.insert(cells).values(cellsToInsert);
          }

          // Insert the remaining rows asynchronously
          const backgroundInsertion = async () => {
            const remainingRows = TOTAL_ROWS - SYNC_ROWS;
            const remainingBatches = Math.ceil(remainingRows / BATCH_SIZE);

            for (let batch = 0; batch < remainingBatches; batch++) {
              try {
                const currentBatchSize = Math.min(
                  BATCH_SIZE,
                  remainingRows - batch * BATCH_SIZE,
                );
                const { rowsToInsert, cellsToInsert } =
                  createBatch(currentBatchSize);

                await ctx.db.insert(rows).values(rowsToInsert);
                await ctx.db.insert(cells).values(cellsToInsert);

                // Add a small delay to prevent overwhelming the database
                if (batch < remainingBatches - 1) {
                  await new Promise((resolve) =>
                    setTimeout(resolve, BATCH_DELAY),
                  );
                }
              } catch (batchError) {
                console.error(
                  `Error in background batch ${batch + 1}:`,
                  batchError,
                );
                // Continue with next batch
              }
            }
          };

          // Start background process without awaiting
          backgroundInsertion().catch((error) => {
            console.error("Background insertion failed:", error);
            // Inform the user that the rows were not added
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to add rows",
            });
          });

          // Return immediately after synchronous insertion
          return {
            success: true,
            rowsAdded: SYNC_ROWS,
          };
        } catch (error) {
          console.error("Error adding many rows:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to add rows",
          });
        }
      },
    ),
});
