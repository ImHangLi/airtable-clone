import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { columns, cells } from "~/server/db/schema";
import { updateCellSchema, getCellValue } from "./shared/types";

export const cellRouter = createTRPCRouter({
  // Update a cell value
  updateCell: protectedProcedure
    .input(updateCellSchema)
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      try {
        const { rowId, columnId, value, baseId } = input;

        // Get column type to determine where to store the value
        const [columnInfo] = await ctx.db
          .select({ type: columns.type })
          .from(columns)
          .where(eq(columns.id, columnId))
          .limit(1);

        if (!columnInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Column not found",
          });
        }

        const { value_text, value_number } = await getCellValue(
          columnInfo.type,
          value,
        );

        // Update or insert the cell
        await ctx.db
          .insert(cells)
          .values({
            row_id: rowId,
            column_id: columnId,
            base_id: baseId,
            value_text,
            value_number,
          })
          .onConflictDoUpdate({
            target: [cells.row_id, cells.column_id],
            set: {
              value_text,
              value_number,
            },
          });

        return { success: true };
      } catch (error) {
        console.error("Error updating cell:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update cell",
        });
      }
    }),
});
