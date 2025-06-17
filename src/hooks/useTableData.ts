import { useMemo, useCallback, useEffect } from "react";
import { api } from "~/trpc/react";
import type { FilterConfig } from "~/types/filtering";
import type { SortConfig } from "~/types/sorting";
import { useTableRows, type TableRow, type RowActions } from "./useTableRows";
import {
  useTableColumns,
  type TableColumn,
  type ColumnActions,
} from "./useTableColumns";

export { type TableColumn, type TableRow };

// --- Core Types ---
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

// --- Props & Return Types ---
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

function createQueryConfig(props: UseTableDataProps): QueryParams {
  const { tableId, search, sorting = [], filtering = [] } = props;

  return {
    tableId,
    limit: 100,
    sorting,
    filtering,
    search: search?.trim() ?? undefined,
  };
}

export function useTableData(props: UseTableDataProps): UseTableDataReturn {
  const { tableId, baseId } = props;
  const utils = api.useUtils();

  // 1. Build query configuration
  const queryConfig = createQueryConfig(props);
  const hasFiltersApplied = Boolean(
    queryConfig.filtering?.length || queryConfig.search,
  );

  // 2. Cancel previous queries when table changes
  useEffect(() => {
    return () => {
      void utils.data.getInfiniteTableData.cancel();
    };
  }, [tableId, utils.data.getInfiniteTableData]);

  // 3. Fetch table data
  const infiniteQuery = api.data.getInfiniteTableData.useInfiniteQuery(
    queryConfig,
    {
      enabled: !!tableId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      retry: (failureCount: number) => failureCount < 2,
      staleTime: 0,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  );

  // 4. Process infinite query results
  const tableData = useMemo((): TableData | null => {
    const pages = infiniteQuery.data?.pages;
    if (!pages || pages.length === 0) return null;

    const firstPage = pages[0];
    const tableInfo = firstPage?.tableInfo;
    if (!tableInfo) return null;

    // Flatten all pages
    const allRows = pages.flatMap((page) => page.items);
    const allSearchMatches = pages.flatMap((page) => page.searchMatches ?? []);

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
      totalDBRowCount: firstPage?.totalRowCount ?? 0,
      hasNextPage: infiniteQuery.hasNextPage,
      fetchNextPage: () => void infiniteQuery.fetchNextPage(),
      isFetching: infiniteQuery.isFetching,
      isFetchingNextPage: infiniteQuery.isFetchingNextPage,
      isFilterResult: hasFiltersApplied,
    };
  }, [infiniteQuery, hasFiltersApplied]);

  // 5. Set up table operations (rows & columns)
  const firstPageTableInfo = infiniteQuery.data?.pages[0]?.tableInfo;

  const { rowActions, loading: rowLoading } = useTableRows({
    tableId,
    baseId,
    queryParams: queryConfig,
    tableInfo: firstPageTableInfo
      ? { columns: firstPageTableInfo.columns }
      : null,
  });

  const { columnActions, loading: columnLoading } = useTableColumns({
    tableId,
    baseId,
    queryParams: queryConfig,
    tableInfo: firstPageTableInfo
      ? { columns: firstPageTableInfo.columns }
      : null,
  });

  // 6. Combine all actions
  const refetch = useCallback(
    () => void infiniteQuery.refetch(),
    [infiniteQuery],
  );

  const tableActions = useMemo(
    (): TableActions => ({
      ...rowActions,
      ...columnActions,
      refetch,
    }),
    [rowActions, columnActions, refetch],
  );

  // 7. Calculate loading & error states
  const loading = useMemo(() => {
    if (infiniteQuery.isPending && !infiniteQuery.data) {
      return "Loading...";
    }
    return rowLoading ?? columnLoading ?? null;
  }, [infiniteQuery.isPending, infiniteQuery.data, rowLoading, columnLoading]);

  const error = useMemo(() => {
    if (infiniteQuery.error) {
      console.error(`❌ Table data error for table ${tableId}:`, {
        error: infiniteQuery.error.message,
        queryConfig,
      });
      return infiniteQuery.error.message;
    }
    return null;
  }, [infiniteQuery.error, tableId, queryConfig]);

  return {
    loading,
    error,
    tableData,
    tableActions,
  };
}
