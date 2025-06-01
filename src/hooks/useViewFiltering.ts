import { useState, useCallback, useEffect, useMemo } from "react";
import type { FilterConfig } from "~/types/filtering";
import { operatorRequiresValue } from "~/types/filtering";
import type { ViewActions } from "./useViewData";

export interface UseViewFilteringProps {
  initialFilters?: FilterConfig[];
  viewActions?: ViewActions;
  autoSave?: boolean;
}

export interface UseViewFilteringReturn {
  filtering: FilterConfig[];
  completeFilters: FilterConfig[];
  hasFilters: boolean;
  isFilterResult: boolean;
  setFiltering: (filters: FilterConfig[]) => void;
  updateFiltering: (filters: FilterConfig[]) => Promise<void>;
}

export function useViewFiltering({
  initialFilters = [],
  viewActions,
  autoSave = true,
}: UseViewFilteringProps): UseViewFilteringReturn {
  const [filtering, setFilteringState] =
    useState<FilterConfig[]>(initialFilters);

  // Update local state when initial filters change (from view data)
  useEffect(() => {
    setFilteringState(initialFilters);
  }, [initialFilters]);

  // Filter out incomplete filters (those with empty values for operators that require values)
  const completeFilters = useMemo(() => {
    return filtering.filter((filter) => {
      // Always include filters that don't require values (is_empty, is_not_empty)
      if (!operatorRequiresValue(filter.operator)) {
        return true;
      }

      // Only include filters that have non-empty values for operators that require values
      return filter.value.trim() !== "";
    });
  }, [filtering]);

  const hasFilters = completeFilters.length > 0;
  const isFilterResult = hasFilters;

  const setFiltering = useCallback(
    (newFilters: FilterConfig[]) => {
      setFilteringState(newFilters);

      // Auto-save to view if enabled and viewActions are available
      if (autoSave && viewActions) {
        void viewActions.updateFilters(newFilters);
      }
    },
    [autoSave, viewActions],
  );

  const updateFiltering = useCallback(
    async (newFilters: FilterConfig[]) => {
      setFilteringState(newFilters);

      // Explicitly save to view
      if (viewActions) {
        await viewActions.updateFilters(newFilters);
      }
    },
    [viewActions],
  );

  return {
    filtering,
    completeFilters,
    hasFilters,
    isFilterResult,
    setFiltering,
    updateFiltering,
  };
}
