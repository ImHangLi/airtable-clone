import { useState, useCallback, useEffect, useMemo } from "react";
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
  created_at: Date;
  updated_at: Date;
}

export interface UseViewConfigProps {
  viewId: string;
  columns: TableColumn[];
}

export interface UseViewConfigReturn {
  // View data
  viewConfig: ViewConfig | null;
  isLoading: boolean;
  error: string | null;

  // Processed data for table queries
  activeFilters: FilterConfig[];
  activeSorts: SortConfig[];
  visibleColumns: TableColumn[];

  // Actions
  updateFilters: (filters: FilterConfig[]) => void;
  updateSorts: (sorts: SortConfig[]) => void;
  updateHiddenColumns: (hiddenColumns: string[]) => void;
  toggleColumnVisibility: (columnId: string) => void;
  showAllColumns: () => void;
  hideAllColumns: () => void;
}

export function useViewConfig({
  viewId,
  columns,
}: UseViewConfigProps): UseViewConfigReturn {
  const [localConfig, setLocalConfig] = useState<ViewConfig | null>(null);

  // Fetch view configuration
  const {
    data: viewConfig,
    isLoading,
    error: queryError,
    refetch,
  } = api.view.getView.useQuery(
    { viewId },
    {
      enabled: !!viewId,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  );

  // Mutations with optimistic updates
  const updateFilterMutation = api.view.updateFilter.useMutation({
    onMutate: async ({ filter }) => {
      if (localConfig) {
        setLocalConfig({ ...localConfig, filters: filter });
      }
    },
    onError: (error) => {
      if (viewConfig) setLocalConfig(viewConfig as ViewConfig);
      toast.error(`Failed to update filters: ${error.message}`);
      void refetch();
    },
  });

  const updateSortMutation = api.view.updateSort.useMutation({
    onMutate: async ({ sort }) => {
      if (localConfig) {
        setLocalConfig({ ...localConfig, sorts: sort });
      }
    },
    onError: (error) => {
      if (viewConfig) setLocalConfig(viewConfig as ViewConfig);
      toast.error(`Failed to update sorting: ${error.message}`);
      void refetch();
    },
  });

  const updateHiddenColumnsMutation = api.view.updateHiddenColumn.useMutation({
    onMutate: async ({ hiddenColumns }) => {
      if (localConfig) {
        setLocalConfig({ ...localConfig, hiddenColumns });
      }
    },
    onError: (error) => {
      if (viewConfig) setLocalConfig(viewConfig as ViewConfig);
      toast.error(`Failed to update column visibility: ${error.message}`);
      void refetch();
    },
  });

  // Sync local state with server data
  useEffect(() => {
    if (viewConfig) {
      setLocalConfig(viewConfig as ViewConfig);
    }
  }, [viewConfig]);

  // Processed data for table queries
  const activeFilters = useMemo(() => {
    if (!localConfig?.filters) return [];
    return localConfig.filters.filter((filter) => {
      if (!operatorRequiresValue(filter.operator)) return true;
      return filter.value.trim() !== "";
    });
  }, [localConfig?.filters]);

  const activeSorts = useMemo(() => {
    return localConfig?.sorts ?? [];
  }, [localConfig?.sorts]);

  const visibleColumns = useMemo(() => {
    if (!localConfig?.hiddenColumns) return columns;
    return columns.filter((col) => !localConfig.hiddenColumns.includes(col.id));
  }, [columns, localConfig?.hiddenColumns]);

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

  const toggleColumnVisibility = useCallback(
    (columnId: string) => {
      if (!localConfig) return;

      const column = columns.find((col) => col.id === columnId);
      if (column?.is_primary) {
        toast.error("Cannot hide primary field");
        return;
      }

      const currentHidden = localConfig.hiddenColumns;
      const newHidden = currentHidden.includes(columnId)
        ? currentHidden.filter((id) => id !== columnId)
        : [...currentHidden, columnId];

      updateHiddenColumns(newHidden);
    },
    [localConfig, columns, updateHiddenColumns],
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
    viewConfig: localConfig,
    isLoading,
    error: queryError?.message ?? null,
    activeFilters,
    activeSorts,
    visibleColumns,
    updateFilters,
    updateSorts,
    updateHiddenColumns,
    toggleColumnVisibility,
    showAllColumns,
    hideAllColumns,
  };
}
