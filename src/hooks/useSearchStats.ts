import { api } from "~/trpc/react";
import { useDebounce } from "./useDebounce";

export interface SearchStats {
  totalMatches: number;
  uniqueRows: number;
  uniqueFields: number;
}

interface UseSearchStatsProps {
  tableId: string;
  search?: string;
}

interface UseSearchStatsReturn {
  searchStats: SearchStats | null;
  isLoading: boolean;
  error: string | null;
}

export function useSearchStats({
  tableId,
  search,
}: UseSearchStatsProps): UseSearchStatsReturn {
  const debouncedSearch = useDebounce(search?.trim() ?? "", 1000);
  const hasSearch = Boolean(debouncedSearch);

  const {
    data: searchStats,
    isLoading,
    error,
  } = api.data.getSearchStats.useQuery(
    {
      tableId,
      search: debouncedSearch,
    },
    {
      enabled: hasSearch && debouncedSearch.length > 0,
      staleTime: 30000, // Cache for 30 seconds
      refetchOnWindowFocus: false,
      retry: 1,
    },
  );

  return {
    searchStats: hasSearch ? (searchStats ?? null) : null,
    isLoading: hasSearch ? isLoading : false,
    error: error?.message ?? null,
  };
}
