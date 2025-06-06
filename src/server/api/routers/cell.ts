import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { columns, cells, type ColumnType } from "~/server/db/schema";
import { z } from "zod";

// Cell-related schema and utility function
export const cellValueSchema = z.object({
  rowId: z.string(),
  columnId: z.string(),
  value: z.union([z.string(), z.number()]),
  baseId: z.string(),
});

// Exponential backoff configuration
const RETRY_CONFIG = {
  maxAttempts: 5, // Maximum number of retry attempts
  initialDelay: 1000, // Initial delay in milliseconds (1 second)
  maxDelay: 10000, // Maximum delay between retries (10 seconds)
  backoffMultiplier: 2, // Multiply delay by this factor each retry
};

async function exponentialBackoff(attempt: number): Promise<void> {
  const delay = Math.min(
    RETRY_CONFIG.initialDelay *
      Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
    RETRY_CONFIG.maxDelay,
  );

  // Add some jitter (randomness) to prevent thundering herd problem
  const jitter = Math.random() * 0.1 * delay; // Up to 10% jitter
  const finalDelay = delay + jitter;

  console.log(
    `Retrying in ${Math.round(finalDelay)}ms (attempt ${attempt + 1})`,
  );

  return new Promise((resolve) => setTimeout(resolve, finalDelay));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof TRPCError) {
    // Only retry on server errors or timeouts, not client errors
    return error.code === "INTERNAL_SERVER_ERROR" || error.code === "TIMEOUT";
  }

  // For database errors or network issues, we should retry
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("connection") ||
      message.includes("network") ||
      message.includes("temporary")
    );
  }

  return false;
}

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
  // Update a cell value with exponential backoff retry logic
  updateCell: protectedProcedure
    .input(cellValueSchema)
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<{ success: boolean; attempts: number }> => {
        const { rowId, columnId, value, baseId } = input;
        let lastError: unknown;

        // Retry loop with exponential backoff
        for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
          try {
            console.log(
              `Cell update attempt ${attempt + 1} for column ${columnId}`,
            );

            // Get column type to determine where to store the value
            const [columnInfo] = await ctx.db
              .select({ type: columns.type })
              .from(columns)
              .where(eq(columns.id, columnId))
              .limit(1);

            if (!columnInfo) {
              // Column not found is not retryable - it's a permanent error
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

            // Success! Return with the number of attempts it took
            console.log(`Cell update succeeded on attempt ${attempt + 1}`);
            return { success: true, attempts: attempt + 1 };
          } catch (error) {
            console.error(`Cell update attempt ${attempt + 1} failed:`, error);
            lastError = error;

            // If it's not a retryable error, fail immediately
            if (!isRetryableError(error)) {
              console.log("Error is not retryable, failing immediately");
              break;
            }

            // If this was our last attempt, don't wait
            if (attempt === RETRY_CONFIG.maxAttempts - 1) {
              console.log("Max attempts reached, giving up");
              break;
            }

            // Wait before retrying with exponential backoff
            await exponentialBackoff(attempt);
          }
        }

        // All retries failed, throw the last error
        console.error("All retry attempts failed for cell update");
        if (lastError instanceof TRPCError) {
          throw lastError;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update cell after multiple attempts",
        });
      },
    ),
});
