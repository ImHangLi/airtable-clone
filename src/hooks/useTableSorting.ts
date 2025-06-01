import { useMemo } from "react";
import type { SortConfig } from "~/types/sorting";

export interface UseTableSortingProps {
  sorting?: SortConfig[];
}

export interface UseTableSortingReturn {
  activeSorting: SortConfig[];
  hasSorting: boolean;
  isSortResult: boolean;
}

export function useTableSorting({
  sorting,
}: UseTableSortingProps): UseTableSortingReturn {
  const activeSorting = useMemo(() => {
    return sorting ?? [];
  }, [sorting]);

  const hasSorting = activeSorting.length > 0;
  const isSortResult = hasSorting;

  return {
    activeSorting,
    hasSorting,
    isSortResult,
  };
}
