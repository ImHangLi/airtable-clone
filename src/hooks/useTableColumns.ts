import { useMemo } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { QueryParams } from "./useTableData";
import type { Column } from "~/server/db/schema";

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
      // 🎯 Only revert optimistic update on error
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          context.previousData,
        );
      }
      toast.error(`Failed to update column: ${error.message}`);
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
      // 🎯 Only revert optimistic update on error
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          context.previousData,
        );
      }
      toast.error(`Failed to delete column: ${error.message}`);
    },
  });

  const addColumnMutation = api.column.addColumn.useMutation({
    onMutate: async ({ name, type }) => {
      await utils.data.getInfiniteTableData.cancel(queryParams);

      const previousData =
        utils.data.getInfiniteTableData.getInfiniteData(queryParams);

      if (previousData && tableInfo) {
        const tempColumnId = crypto.randomUUID();
        const now = new Date();

        // 🎯 Create a temporary column for optimistic update
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
    onError: (error, _, context) => {
      // 🎯 Only revert optimistic update on error
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          context.previousData,
        );
      }
      toast.error(`Failed to add column: ${error.message}`);
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
          // 🎯 Optimistic update + server reliability via exponential backoff
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
