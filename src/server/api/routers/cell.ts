import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { columns, cells, type ColumnType } from "~/server/db/schema";
import { z } from "zod";

// Cell-related schema and utility function
export const cellValueSchema = z.object({
  rowId: z.string().uuid("Invalid row ID"),
  columnId: z.string().uuid("Invalid column ID"),
  value: z.union([z.string(), z.number()]),
  baseId: z.string().uuid("Invalid base ID"),
});

export async function getCellValue(
  columnType: ColumnType,
  value: string | number,
) {
  if (columnType === "text") {
    return {
      value_text:
        value === "" || value === null || value === undefined
          ? null
          : String(value),
      value_number: null,
    };
  } else if (columnType === "number") {
    return {
      value_text: null,
      value_number:
        value === "" || value === null || value === undefined
          ? null
          : Number(value),
    };
  }

  throw new Error("Unsupported column type");
}

export const cellRouter = createTRPCRouter({
  // Update a cell value
  updateCell: protectedProcedure
    .input(cellValueSchema)
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
