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
  columnId: z.string().uuid("Invalid column ID").optional(),
});

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
        // Check if this is a primary column first
        const [column] = await ctx.db
          .select({ is_primary: columns.is_primary, name: columns.name })
          .from(columns)
          .where(eq(columns.id, input.columnId))
          .limit(1);

        if (!column) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Column not found",
          });
        }

        if (column.is_primary) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete primary field",
          });
        }

        // Delete all cells for this column first
        await ctx.db.delete(cells).where(eq(cells.column_id, input.columnId));

        // Then delete the column
        await ctx.db.delete(columns).where(eq(columns.id, input.columnId));

        return { success: true };
      } catch (error) {
        console.error("Error deleting column:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
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
        const { tableId, name, type, columnId } = input;

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

        // Use client-provided ID if available, otherwise generate one
        const newColumnId = columnId ?? crypto.randomUUID();
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

        // Create empty cells for all existing rows in the new column - ALL SYNCHRONOUSLY
        if (existingRows.length > 0) {
          const BATCH_SIZE = 1000; // Process in smaller batches for memory efficiency
          const totalRows = existingRows.length;

          // Process ALL rows synchronously to prevent race conditions
          console.log(
            `Creating cells for ${totalRows} existing rows in new column ${newColumnId}`,
          );

          for (let i = 0; i < totalRows; i += BATCH_SIZE) {
            const batchEnd = Math.min(i + BATCH_SIZE, totalRows);
            const batch = existingRows.slice(i, batchEnd);

            const cellsToInsert = batch.map((row) => ({
              row_id: row.id,
              column_id: newColumnId,
              base_id: table.base_id,
              value_text: null,
              value_number: null,
            }));

            await ctx.db.insert(cells).values(cellsToInsert);

            console.log(
              `Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(totalRows / BATCH_SIZE)} for column ${newColumnId}`,
            );
          }

          console.log(`Completed creating all cells for column ${newColumnId}`);
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
