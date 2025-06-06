import { useMemo } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { QueryParams } from "./useTableData";
import type { Column } from "~/server/db/schema";
import { usePendingColumns } from "./usePendingColumns";

export interface TableColumn {
  id: string;
  name: string;
  type: "text" | "number";
  is_primary?: boolean;
}

export interface UseTableColumnsProps {
  tableId: string;
  baseId: string;
  queryParams: QueryParams;
  tableInfo?: { columns: Column[] } | null;
}

export interface ColumnActions {
  updateColumn: (columnId: string, name: string) => Promise<boolean>;
  deleteColumn: (columnId: string) => Promise<boolean>;
  addColumn: (name: string, type: "text" | "number") => Promise<string | null>;
}

export interface UseTableColumnsReturn {
  columnActions: ColumnActions;
  loading: string | null;
}

export function useTableColumns({
  tableId,
  baseId,
  queryParams,
  tableInfo,
}: UseTableColumnsProps): UseTableColumnsReturn {
  const utils = api.useUtils();
  const { addPendingColumn, markColumnReady, removePendingColumn } =
    usePendingColumns();

  // Helper function to invalidate all queries for this table
  const invalidateAllTableQueries = async () => {
    // Invalidate all getInfiniteTableData queries for this tableId
    await utils.data.getInfiniteTableData.invalidate({
      tableId,
    });
  };

  // Column mutations
  const updateColumnMutation = api.column.updateColumn.useMutation({
    onMutate: async ({ columnId, name }) => {
      await utils.data.getInfiniteTableData.cancel(queryParams);

      const previousData =
        utils.data.getInfiniteTableData.getInfiniteData(queryParams);

      if (previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          (oldData) => {
            if (!oldData) return oldData;

            const newPages = oldData.pages.map((page) => ({
              ...page,
              tableInfo: page.tableInfo
                ? {
                    ...page.tableInfo,
                    columns: page.tableInfo.columns.map((col) =>
                      col.id === columnId ? { ...col, name } : col,
                    ),
                  }
                : page.tableInfo,
            }));

            return {
              ...oldData,
              pages: newPages,
            };
          },
        );
      }

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          context.previousData,
        );
      }
      toast.error(`Failed to update column: ${error.message}`);
      // Only invalidate on error to ensure data consistency
      void invalidateAllTableQueries();
    },
  });

  const deleteColumnMutation = api.column.deleteColumn.useMutation({
    onMutate: async ({ columnId }) => {
      await utils.data.getInfiniteTableData.cancel(queryParams);

      const previousData =
        utils.data.getInfiniteTableData.getInfiniteData(queryParams);

      if (previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          (oldData) => {
            if (!oldData) return oldData;

            const newPages = oldData.pages.map((page) => ({
              ...page,
              tableInfo: page.tableInfo
                ? {
                    ...page.tableInfo,
                    columns: page.tableInfo.columns.filter(
                      (col) => col.id !== columnId,
                    ),
                  }
                : page.tableInfo,
              items: page.items.map((row) => {
                const newCells = { ...row.cells };
                delete newCells[columnId];
                return { ...row, cells: newCells };
              }),
            }));

            return {
              ...oldData,
              pages: newPages,
            };
          },
        );
      }

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          context.previousData,
        );
      }
      toast.error(`Failed to delete column: ${error.message}`);
      void invalidateAllTableQueries();
    },
  });

  const addColumnMutation = api.column.addColumn.useMutation({
    onMutate: async ({ name, type }) => {
      await utils.data.getInfiniteTableData.cancel(queryParams);

      const previousData =
        utils.data.getInfiniteTableData.getInfiniteData(queryParams);

      if (previousData && tableInfo) {
        const tempColumnId = `temp-col-${Date.now()}`;
        const now = new Date();

        // 🎯 Track this column as pending
        addPendingColumn(tempColumnId);

        // Create a temporary column with all required fields
        const newColumn = {
          id: tempColumnId,
          name,
          type,
          created_at: now,
          updated_at: now,
          base_id: baseId,
          table_id: tableId,
          position: tableInfo.columns.length,
          is_visible: true,
          is_primary: false,
          sort: "asc" as const,
        };

        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          (oldData) => {
            if (!oldData) return oldData;

            const newPages = oldData.pages.map((page) => ({
              ...page,
              tableInfo: page.tableInfo
                ? {
                    ...page.tableInfo,
                    columns: [...page.tableInfo.columns, newColumn],
                  }
                : page.tableInfo,
              items: page.items.map((row) => ({
                ...row,
                cells: { ...row.cells, [tempColumnId]: "" },
              })),
            }));

            return {
              ...oldData,
              pages: newPages,
            };
          },
        );

        return { previousData, tempColumnId };
      }

      return { previousData };
    },
    onSuccess: async (result, _, context) => {
      // 🎯 Mark column as ready with real ID
      if (context?.tempColumnId) {
        markColumnReady(context.tempColumnId, result.id);
      }

      // ⚠️ KEEPING: Column creation is a structural change affecting all rows and views
      // This invalidation ensures data consistency across all table components
      await invalidateAllTableQueries();
    },
    onError: (error, _, context) => {
      // 🎯 Remove from pending on error
      if (context?.tempColumnId) {
        removePendingColumn(context.tempColumnId);
      }

      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          context.previousData,
        );
      }
      toast.error(`Failed to add column: ${error.message}`);
      void invalidateAllTableQueries();
    },
  });

  const columnActions = useMemo(
    (): ColumnActions => ({
      updateColumn: async (
        columnId: string,
        name: string,
      ): Promise<boolean> => {
        try {
          await updateColumnMutation.mutateAsync({
            columnId,
            name,
          });
          return true;
        } catch (error) {
          console.error("Failed to update column:", error);
          return false;
        }
      },

      deleteColumn: async (columnId: string): Promise<boolean> => {
        try {
          await deleteColumnMutation.mutateAsync({ columnId });
          return true;
        } catch (error) {
          console.error("Failed to delete column:", error);
          return false;
        }
      },

      addColumn: async (
        name: string,
        type: "text" | "number",
      ): Promise<string | null> => {
        try {
          const result = await addColumnMutation.mutateAsync({
            tableId,
            name,
            type,
          });
          return result.id;
        } catch (error) {
          console.error("Failed to add column:", error);
          return null;
        }
      },
    }),
    [updateColumnMutation, deleteColumnMutation, addColumnMutation, tableId],
  );

  // Calculate loading state for column operations
  const loading = useMemo(() => {
    if (updateColumnMutation.isPending) {
      return "Updating column...";
    }
    if (deleteColumnMutation.isPending) {
      return "Deleting column...";
    }
    if (addColumnMutation.isPending) {
      return "Adding column...";
    }
    return null;
  }, [
    updateColumnMutation.isPending,
    deleteColumnMutation.isPending,
    addColumnMutation.isPending,
  ]);

  return {
    columnActions,
    loading,
  };
}
