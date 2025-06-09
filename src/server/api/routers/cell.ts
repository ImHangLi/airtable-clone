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
  // Update a cell value with retry logic
  updateCell: protectedProcedure
    .input(cellValueSchema)
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<{ success: boolean; attempts: number }> => {
        const { rowId, columnId, value, baseId } = input;
        const MAX_RETRIES = 5;
        const INITIAL_DELAY = 1000;
        let retryCount = 0;

        while (retryCount < MAX_RETRIES) {
          try {
            console.log(
              `Cell update attempt ${retryCount + 1} for column ${columnId}`,
            );

            // Get column type to determine where to store the value
            const [columnInfo] = await ctx.db
              .select({ type: columns.type })
              .from(columns)
              .where(eq(columns.id, columnId))
              .limit(1);

            if (!columnInfo) {
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

              throw new TRPCError({
                code: "NOT_FOUND",
                message: error,
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

            // Success! Return with the number of attempts it took
            console.log(`Cell update succeeded on attempt ${retryCount + 1}`);
            return { success: true, attempts: retryCount + 1 };
          } catch (error) {
            console.error(
              `Cell update attempt ${retryCount + 1} failed:`,
              error,
            );

            // Don't retry on authentication/authorization errors
            if (
              error instanceof TRPCError &&
              (error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN")
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
                message: `Failed to update cell after ${MAX_RETRIES} attempts. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
});
