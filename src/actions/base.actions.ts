"use server";

import { revalidatePath } from "next/cache";
import { api } from "~/trpc/server";
import { getColorFromBaseId } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";

// Define return types
type GetAllBasesResult = RouterOutputs["base"]["getAllByLastUpdated"];
type CreateBaseResult = { baseId: string; color: string } | null;
type DeleteBaseResult = { success: boolean; error?: string };

/**
 * Get all bases by last updated
 */
export async function getAllBases(): Promise<GetAllBasesResult> {
  try {
    return await api.base.getAllByLastUpdated();
  } catch (error) {
    console.error("Error getting bases:", error);
    return [];
  }
}

/**
 * Create a new base with a random ID and color
 */
export async function createBase(): Promise<CreateBaseResult> {
  const baseId = crypto.randomUUID();
  const color = getColorFromBaseId(baseId);

  if (!color) {
    return null;
  }

  try {
    await api.base.create({
      id: baseId,
      color,
    });

    revalidatePath("/");
    return { baseId, color };
  } catch (error) {
    console.error("Error creating base:", error);
    return null;
  }
}

/**
 * Delete a base by ID
 */
export async function deleteBase(baseId: string): Promise<DeleteBaseResult> {
  try {
    await api.base.delete({
      id: baseId,
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting base:", error);
    return { success: false, error: "Failed to delete base" };
  }
}
