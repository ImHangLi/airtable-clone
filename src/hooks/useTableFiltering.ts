import { useMemo } from "react";
import type { FilterConfig } from "~/types/filtering";
import { operatorRequiresValue } from "~/types/filtering";

export interface UseTableFilteringProps {
  filtering?: FilterConfig[];
}

export interface UseTableFilteringReturn {
  completeFilters: FilterConfig[];
  hasFilters: boolean;
  isFilterResult: boolean;
}

export function useTableFiltering({
  filtering,
}: UseTableFilteringProps): UseTableFilteringReturn {
  // Filter out incomplete filters (those with empty values for operators that require values)
  const completeFilters = useMemo(() => {
    if (!filtering) return [];

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

  return {
    completeFilters,
    hasFilters,
    isFilterResult,
  };
}
