import { useMemo } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { Column } from "~/server/db/schema";
import type { QueryParams } from "./useTableData";
import { usePendingColumns } from "./usePendingColumns";

export interface TableRow {
  id: string;
  cells: Record<string, string | number>;
}

export interface UseTableRowsProps {
  tableId: string;
  baseId: string;
  queryParams: QueryParams;
  tableInfo?: { columns: Column[] } | null;
}

export interface RowActions {
  addRow: () => Promise<string | null>;
  addRowWithCellValues: (
    cellValues: Record<string, string | number>,
  ) => Promise<string | null>;
  updateCell: (
    rowId: string,
    columnId: string,
    value: string | number,
  ) => Promise<boolean>;
  deleteRow: (rowId: string) => Promise<boolean>;
}

export interface UseTableRowsReturn {
  rowActions: RowActions;
  loading: string | null;
}

export function useTableRows({
  tableId,
  baseId,
  queryParams,
  tableInfo,
}: UseTableRowsProps): UseTableRowsReturn {
  const utils = api.useUtils();
  const { isColumnPending, waitForColumn } = usePendingColumns();

  // Helper function to invalidate all queries for this table
  const invalidateAllTableQueries = async () => {
    // Invalidate all getInfiniteTableData queries for this tableId
    await utils.data.getInfiniteTableData.invalidate({
      tableId,
    });
  };

  // Row mutations
  const createRowMutation = api.row.createRow.useMutation({
    onMutate: async () => {
      await utils.data.getInfiniteTableData.cancel(queryParams);

      const previousData =
        utils.data.getInfiniteTableData.getInfiniteData(queryParams);

      if (previousData && tableInfo) {
        const tempRowId = `temp-${Date.now()}`;
        const emptyCells: Record<string, string | number> = {};

        tableInfo.columns.forEach((column: Column) => {
          emptyCells[column.id] = "";
        });

        const newRow = { id: tempRowId, cells: emptyCells };

        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          (oldData) => {
            if (!oldData) return oldData;

            const newPages = [...oldData.pages];
            if (newPages[0]) {
              newPages[0] = {
                ...newPages[0],
                items: [...newPages[0].items, newRow],
              };
            }

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
      toast.error(`Failed to create row: ${error.message}`);
      void invalidateAllTableQueries();
    },
  });

  const createRowWithCellValuesMutation =
    api.row.createRowWithCellValues.useMutation({
      onMutate: async ({ cellValues }) => {
        await utils.data.getInfiniteTableData.cancel(queryParams);

        const previousData =
          utils.data.getInfiniteTableData.getInfiniteData(queryParams);

        if (previousData && tableInfo) {
          const tempRowId = `temp-${Date.now()}`;
          utils.data.getInfiniteTableData.setInfiniteData(
            queryParams,
            (oldData) => {
              if (!oldData) return oldData;

              const newPages = [...oldData.pages];
              if (newPages[0]) {
                newPages[0] = {
                  ...newPages[0],
                  items: [
                    ...newPages[0].items,
                    { id: tempRowId, cells: cellValues },
                  ],
                };
              }

              return {
                ...oldData,
                pages: newPages,
              };
            },
          );
        }

        return { previousData };
      },
      onSuccess: async () => {
        await invalidateAllTableQueries();
      },
      onError: (error, _, context) => {
        if (context?.previousData) {
          utils.data.getInfiniteTableData.setInfiniteData(
            queryParams,
            context.previousData,
          );
        }
        toast.error(`Failed to create row with cell values: ${error.message}`);
        void invalidateAllTableQueries();
      },
    });

  const updateCellMutation = api.cell.updateCell.useMutation({
    onMutate: async ({ rowId, columnId, value }) => {
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
              items: page.items.map((row) =>
                row.id === rowId
                  ? { ...row, cells: { ...row.cells, [columnId]: value } }
                  : row,
              ),
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
      toast.error(`Failed to update cell: ${error.message}`);
      // Only invalidate on error to ensure data consistency
      void invalidateAllTableQueries();
    },
  });

  const deleteRowMutation = api.row.deleteRow.useMutation({
    onMutate: async ({ rowId }) => {
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
              items: page.items.filter((row) => row.id !== rowId),
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
      toast.error(`Failed to delete row: ${error.message}`);
      void invalidateAllTableQueries();
    },
  });

  const rowActions = useMemo(
    (): RowActions => ({
      addRow: async (): Promise<string | null> => {
        try {
          const result = await createRowMutation.mutateAsync({
            tableId,
            baseId,
          });
          return result.id;
        } catch (error) {
          console.error("Failed to add row:", error);
          return null;
        }
      },

      addRowWithCellValues: async (
        cellValues: Record<string, string | number>,
      ): Promise<string | null> => {
        try {
          // 🎯 Check if any columns are pending and wait for them
          const pendingColumns = Object.keys(cellValues).filter(
            (columnId) => columnId !== "baseId" && isColumnPending(columnId),
          );

          if (pendingColumns.length > 0) {
            // Wait for all pending columns to be ready
            const realColumnIds = await Promise.all(
              pendingColumns.map((columnId) => waitForColumn(columnId)),
            );

            // Map temp column IDs to real column IDs
            const updatedCellValues = { ...cellValues };
            pendingColumns.forEach((tempId, index) => {
              const realId = realColumnIds[index];
              if (
                realId &&
                realId !== tempId &&
                updatedCellValues[tempId] !== undefined
              ) {
                updatedCellValues[realId] = updatedCellValues[tempId]!;
                delete updatedCellValues[tempId];
              }
            });

            const result = await createRowWithCellValuesMutation.mutateAsync({
              tableId,
              cellValues: { ...updatedCellValues, baseId },
            });
            return result.id;
          } else {
            // Normal flow - no pending columns
            const result = await createRowWithCellValuesMutation.mutateAsync({
              tableId,
              cellValues: { ...cellValues, baseId },
            });
            return result.id;
          }
        } catch (error) {
          console.error("Failed to add row with cell values:", error);
          return null;
        }
      },

      updateCell: async (
        rowId: string,
        columnId: string,
        value: string | number,
      ): Promise<boolean> => {
        try {
          // 🎯 Check if column is pending creation
          if (isColumnPending(columnId)) {
            // Optimistic update already happened, now wait for column then update server
            const realColumnId = await waitForColumn(columnId);
            await updateCellMutation.mutateAsync({
              rowId,
              columnId: realColumnId,
              value,
              baseId,
            });
          } else {
            // Normal flow - column exists
            await updateCellMutation.mutateAsync({
              rowId,
              columnId,
              value,
              baseId,
            });
          }
          return true;
        } catch (error) {
          console.error("Failed to update cell:", error);
          return false;
        }
      },

      deleteRow: async (rowId: string): Promise<boolean> => {
        try {
          await deleteRowMutation.mutateAsync({ rowId });
          return true;
        } catch (error) {
          console.error("Failed to delete row:", error);
          return false;
        }
      },
    }),
    [
      createRowMutation,
      tableId,
      baseId,
      isColumnPending,
      createRowWithCellValuesMutation,
      waitForColumn,
      updateCellMutation,
      deleteRowMutation,
    ],
  );

  // Calculate loading state for row operations
  const loading = useMemo(() => {
    if (createRowMutation.isPending) {
      return "Adding row...";
    }
    if (updateCellMutation.isPending) {
      return "Updating cell...";
    }
    if (deleteRowMutation.isPending) {
      return "Deleting row...";
    }
    return null;
  }, [
    createRowMutation.isPending,
    updateCellMutation.isPending,
    deleteRowMutation.isPending,
  ]);

  return {
    rowActions,
    loading,
  };
}
