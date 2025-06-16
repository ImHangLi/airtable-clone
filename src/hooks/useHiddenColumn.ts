import { useState, useCallback, useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { TableColumn } from "./useTableData";
import {
  toggleHiddenColumn,
  showAllColumns,
  getVisibleColumns,
} from "~/types/hiddenColumn";
import type { ViewActions } from "./useViewData";

interface UseHiddenColumnProps {
  viewId: string;
  columns: TableColumn[];
  viewActions?: ViewActions;
  autoSave?: boolean;
  initialHiddenColumns?: string[];
}

interface UseHiddenColumnReturn {
  hiddenColumns: string[];
  visibleColumns: TableColumn[];
  isColumnVisible: (columnId: string) => boolean;
  toggleColumn: (columnId: string) => void;
  hideColumn: (columnId: string) => void;
  showColumn: (columnId: string) => void;
  showAllColumns: () => void;
  hideAllColumns: () => void;
  setHiddenColumns: (columns: string[]) => void;
  isLoading: boolean;
  isSaving: boolean;
  loading: string | null;
}

export function useHiddenColumn({
  viewId,
  columns,
  viewActions,
  autoSave = true,
  initialHiddenColumns = [],
}: UseHiddenColumnProps): UseHiddenColumnReturn {
  const [hiddenColumns, setHiddenColumns] =
    useState<string[]>(initialHiddenColumns);
  const [isSaving, setIsSaving] = useState(false);

  // Get view configuration (fallback if viewActions not provided)
  const { data: view, isLoading } = api.view.getView.useQuery(
    { viewId },
    {
      enabled: !!viewId && !viewActions, // Only query if viewActions not provided and tableId available
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    },
  );

  // Update column visibility mutation (fallback if viewActions not provided)
  const updateVisibilityMutation = api.view.updateHiddenColumn.useMutation({
    onMutate: async ({ hiddenColumns: newHiddenColumns }) => {
      // Optimistic update
      setHiddenColumns(newHiddenColumns);
      setIsSaving(true);
    },
    onSuccess: () => {
      setIsSaving(false);
    },
    onError: (error) => {
      // Revert optimistic update on error
      if (view?.hiddenColumns) {
        setHiddenColumns(view.hiddenColumns);
      }
      setIsSaving(false);
      toast.error(`Failed to update column visibility: ${error.message}`);
    },
  });

  // Calculate loading state similar to useTableData
  const loading = useMemo(() => {
    const isInitialLoading = isLoading && !view && !viewActions;

    if (isInitialLoading) {
      return "Loading view...";
    }

    // Check for visibility mutation loading state
    if (updateVisibilityMutation.isPending) {
      return "Updating column visibility...";
    }

    return null;
  }, [isLoading, view, viewActions, updateVisibilityMutation.isPending]);

  // Update local state when view config changes
  useEffect(() => {
    if (view?.hiddenColumns) {
      setHiddenColumns(view.hiddenColumns);
    }
  }, [view?.hiddenColumns]);

  const saveVisibility = useCallback(
    async (newHiddenColumns: string[]) => {
      if (viewActions) {
        // Use viewActions if provided
        await viewActions.updateHiddenColumns(newHiddenColumns);
      } else {
        // Fallback to direct mutation
        updateVisibilityMutation.mutate({
          viewId,
          hiddenColumns: newHiddenColumns,
        });
      }
    },
    [viewId, updateVisibilityMutation, viewActions],
  );

  const toggleColumn = useCallback(
    (columnId: string) => {
      // Prevent hiding primary columns
      const column = columns.find((col) => col.id === columnId);
      if (column?.is_primary) {
        toast.error("Cannot hide primary field");
        return;
      }

      const newHiddenColumns = toggleHiddenColumn(columnId, hiddenColumns);
      setHiddenColumns(newHiddenColumns);

      if (autoSave) {
        void saveVisibility(newHiddenColumns);
      }
    },
    [hiddenColumns, saveVisibility, autoSave, columns],
  );

  const hideColumn = useCallback(
    (columnId: string) => {
      // Prevent hiding primary columns
      const column = columns.find((col) => col.id === columnId);
      if (column?.is_primary) {
        toast.error("Cannot hide primary field");
        return;
      }

      if (!hiddenColumns.includes(columnId)) {
        const newHiddenColumns = [...hiddenColumns, columnId];
        setHiddenColumns(newHiddenColumns);

        if (autoSave) {
          void saveVisibility(newHiddenColumns);
        }
      }
    },
    [hiddenColumns, saveVisibility, autoSave, columns],
  );

  const showColumn = useCallback(
    (columnId: string) => {
      const newHiddenColumns = hiddenColumns.filter((id) => id !== columnId);
      setHiddenColumns(newHiddenColumns);

      if (autoSave) {
        void saveVisibility(newHiddenColumns);
      }
    },
    [hiddenColumns, saveVisibility, autoSave],
  );

  const showAllColumnsHandler = useCallback(() => {
    const newHiddenColumns = showAllColumns();
    setHiddenColumns(newHiddenColumns);

    if (autoSave) {
      void saveVisibility(newHiddenColumns);
    }
  }, [saveVisibility, autoSave]);

  const hideAllColumnsHandler = useCallback(() => {
    // Only hide non-primary columns - primary columns should always remain visible
    const newHiddenColumns = columns
      .filter((column) => !column.is_primary)
      .map((column) => column.id);
    setHiddenColumns(newHiddenColumns);

    if (autoSave) {
      void saveVisibility(newHiddenColumns);
    }
  }, [columns, saveVisibility, autoSave]);

  const setHiddenColumnsHandler = useCallback(
    (newHiddenColumns: string[]) => {
      // Filter out any primary columns from the hidden list
      const primaryColumnIds = columns
        .filter((col) => col.is_primary)
        .map((col) => col.id);
      const filteredHiddenColumns = newHiddenColumns.filter(
        (id) => !primaryColumnIds.includes(id),
      );

      setHiddenColumns(filteredHiddenColumns);

      if (autoSave) {
        void saveVisibility(filteredHiddenColumns);
      }
    },
    [saveVisibility, autoSave, columns],
  );

  const isColumnVisible = useCallback(
    (columnId: string) => !hiddenColumns.includes(columnId),
    [hiddenColumns],
  );

  const visibleColumns = getVisibleColumns(columns, hiddenColumns);

  return {
    hiddenColumns,
    visibleColumns,
    isColumnVisible,
    toggleColumn,
    hideColumn,
    showColumn,
    showAllColumns: showAllColumnsHandler,
    hideAllColumns: hideAllColumnsHandler,
    setHiddenColumns: setHiddenColumnsHandler,
    isLoading,
    isSaving,
    loading,
  };
}
