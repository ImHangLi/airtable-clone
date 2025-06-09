import { useMemo } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { Column } from "~/server/db/schema";
import type { QueryParams } from "./useTableData";

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

  // Row mutations - OPTIMIZED for instant UI feedback
  const createRowMutation = api.row.createRow.useMutation({
    onMutate: async ({ rowId }) => {
      await utils.data.getInfiniteTableData.cancel(queryParams);

      const previousData =
        utils.data.getInfiniteTableData.getInfiniteData(queryParams);

      if (previousData && tableInfo) {
        // Use the rowId passed from the client (already generated)
        const tempRowId = rowId ?? crypto.randomUUID(); // Fallback if not provided
        const emptyCells: Record<string, string | number> = {};

        tableInfo.columns.forEach((column: Column) => {
          emptyCells[column.id] = "";
        });

        const newRow = { id: tempRowId, cells: emptyCells };

        // PERFORMANCE: Add row to END of list for immediate visibility
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          (oldData) => {
            if (!oldData) return oldData;

            const newPages = [...oldData.pages];
            // Add to the LAST page so user sees it immediately at bottom
            const lastPageIndex = newPages.length - 1;
            if (newPages[lastPageIndex]) {
              newPages[lastPageIndex] = {
                ...newPages[lastPageIndex],
                items: [...newPages[lastPageIndex].items, newRow],
              };
            } else if (newPages[0]) {
              // Fallback to first page if no last page
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
    onSuccess: () => {
      // SUCCESS: Row created successfully - no additional action needed thanks to optimistic update
      console.log("Row created successfully");
    },
    onError: (error, _, context) => {
      // 🎯 Only revert optimistic update on error, trust retries will handle transient issues
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          context.previousData,
        );
      }
      toast.error(`Failed to create row: ${error.message}`);
    },
  });

  const createRowWithCellValuesMutation =
    api.row.createRowWithCellValues.useMutation({
      onSuccess: async () => {
        await utils.data.getInfiniteTableData.invalidate(queryParams);
        console.log("Row with cell values created successfully");
      },
      onError: (error) => {
        toast.error(`Failed to create row with cell values: ${error.message}`);
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
    onSuccess: (result) => {
      // 🎯 Optimistic update succeeded! Log attempt count but trust the update
      if (result.attempts > 1) {
        console.log(`Cell update succeeded after ${result.attempts} attempts`);
      }
      // No invalidation needed - trust our optimistic update + server success
    },
    onError: (error, _, context) => {
      // 🎯 Only revert optimistic update on permanent failure
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          context.previousData,
        );
      }

      // Enhanced error message that accounts for retry attempts
      const errorMessage = error.message.includes("multiple attempts")
        ? "Cell update failed after multiple retries - please try again"
        : `Failed to update cell: ${error.message}`;

      toast.error(errorMessage);
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
    onSuccess: () => {
      // 🎯 Optimistic delete succeeded! Trust exponential backoff - no invalidation needed
      console.log("Row deleted successfully");
    },
    onError: (error, _, context) => {
      // 🎯 Only revert optimistic update on error
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          queryParams,
          context.previousData,
        );
      }
      toast.error(`Failed to delete row: ${error.message}`);
    },
  });

  const rowActions = useMemo(
    (): RowActions => ({
      addRow: async (): Promise<string | null> => {
        try {
          const rowId = crypto.randomUUID();

          const result = await createRowMutation.mutateAsync({
            tableId,
            baseId,
            rowId,
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
          const rowId = crypto.randomUUID();

          const result = await createRowWithCellValuesMutation.mutateAsync({
            tableId,
            rowId,
            cellValues: { ...cellValues, baseId },
          });
          return result.id;
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
          // 🎯 Simplified! Server-side exponential backoff handles column readiness
          const result = await updateCellMutation.mutateAsync({
            rowId,
            columnId,
            value,
            baseId,
          });

          // Log if multiple attempts were needed
          if (result.attempts > 1) {
            console.log(`Cell update required ${result.attempts} attempts`);
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
      createRowWithCellValuesMutation,
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
