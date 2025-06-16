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
import { z } from "zod";

// Column-related schemas
export const updateColumnSchema = z.object({
  columnId: z.string().uuid("Invalid column ID"),
  name: z.string().min(1, "Column name is required"),
});

export const deleteColumnSchema = z.object({
  columnId: z.string().uuid("Invalid column ID"),
});

export const addColumnSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  name: z.string().min(1, "Column name is required"),
  type: z.enum(["text", "number"]),
  columnId: z.string().uuid("Invalid column ID"),
});

export const getColumnsSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
});

export const columnRouter = createTRPCRouter({
  getColumns: protectedProcedure
    .input(getColumnsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const { tableId } = input;

        const tableColumns = await ctx.db
          .select({
            id: columns.id,
            name: columns.name,
            type: columns.type,
            position: columns.position,
            is_primary: columns.is_primary,
          })
          .from(columns)
          .where(eq(columns.table_id, tableId))
          .orderBy(columns.position);

        return tableColumns;
      } catch (error) {
        console.error("Error fetching columns:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch columns",
        });
      }
    }),

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
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<{ success: boolean; attempts: number }> => {
        const { columnId } = input;
        const MAX_RETRIES = 5;
        const INITIAL_DELAY = 1000;
        let retryCount = 0;

        while (retryCount < MAX_RETRIES) {
          try {
            console.log(
              `Column delete attempt ${retryCount + 1} for column ${columnId}`,
            );

            // Check if this is a primary column first
            const [column] = await ctx.db
              .select({ is_primary: columns.is_primary, name: columns.name })
              .from(columns)
              .where(eq(columns.id, columnId))
              .limit(1);

            if (!column) {
              const error = `Column ${columnId} not found`;
              console.log(error);

              // Check if we should retry for Column not found
              if (retryCount < MAX_RETRIES - 1) {
                retryCount++;
                await new Promise((resolve) =>
                  setTimeout(
                    resolve,
                    INITIAL_DELAY * Math.pow(2, retryCount - 1),
                  ),
                );
                continue;
              }

              // After all retries, consider it a success since the column doesn't exist
              console.log(
                `Column ${columnId} not found after ${MAX_RETRIES} attempts, considering deletion successful`,
              );
              return { success: true, attempts: retryCount + 1 };
            }

            if (column.is_primary) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Cannot delete primary field",
              });
            }

            // Delete all cells for this column first
            await ctx.db.delete(cells).where(eq(cells.column_id, columnId));

            // Then delete the column
            await ctx.db.delete(columns).where(eq(columns.id, columnId));

            // Success! Return with the number of attempts it took
            console.log(`Column delete succeeded on attempt ${retryCount + 1}`);
            return { success: true, attempts: retryCount + 1 };
          } catch (error) {
            console.error(
              `Column delete attempt ${retryCount + 1} failed:`,
              error,
            );

            // Don't retry on authentication/authorization errors or primary column errors
            if (
              error instanceof TRPCError &&
              (error.code === "UNAUTHORIZED" ||
                error.code === "FORBIDDEN" ||
                error.code === "BAD_REQUEST")
            ) {
              throw error;
            }

            // Check if this is the last attempt
            if (retryCount === MAX_RETRIES - 1) {
              if (error instanceof TRPCError) {
                throw error;
              }
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to delete column after ${MAX_RETRIES} attempts. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
              });
            }

            // Retry with exponential backoff
            retryCount++;
            await new Promise((resolve) =>
              setTimeout(resolve, INITIAL_DELAY * Math.pow(2, retryCount - 1)),
            );
          }
        }

        // This should never be reached, but just in case
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Max retries exceeded",
        });
      },
    ),

  // Add a new column to a table
  addColumn: protectedProcedure
    .input(addColumnSchema)
    .mutation(async ({ ctx, input }): Promise<{ id: string }> => {
      try {
        const { tableId, name, type, columnId } = input;

        // Use a transaction to ensure data consistency
        const result = await ctx.db.transaction(async (tx) => {
          // Get the table to find base_id
          const [table] = await tx
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
          const maxPositionResult = await tx
            .select({ maxPosition: columns.position })
            .from(columns)
            .where(eq(columns.table_id, tableId))
            .orderBy(desc(columns.position))
            .limit(1);

          const nextPosition = (maxPositionResult[0]?.maxPosition ?? -1) + 1;

          // Use client-provided ID
          const newColumnId = columnId;

          // Create the column
          await tx.insert(columns).values({
            id: newColumnId,
            base_id: table.base_id,
            table_id: tableId,
            name,
            type: type,
            position: nextPosition,
            sort: "asc" as SortDirection,
          });

          // Get all existing rows for this table
          const existingRows = await tx
            .select({ id: rows.id })
            .from(rows)
            .where(eq(rows.table_id, tableId));

          // Create empty cells for all existing rows using efficient batching
          if (existingRows.length > 0) {
            const BATCH_SIZE = 5000; // Optimal for large datasets
            const totalRows = existingRows.length;

            console.log(
              `Creating ${totalRows} cells for new column ${newColumnId}`,
            );

            // Process in batches to handle large datasets efficiently
            for (let i = 0; i < totalRows; i += BATCH_SIZE) {
              const batch = existingRows.slice(i, i + BATCH_SIZE);

              const cellsToInsert = batch.map((row) => ({
                row_id: row.id,
                column_id: newColumnId,
                base_id: table.base_id,
                value_text: null,
                value_number: null,
              }));

              await tx.insert(cells).values(cellsToInsert);

              // Log progress for large operations
              if (totalRows > 10000 && (i + BATCH_SIZE) % 20000 === 0) {
                console.log(
                  `Progress: ${i + BATCH_SIZE}/${totalRows} cells created`,
                );
              }
            }

            console.log(
              `Successfully created all ${totalRows} cells for column ${newColumnId}`,
            );
          }

          return newColumnId;
        });

        return { id: result };
      } catch (error) {
        console.error("Error adding column:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add column",
        });
      }
    }),
});
