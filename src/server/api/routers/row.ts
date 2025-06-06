import { eq, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { columns, rows, cells, type Row, type Cell } from "~/server/db/schema";
import { faker } from "@faker-js/faker";
import { z } from "zod";
import { getCellValue } from "./cell";

// Row-related schemas
export const createRowSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  baseId: z.string().uuid("Invalid base ID"),
  rowId: z.string().uuid("Invalid row ID").optional(),
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
  // Create a new row with empty string cells - OPTIMIZED for speed
  createRow: protectedProcedure
    .input(createRowSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      try {
        // Use client-provided ID if available, otherwise generate one
        const newRowId = input.rowId ?? crypto.randomUUID();

        // PERFORMANCE: Single transaction for row + cells creation
        await ctx.db.transaction(async (tx) => {
          // Get table columns first
          const tableColumns = await tx
            .select({ id: columns.id })
            .from(columns)
            .where(eq(columns.table_id, input.tableId))
            .orderBy(asc(columns.position));

          // Insert row
          await tx.insert(rows).values({
            id: newRowId,
            table_id: input.tableId,
            base_id: input.baseId,
          });

          // Batch insert all cells in the same transaction
          if (tableColumns.length > 0) {
            const cellsToInsert = tableColumns.map((column) => ({
              row_id: newRowId,
              column_id: column.id,
              base_id: input.baseId,
              value_text: null,
              value_number: null,
            }));

            await tx.insert(cells).values(cellsToInsert);
          }
        });

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
          newRowId = crypto.randomUUID();
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

          const BATCH_SIZE = 500; // Smaller batches to reduce DB load
          const PARALLEL_BATCHES = 2; // Fewer parallel batches to avoid overwhelming DB
          const SYNC_ROWS = 500; // BLAZING FAST first batch for instant feedback
          const TOTAL_ROWS = 100000;
          const MAX_RETRIES = 3;
          const RETRY_DELAY_BASE = 1000; // Base delay for exponential backoff

          const createBatch = (batchSize: number, batchId: number) => {
            const rowsToInsert = [];
            const cellsToInsert = [];

            for (let i = 0; i < batchSize; i++) {
              const rowId = crypto.randomUUID();

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

            return { rowsToInsert, cellsToInsert, batchId };
          };

          // Retry function with exponential backoff
          const insertBatchWithRetry = async (
            batchData: {
              rowsToInsert: Row[];
              cellsToInsert: Cell[];
              batchId: number;
            },
            retryCount = 0,
          ): Promise<{ success: boolean; batchId: number }> => {
            try {
              await ctx.db.insert(rows).values(batchData.rowsToInsert);
              await ctx.db.insert(cells).values(batchData.cellsToInsert);
              return { success: true, batchId: batchData.batchId };
            } catch (error) {
              if (retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
                await new Promise((resolve) => setTimeout(resolve, delay));
                return insertBatchWithRetry(batchData, retryCount + 1);
              } else {
                console.error(
                  `Failed to insert batch ${batchData.batchId} after ${MAX_RETRIES} retries:`,
                  error,
                );
                return { success: false, batchId: batchData.batchId };
              }
            }
          };

          // Insert the first batches synchronously for immediate feedback
          const syncBatches = Math.ceil(SYNC_ROWS / BATCH_SIZE);
          const syncPromises = [];

          for (let syncBatch = 0; syncBatch < syncBatches; syncBatch++) {
            const currentBatchSize = Math.min(
              BATCH_SIZE,
              SYNC_ROWS - syncBatch * BATCH_SIZE,
            );
            const batchData = createBatch(currentBatchSize, syncBatch);
            syncPromises.push(
              insertBatchWithRetry({
                rowsToInsert: batchData.rowsToInsert.map((row) => ({
                  ...row,
                  created_at: new Date(),
                  updated_at: new Date(),
                })),
                cellsToInsert: batchData.cellsToInsert,
                batchId: batchData.batchId,
              }),
            );
          }

          // Wait for sync batches to complete
          const syncResults = await Promise.all(syncPromises);
          const failedSyncBatches = syncResults.filter(
            (result) => !result.success,
          );

          if (failedSyncBatches.length > 0) {
            console.error(`${failedSyncBatches.length} sync batches failed`);
          }

          // Insert the remaining rows asynchronously with parallel processing
          const backgroundInsertion = async () => {
            const remainingRows = TOTAL_ROWS - SYNC_ROWS;
            const totalBatches = Math.ceil(remainingRows / BATCH_SIZE);
            const allBatches = [];

            // Create all batch data first
            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
              const currentBatchSize = Math.min(
                BATCH_SIZE,
                remainingRows - batchIndex * BATCH_SIZE,
              );
              const batchData = createBatch(
                currentBatchSize,
                syncBatches + batchIndex,
              );
              allBatches.push(batchData);
            }

            // Process batches in parallel groups
            const failedBatches = [];

            for (let i = 0; i < allBatches.length; i += PARALLEL_BATCHES) {
              const batchGroup = allBatches.slice(i, i + PARALLEL_BATCHES);

              try {
                const groupPromises = batchGroup.map((batchData) =>
                  insertBatchWithRetry({
                    rowsToInsert: batchData.rowsToInsert.map((row) => ({
                      ...row,
                      created_at: new Date(),
                      updated_at: new Date(),
                    })),
                    cellsToInsert: batchData.cellsToInsert,
                    batchId: batchData.batchId,
                  }),
                );

                const groupResults = await Promise.all(groupPromises);
                const groupFailures = groupResults.filter(
                  (result) => !result.success,
                );

                if (groupFailures.length > 0) {
                  failedBatches.push(...groupFailures);
                  console.error(
                    `${groupFailures.length} batches failed in group starting at ${i}`,
                  );
                }

                // Add small delay between batch groups to reduce DB pressure
                if (i + PARALLEL_BATCHES < allBatches.length) {
                  await new Promise((resolve) => setTimeout(resolve, 100));
                }
              } catch (groupError) {
                console.error(
                  `Error processing batch group starting at ${i}:`,
                  groupError,
                );
                // Mark all batches in this group as failed
                batchGroup.forEach((batch) => {
                  failedBatches.push({
                    success: false,
                    batchId: batch.batchId,
                  });
                });
              }
            }

            // Final retry for any remaining failed batches
            if (failedBatches.length > 0) {
              const finalRetryPromises = failedBatches.map(
                async (failedBatch) => {
                  const batchData = createBatch(
                    BATCH_SIZE,
                    failedBatch.batchId,
                  );
                  return insertBatchWithRetry({
                    rowsToInsert: batchData.rowsToInsert.map((row) => ({
                      ...row,
                      created_at: new Date(),
                      updated_at: new Date(),
                    })),
                    cellsToInsert: batchData.cellsToInsert,
                    batchId: batchData.batchId,
                  });
                },
              );

              const finalResults = await Promise.all(finalRetryPromises);
              const stillFailed = finalResults.filter(
                (result) => !result.success,
              );

              if (stillFailed.length > 0) {
                console.error(
                  `❌ ${stillFailed.length} batches still failed after final retry`,
                );
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
