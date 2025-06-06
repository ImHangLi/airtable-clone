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

// Simplified retry configuration for database operations
const RETRY_CONFIG = {
  maxAttempts: 20,
  delay: 1000,
  maxDelay: 10000, // Cap at 10 seconds
  backoffMultiplier: 2, // Double the delay each retry
};

// Proper exponential backoff with jitter
async function exponentialBackoff(attempt: number): Promise<void> {
  const baseDelay =
    RETRY_CONFIG.delay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  const cappedDelay = Math.min(baseDelay, RETRY_CONFIG.maxDelay);

  // Add jitter (up to 20% randomness) to prevent thundering herd
  const jitter = Math.random() * 0.2 * cappedDelay;
  const finalDelay = cappedDelay + jitter;

  console.log(
    `Retrying in ${Math.round(finalDelay)}ms (attempt ${attempt + 1}/${RETRY_CONFIG.maxAttempts})`,
  );

  return new Promise((resolve) => setTimeout(resolve, finalDelay));
}

// Treat all errors as retryable for maximum resilience
function isRetryableError(error: unknown): boolean {
  // Only skip retries for explicit client errors that won't change
  if (error instanceof TRPCError) {
    // Don't retry on authentication/authorization errors
    if (error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN") {
      console.log("Authentication/authorization error - not retrying");
      return false;
    }

    // Don't retry on bad input validation errors
    if (error.code === "BAD_REQUEST" && error.message.includes("Invalid")) {
      console.log("Input validation error - not retrying");
      return false;
    }
  }

  // For all other errors (database, network, timing issues), retry
  console.log(
    "Error detected - will retry:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return true;
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
  // Update a cell value with simplified retry logic
  updateCell: protectedProcedure
    .input(cellValueSchema)
    .mutation(
      async ({
        ctx,
        input,
      }): Promise<{ success: boolean; attempts: number }> => {
        const { rowId, columnId, value, baseId } = input;
        let lastError: unknown;

        // Simple retry loop for database race conditions
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
              // For newly created columns, this might be a race condition
              // So we make it retryable
              console.log(
                `Column ${columnId} not found on attempt ${attempt + 1}`,
              );
              throw new TRPCError({
                code: "NOT_FOUND",
                message: `Column ${columnId} not found`,
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

            // Simple delay before retrying
            console.log(`Waiting ${RETRY_CONFIG.delay}ms before retry...`);
            await exponentialBackoff(attempt);
          }
        }

        // All retries failed, throw the last error with more context
        console.error("All retry attempts failed for cell update", {
          rowId,
          columnId,
          value,
          baseId,
          lastError,
        });

        if (lastError instanceof TRPCError) {
          throw lastError;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update cell after ${RETRY_CONFIG.maxAttempts} attempts. Last error: ${lastError instanceof Error ? lastError.message : "Unknown error"}`,
        });
      },
    ),
});
