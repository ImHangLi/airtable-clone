const LAST_VIEWED_BASES_KEY = "lastViewedBases";

interface LastViewedEntry {
  baseId: string;
  timestamp: number;
}

export function setLastViewedBase(baseId: string): void {
  if (typeof window === "undefined") return;

  try {
    const now = Date.now();
    const stored = localStorage.getItem(LAST_VIEWED_BASES_KEY);
    let entries: LastViewedEntry[] = stored
      ? (JSON.parse(stored) as LastViewedEntry[])
      : [];

    // Remove existing entry for this base
    entries = entries.filter((entry) => entry.baseId !== baseId);

    // Add new entry at the beginning
    entries.unshift({ baseId, timestamp: now });

    // Keep only the last 50 entries to prevent localStorage bloat
    entries = entries.slice(0, 50);

    localStorage.setItem(LAST_VIEWED_BASES_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Failed to set last viewed base:", error);
  }
}

export function getLastViewedBases(): LastViewedEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(LAST_VIEWED_BASES_KEY);
    return stored ? (JSON.parse(stored) as LastViewedEntry[]) : [];
  } catch (error) {
    console.error("Failed to get last viewed bases:", error);
    return [];
  }
}

export function sortBasesByLastViewed<T extends { id: string }>(
  bases: T[],
): T[] {
  const lastViewedEntries = getLastViewedBases();
  const lastViewedMap = new Map(
    lastViewedEntries.map((entry) => [entry.baseId, entry.timestamp]),
  );

  return [...bases].sort((a, b) => {
    const aTimestamp = lastViewedMap.get(a.id) ?? 0;
    const bTimestamp = lastViewedMap.get(b.id) ?? 0;

    // Sort by timestamp descending (most recent first)
    return bTimestamp - aTimestamp;
  });
}
