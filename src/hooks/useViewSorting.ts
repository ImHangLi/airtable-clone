import { useState, useCallback, useEffect, useMemo } from "react";
import type { SortConfig } from "~/types/sorting";
import type { ViewActions } from "./useViewData";

export interface UseViewSortingProps {
  initialSorting?: SortConfig[];
  viewActions?: ViewActions;
  autoSave?: boolean;
}

export interface UseViewSortingReturn {
  sorting: SortConfig[];
  activeSorting: SortConfig[];
  hasSorting: boolean;
  isSortResult: boolean;
  setSorting: (sorts: SortConfig[]) => void;
  updateSorting: (sorts: SortConfig[]) => Promise<void>;
}

export function useViewSorting({
  initialSorting = [],
  viewActions,
  autoSave = true,
}: UseViewSortingProps): UseViewSortingReturn {
  const [sorting, setSortingState] = useState<SortConfig[]>(initialSorting);

  // Update local state when initial sorting changes (from view data)
  useEffect(() => {
    setSortingState(initialSorting);
  }, [initialSorting]);

  const activeSorting = useMemo(() => {
    return sorting;
  }, [sorting]);

  const hasSorting = activeSorting.length > 0;
  const isSortResult = hasSorting;

  const setSorting = useCallback(
    (newSorts: SortConfig[]) => {
      setSortingState(newSorts);

      // Auto-save to view if enabled and viewActions are available
      if (autoSave && viewActions) {
        void viewActions.updateSorts(newSorts);
      }
    },
    [autoSave, viewActions],
  );

  const updateSorting = useCallback(
    async (newSorts: SortConfig[]) => {
      setSortingState(newSorts);

      // Explicitly save to view
      if (viewActions) {
        await viewActions.updateSorts(newSorts);
      }
    },
    [viewActions],
  );

  return {
    sorting,
    activeSorting,
    hasSorting,
    isSortResult,
    setSorting,
    updateSorting,
  };
}
