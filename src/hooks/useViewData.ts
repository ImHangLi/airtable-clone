import { useState, useCallback, useEffect } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { FilterConfig } from "~/types/filtering";
import type { SortConfig } from "~/types/sorting";

export interface ViewData {
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

export interface UseViewDataProps {
  viewId: string;
}

export interface ViewActions {
  updateFilters: (filters: FilterConfig[]) => Promise<void>;
  updateSorts: (sorts: SortConfig[]) => Promise<void>;
  updateHiddenColumns: (hiddenColumns: string[]) => Promise<void>;
}

export interface UseViewDataReturn {
  viewData: ViewData | null;
  viewActions: ViewActions;
  isLoading: boolean;
  error: string | null;
}

export function useViewData({
  viewId,
}: UseViewDataProps): UseViewDataReturn {
  const [localViewData, setLocalViewData] = useState<ViewData | null>(null);

  // Get view data with table validation
  const {
    data: viewData,
    isLoading,
    error: queryError,
    refetch,
  } = api.view.getView.useQuery(
    { viewId },
    {
      enabled: !!viewId,
      staleTime: 1000 * 30, // 30 seconds - reasonable for view config
      refetchOnWindowFocus: false,
    },
  );

  // Update filter mutation
  const updateFilterMutation = api.view.updateFilter.useMutation({
    onMutate: async ({ filter }) => {
      // Optimistic update
      if (localViewData) {
        setLocalViewData({ ...localViewData, filters: filter });
      }
    },
    onError: (error) => {
      // Revert optimistic update
      if (viewData) {
        setLocalViewData(viewData as ViewData);
      }
      toast.error(`Failed to update filters: ${error.message}`);
      // Only refetch on error to ensure data consistency
      void refetch();
    },
  });

  // Update sort mutation
  const updateSortMutation = api.view.updateSort.useMutation({
    onMutate: async ({ sort }) => {
      // Optimistic update
      if (localViewData) {
        setLocalViewData({ ...localViewData, sorts: sort });
      }
    },
    onError: (error) => {
      // Revert optimistic update
      if (viewData) {
        setLocalViewData(viewData as ViewData);
      }
      toast.error(`Failed to update sorting: ${error.message}`);
      // Only refetch on error to ensure data consistency
      void refetch();
    },
  });

  // Update hidden columns mutation
  const updateHiddenColumnsMutation = api.view.updateHiddenColumn.useMutation({
    onMutate: async ({ hiddenColumns }) => {
      // Optimistic update
      if (localViewData) {
        setLocalViewData({ ...localViewData, hiddenColumns });
      }
    },
    onError: (error) => {
      // Revert optimistic update
      if (viewData) {
        setLocalViewData(viewData as ViewData);
      }
      toast.error(`Failed to update column visibility: ${error.message}`);
      // Only refetch on error to ensure data consistency
      void refetch();
    },
  });

  // Update local state when view data changes
  useEffect(() => {
    if (viewData) {
      setLocalViewData(viewData as ViewData);
    }
  }, [viewData]);

  const viewActions = useCallback(
    (): ViewActions => ({
      updateFilters: async (filters: FilterConfig[]) => {
        await updateFilterMutation.mutateAsync({
          viewId,
          filter: filters,
        });
      },

      updateSorts: async (sorts: SortConfig[]) => {
        await updateSortMutation.mutateAsync({
          viewId,
          sort: sorts,
        });
      },

      updateHiddenColumns: async (hiddenColumns: string[]) => {
        await updateHiddenColumnsMutation.mutateAsync({
          viewId,
          hiddenColumns,
        });
      },
    }),
    [
      viewId,
      updateFilterMutation,
      updateSortMutation,
      updateHiddenColumnsMutation,
    ],
  );

  const error = queryError?.message ?? null;

  return {
    viewData: localViewData,
    viewActions: viewActions(),
    isLoading,
    error,
  };
}
