"use server";

import { revalidatePath } from "next/cache";
import { api } from "~/trpc/server";
import type { RouterOutputs } from "~/trpc/react";

// Define the expected return types
type LatestTableViewResult = RouterOutputs["table"]["getLatest"] | null;
type DefaultTableViewResult = RouterOutputs["table"]["createDefault"];

/**
 * Get the latest table and view for a base
 */
export async function getLatestTableView(
  baseId: string,
): Promise<LatestTableViewResult> {
  try {
    // Using the server tRPC API
    return await api.table.getLatest({ baseId });
  } catch (error) {
    console.error("Error getting latest table and view:", error);
    return null;
  }
}

/**
 * Create default table and view for a new base
 */
export async function createDefaultTableView(
  baseId: string,
  tableName = "Table 1",
  viewName = "Grid View",
): Promise<DefaultTableViewResult | null> {
  try {
    // Using the server tRPC API
    const result = await api.table.createDefault({
      baseId,
      tableName,
      viewName,
    });

    revalidatePath(`/${baseId}`);
    return result;
  } catch (error) {
    console.error("Error creating default table and view:", error);
    return null;
  }
}
