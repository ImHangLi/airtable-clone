/**
 * Utility functions to manage the last viewed view for each table
 * Uses localStorage to persist the last viewed view across sessions
 */

const LAST_VIEWED_VIEW_KEY = "lastViewedView";

type LastViewedViews = Record<string, string>;

/**
 * Get the last viewed view for a specific table
 */
export function getLastViewedView(tableId: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(LAST_VIEWED_VIEW_KEY);
    if (!stored) return null;

    const lastViewedViews = JSON.parse(stored) as LastViewedViews;
    return lastViewedViews[tableId] ?? null;
  } catch (error) {
    console.error("Error getting last viewed view:", error);
    return null;
  }
}

/**
 * Set the last viewed view for a specific table
 */
export function setLastViewedView(tableId: string, viewId: string): void {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(LAST_VIEWED_VIEW_KEY);
    const lastViewedViews = stored
      ? (JSON.parse(stored) as LastViewedViews)
      : ({} as LastViewedViews);

    lastViewedViews[tableId] = viewId;

    localStorage.setItem(LAST_VIEWED_VIEW_KEY, JSON.stringify(lastViewedViews));
  } catch (error) {
    console.error("Error setting last viewed view:", error);
  }
}

/**
 * Remove the last viewed view for a specific table
 */
export function removeLastViewedView(tableId: string): void {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(LAST_VIEWED_VIEW_KEY);
    if (!stored) return;

    const lastViewedViews = JSON.parse(stored) as LastViewedViews;
    delete lastViewedViews[tableId];

    localStorage.setItem(LAST_VIEWED_VIEW_KEY, JSON.stringify(lastViewedViews));
  } catch (error) {
    console.error("Error removing last viewed view:", error);
  }
}

/**
 * Clear all last viewed views
 */
export function clearAllLastViewedViews(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(LAST_VIEWED_VIEW_KEY);
  } catch (error) {
    console.error("Error clearing last viewed views:", error);
  }
}
