import { useMemo, useCallback } from "react";
import { api } from "~/trpc/react";
import type { FilterConfig } from "~/types/filtering";
import type { SortConfig } from "~/types/sorting";
import { useTableRows, type TableRow, type RowActions } from "./useTableRows";
import {
  useTableColumns,
  type TableColumn,
  type ColumnActions,
} from "./useTableColumns";
import { useTableFiltering } from "./useTableFiltering";
import { useTableSorting } from "./useTableSorting";

export { type TableColumn, type TableRow };

export interface QueryParams {
  tableId: string;
  limit: number;
  sorting: SortConfig[];
  filtering: FilterConfig[];
  search?: string;
}

export interface SearchMatch {
  rowId: string;
  columnId: string;
  cellValue: string;
}

export interface TableData {
  name: string;
  columns: TableColumn[];
  rows: TableRow[];
  searchMatches: SearchMatch[];
  totalRows: number;
  totalDBRowCount: number;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetching?: boolean;
  isFetchingNextPage?: boolean;
  isFilterResult?: boolean;
}

export interface TableActions extends RowActions, ColumnActions {
  refetch: () => void;
}

interface UseTableDataProps {
  tableId: string;
  baseId: string;
  search?: string;
  sorting?: SortConfig[];
  filtering?: FilterConfig[];
}

interface UseTableDataReturn {
  loading: string | null;
  error: string | null;
  tableData: TableData | null;
  tableActions: TableActions;
}

export function useTableData({
  tableId,
  baseId,
  search,
  sorting,
  filtering,
}: UseTableDataProps): UseTableDataReturn {
  const debouncedSearch = search?.trim() ?? "";
  const hasSearch = Boolean(debouncedSearch);

  // Use specialized hooks
  const { completeFilters, isFilterResult } = useTableFiltering({ filtering });
  const { activeSorting } = useTableSorting({ sorting });

  // Helper function to get query params for cache operations
  const getQueryParams = useCallback(
    () => ({
      tableId,
      limit: 150, // No longer reduce limit for search since we don't filter on backend
      sorting: activeSorting,
      filtering: completeFilters,
      search: hasSearch ? debouncedSearch : undefined,
    }),
    [tableId, hasSearch, activeSorting, completeFilters, debouncedSearch],
  );

  // Use tRPC's useInfiniteQuery for proper pagination
  const infiniteQuery = api.data.getInfiniteTableData.useInfiniteQuery(
    getQueryParams(),
    {
      enabled: !!tableId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      retry: (failureCount: number) => failureCount < 2,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  );

  // Flatten all pages into a single array of rows
  const allRows = useMemo(() => {
    if (!infiniteQuery.data?.pages) return [];
    return infiniteQuery.data.pages.flatMap((page) => page.items);
  }, [infiniteQuery.data?.pages]);

  // Flatten all search matches from all pages
  const allSearchMatches = useMemo(() => {
    if (!infiniteQuery.data?.pages) return [];
    return infiniteQuery.data.pages.flatMap((page) => page.searchMatches ?? []);
  }, [infiniteQuery.data?.pages]);

  // Get table info from first page
  const tableInfo = infiniteQuery.data?.pages[0]?.tableInfo;
  const totalRowCount = infiniteQuery.data?.pages[0]?.totalRowCount ?? 0;

  // Extract specific query properties to avoid re-renders from infiniteQuery object changes
  const hasNextPage = infiniteQuery.hasNextPage;
  const isFetching = infiniteQuery.isFetching;
  const isFetchingNextPage = infiniteQuery.isFetchingNextPage;
  const fetchNextPage = useCallback(
    () => void infiniteQuery.fetchNextPage(),
    [infiniteQuery],
  );
  const refetch = useCallback(
    () => void infiniteQuery.refetch(),
    [infiniteQuery],
  );

  // Get query params for mutations
  const queryParams = getQueryParams();

  // Use specialized hooks for operations
  const { rowActions, loading: rowLoading } = useTableRows({
    tableId,
    baseId,
    queryParams,
    tableInfo,
  });

  const { columnActions, loading: columnLoading } = useTableColumns({
    tableId,
    baseId,
    queryParams,
    tableInfo,
  });

  // Transform data to our clean format
  const tableData = useMemo((): TableData | null => {
    if (!tableInfo) return null;

    return {
      name: tableInfo.name,
      columns: tableInfo.columns.map((col) => ({
        id: col.id,
        name: col.name,
        type: col.type,
        is_primary: col.is_primary,
      })),
      rows: allRows,
      searchMatches: allSearchMatches,
      totalRows: allRows.length,
      totalDBRowCount: totalRowCount,
      hasNextPage,
      fetchNextPage,
      isFetching,
      isFetchingNextPage,
      isFilterResult,
    };
  }, [
    tableInfo,
    allRows,
    allSearchMatches,
    totalRowCount,
    isFilterResult,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  const tableActions = useMemo(
    (): TableActions => ({
      ...rowActions,
      ...columnActions,
      refetch,
    }),
    [rowActions, columnActions, refetch],
  );

  // Calculate combined loading state
  const loading = useMemo(() => {
    const isInitialLoading = infiniteQuery.isPending && !infiniteQuery.data;

    if (isInitialLoading) {
      return "Loading...";
    }

    // Check for specific operation loading states (prioritize more specific operations)
    return rowLoading ?? columnLoading ?? null;
  }, [infiniteQuery.isPending, infiniteQuery.data, rowLoading, columnLoading]);

  // Error handling
  const error = useMemo(() => {
    if (infiniteQuery.error) {
      return infiniteQuery.error.message;
    }
    return null;
  }, [infiniteQuery.error]);

  return {
    loading,
    error,
    tableData,
    tableActions,
  };
}
