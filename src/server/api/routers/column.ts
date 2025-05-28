import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  tables,
  columns,
  rows,
  cells,
  type SortDirection,
} from "~/server/db/schema";
import { randomUUID } from "crypto";
import {
  updateColumnSchema,
  addColumnSchema,
  deleteColumnSchema,
} from "./shared/types";

// Global map to track background processes for cancellation
const backgroundProcesses = new Map<string, { cancelled: boolean }>();

export const columnRouter = createTRPCRouter({
  // Update column name
  updateColumn: protectedProcedure
    .input(updateColumnSchema)
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      try {
        await ctx.db
          .update(columns)
          .set({ name: input.name })
          .where(eq(columns.id, input.columnId));

        return { success: true };
      } catch (error) {
        console.error("Error updating column:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update column",
        });
      }
    }),

  // Delete a column and all its cells
  deleteColumn: protectedProcedure
    .input(deleteColumnSchema)
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      try {
        // Cancel any background processing for this column
        const processControl = backgroundProcesses.get(input.columnId);
        if (processControl) {
          processControl.cancelled = true;
        }

        // Delete all cells for this column first
        await ctx.db.delete(cells).where(eq(cells.column_id, input.columnId));

        // Then delete the column
        await ctx.db.delete(columns).where(eq(columns.id, input.columnId));

        // Clean up the process control
        backgroundProcesses.delete(input.columnId);

        return { success: true };
      } catch (error) {
        console.error("Error deleting column:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete column",
        });
      }
    }),

  // Add a new column to a table
  addColumn: protectedProcedure
    .input(addColumnSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      try {
        const { tableId, name, type } = input;

        // Get the table to find base_id
        const [table] = await ctx.db
          .select({ base_id: tables.base_id })
          .from(tables)
          .where(eq(tables.id, tableId));

        if (!table) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Table not found",
          });
        }

        // Get the current max position for columns in this table
        const maxPositionResult = await ctx.db
          .select({ maxPosition: columns.position })
          .from(columns)
          .where(eq(columns.table_id, tableId))
          .orderBy(desc(columns.position))
          .limit(1);

        const nextPosition = (maxPositionResult[0]?.maxPosition ?? -1) + 1;

        // Create the new column
        const newColumnId = randomUUID();
        await ctx.db.insert(columns).values({
          id: newColumnId,
          base_id: table.base_id,
          table_id: tableId,
          name,
          type: type,
          position: nextPosition,
          sort: "asc" as SortDirection,
        });

        // Get all existing rows for this table
        const existingRows = await ctx.db
          .select({ id: rows.id })
          .from(rows)
          .where(eq(rows.table_id, tableId));

        // Create empty cells for all existing rows in the new column with batching
        if (existingRows.length > 0) {
          const BATCH_SIZE = 1000; // Process rows in batches
          const totalRows = existingRows.length;

          // Process first batch synchronously for immediate response
          const firstBatchSize = Math.min(BATCH_SIZE, totalRows);
          const firstBatch = existingRows.slice(0, firstBatchSize);

          if (firstBatch.length > 0) {
            const firstBatchCells = firstBatch.map((row) => ({
              row_id: row.id,
              column_id: newColumnId,
              base_id: table.base_id,
              value_text: null,
              value_number: null,
            }));

            await ctx.db.insert(cells).values(firstBatchCells);
          }

          // Process remaining rows in background if there are more
          if (totalRows > BATCH_SIZE) {
            // Register this process for potential cancellation
            backgroundProcesses.set(newColumnId, { cancelled: false });

            const backgroundProcessing = async () => {
              const remainingRows = existingRows.slice(BATCH_SIZE);
              const numBatches = Math.ceil(remainingRows.length / BATCH_SIZE);

              for (let i = 0; i < numBatches; i++) {
                try {
                  // Check if process was cancelled
                  const processControl = backgroundProcesses.get(newColumnId);
                  if (processControl?.cancelled) {
                    break;
                  }

                  // Check if column still exists before processing batch
                  const columnExists = await ctx.db
                    .select({ id: columns.id })
                    .from(columns)
                    .where(eq(columns.id, newColumnId))
                    .limit(1);

                  if (columnExists.length === 0) {
                    break; // Exit the loop if column was deleted
                  }

                  const batchStart = i * BATCH_SIZE;
                  const batchEnd = Math.min(
                    batchStart + BATCH_SIZE,
                    remainingRows.length,
                  );
                  const batch = remainingRows.slice(batchStart, batchEnd);

                  const cellsToInsert = batch.map((row) => ({
                    row_id: row.id,
                    column_id: newColumnId,
                    base_id: table.base_id,
                    value_text: null,
                    value_number: null,
                  }));

                  await ctx.db.insert(cells).values(cellsToInsert);

                  // Small delay to prevent overwhelming the database
                  if (i < numBatches - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                  }
                } catch (batchError) {
                  console.error(
                    `Error in batch ${i + 1} for column ${newColumnId}:`,
                    batchError,
                  );
                  // Continue with next batch instead of failing completely
                }
              }

              // Clean up process control when done
              backgroundProcesses.delete(newColumnId);
            };

            // Start background processing without awaiting
            backgroundProcessing().catch((error) => {
              console.error(
                "Background cell creation failed for column:",
                newColumnId,
                error,
              );
              // Clean up on error
              backgroundProcesses.delete(newColumnId);
            });
          }
        }

        return { id: newColumnId };
      } catch (error) {
        console.error("Error adding column:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add column",
        });
      }
    }),
});
