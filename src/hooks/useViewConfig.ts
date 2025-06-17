import { useCallback, useMemo } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { FilterConfig } from "~/types/filtering";
import type { SortConfig } from "~/types/sorting";
import type { TableColumn } from "./useTableData";
import { operatorRequiresValue } from "~/types/filtering";

export interface ViewConfig {
  id: string;
  name: string;
  table_id: string;
  base_id: string;
  filters: FilterConfig[];
  sorts: SortConfig[];
  hiddenColumns: string[];
}

export interface UseViewConfigProps {
  viewId: string;
  tableId: string;
}

export interface UseViewConfigReturn {
  // View data
  viewConfig: ViewConfig | null;
  isLoading: boolean;
  error: string | null;
  columns: TableColumn[];

  // Processed data for table queries
  activeFilters: FilterConfig[];
  activeSorts: SortConfig[];

  // UI data (includes incomplete filters)
  allFilters: FilterConfig[];

  // Actions
  updateFilters: (filters: FilterConfig[]) => void;
  updateSorts: (sorts: SortConfig[]) => void;
  updateHiddenColumns: (hiddenColumns: string[]) => void;
  showAllColumns: () => void;
  hideAllColumns: () => void;
}

export function useViewConfig({
  viewId,
  tableId,
}: UseViewConfigProps): UseViewConfigReturn {
  const utils = api.useUtils();

  // Fetch view configuration
  const {
    data,
    isLoading,
    error: queryError,
  } = api.view.getViewWithColumns.useQuery(
    { viewId, tableId },
    {
      enabled: !!viewId && !!tableId,
    },
  );

  const viewConfig = data?.view ?? null;
  const columns = useMemo(() => data?.tableColumns ?? [], [data?.tableColumns]);

  // Mutations with optimistic updates that update tRPC cache directly
  const updateFilterMutation = api.view.updateFilter.useMutation({
    onMutate: async ({ filter }) => {
      // Cancel queries
      await utils.view.getViewWithColumns.cancel({ viewId, tableId });

      // Get previous data
      const previousData = utils.view.getViewWithColumns.getData({
        viewId,
        tableId,
      });

      // Update tRPC cache directly - syncs across ALL hook instances
      utils.view.getViewWithColumns.setData({ viewId, tableId }, (old) => {
        if (!old?.view) return old;
        return {
          ...old,
          view: { ...old.view, filters: filter },
        };
      });

      return { previousData };
    },
    onError: (error, _, context) => {
      // Revert cache
      if (context?.previousData) {
        utils.view.getViewWithColumns.setData(
          { viewId, tableId },
          context.previousData,
        );
      }
      toast.error(`Failed to update filters: ${error.message}`);
    },
  });

  const updateSortMutation = api.view.updateSort.useMutation({
    onMutate: async ({ sort }) => {
      await utils.view.getViewWithColumns.cancel({ viewId, tableId });

      const previousData = utils.view.getViewWithColumns.getData({
        viewId,
        tableId,
      });

      utils.view.getViewWithColumns.setData({ viewId, tableId }, (old) => {
        if (!old?.view) return old;
        return {
          ...old,
          view: { ...old.view, sorts: sort },
        };
      });

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        utils.view.getViewWithColumns.setData(
          { viewId, tableId },
          context.previousData,
        );
      }
      toast.error(`Failed to update sorting: ${error.message}`);
    },
  });

  const updateHiddenColumnsMutation = api.view.updateHiddenColumn.useMutation({
    onMutate: async ({ hiddenColumns }) => {
      await utils.view.getViewWithColumns.cancel({ viewId, tableId });

      const previousData = utils.view.getViewWithColumns.getData({
        viewId,
        tableId,
      });

      utils.view.getViewWithColumns.setData({ viewId, tableId }, (old) => {
        if (!old?.view) return old;
        return {
          ...old,
          view: { ...old.view, hiddenColumns },
        };
      });

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        utils.view.getViewWithColumns.setData(
          { viewId, tableId },
          context.previousData,
        );
      }
      toast.error(`Failed to update column visibility: ${error.message}`);
    },
  });

  // Processed data for table queries - use viewConfig directly from cache
  const activeFilters = useMemo(() => {
    if (!viewConfig?.filters) return [];
    return viewConfig.filters.filter((filter) => {
      if (!operatorRequiresValue(filter.operator)) return true;
      return filter.value.trim() !== "";
    });
  }, [viewConfig?.filters]);

  const activeSorts = useMemo(() => {
    return viewConfig?.sorts ?? [];
  }, [viewConfig?.sorts]);

  // UI data (includes incomplete filters)
  const allFilters = useMemo(() => {
    if (!viewConfig?.filters) return [];
    return viewConfig.filters;
  }, [viewConfig?.filters]);

  // Actions
  const updateFilters = useCallback(
    (filters: FilterConfig[]) => {
      updateFilterMutation.mutate({ viewId, filter: filters });
    },
    [viewId, updateFilterMutation],
  );

  const updateSorts = useCallback(
    (sorts: SortConfig[]) => {
      updateSortMutation.mutate({ viewId, sort: sorts });
    },
    [viewId, updateSortMutation],
  );

  const updateHiddenColumns = useCallback(
    (hiddenColumns: string[]) => {
      // Filter out primary columns
      const primaryColumnIds = columns
        .filter((col) => col.is_primary)
        .map((col) => col.id);
      const filteredHiddenColumns = hiddenColumns.filter(
        (id) => !primaryColumnIds.includes(id),
      );

      updateHiddenColumnsMutation.mutate({
        viewId,
        hiddenColumns: filteredHiddenColumns,
      });
    },
    [viewId, updateHiddenColumnsMutation, columns],
  );

  const showAllColumns = useCallback(() => {
    updateHiddenColumns([]);
  }, [updateHiddenColumns]);

  const hideAllColumns = useCallback(() => {
    const nonPrimaryColumns = columns
      .filter((col) => !col.is_primary)
      .map((col) => col.id);
    updateHiddenColumns(nonPrimaryColumns);
  }, [columns, updateHiddenColumns]);

  return {
    viewConfig,
    isLoading,
    error: queryError?.message ?? null,
    columns,
    activeFilters,
    activeSorts,
    allFilters,
    updateFilters,
    updateSorts,
    updateHiddenColumns,
    showAllColumns,
    hideAllColumns,
  };
}
