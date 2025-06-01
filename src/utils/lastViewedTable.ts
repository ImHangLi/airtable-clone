// Types
type LastViewedTables = Record<string, string>;

// Constants
const LAST_VIEWED_TABLE_KEY = "airtable-clone-last-viewed-tables";

/**
 * Set the last viewed table for a specific base
 */
export function setLastViewedTable(baseId: string, tableId: string): void {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(LAST_VIEWED_TABLE_KEY);
    const lastViewedTables = stored
      ? (JSON.parse(stored) as LastViewedTables)
      : ({} as LastViewedTables);

    lastViewedTables[baseId] = tableId;
    localStorage.setItem(
      LAST_VIEWED_TABLE_KEY,
      JSON.stringify(lastViewedTables),
    );
  } catch (error) {
    console.error("Error setting last viewed table:", error);
  }
}

/**
 * Get the last viewed table for a specific base
 */
export function getLastViewedTable(baseId: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(LAST_VIEWED_TABLE_KEY);
    if (!stored) return null;

    const lastViewedTables = JSON.parse(stored) as LastViewedTables;
    return lastViewedTables[baseId] ?? null;
  } catch (error) {
    console.error("Error getting last viewed table:", error);
    return null;
  }
}

/**
 * Remove the last viewed table for a specific base
 */
export function removeLastViewedTable(baseId: string): void {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(LAST_VIEWED_TABLE_KEY);
    if (!stored) return;

    const lastViewedTables = JSON.parse(stored) as LastViewedTables;
    delete lastViewedTables[baseId];

    localStorage.setItem(
      LAST_VIEWED_TABLE_KEY,
      JSON.stringify(lastViewedTables),
    );
  } catch (error) {
    console.error("Error removing last viewed table:", error);
  }
}

/**
 * Clear all last viewed tables
 */
export function clearLastViewedTables(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(LAST_VIEWED_TABLE_KEY);
  } catch (error) {
    console.error("Error clearing last viewed tables:", error);
  }
}
