import { useMemo } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { useDebounce } from "./useDebounce";
import type { Column } from "~/server/db/schema";

export interface SortConfig {
  id: string;
  desc: boolean;
}

export interface TableColumn {
  id: string;
  name: string;
  type: "text" | "number";
}

export interface TableRow {
  id: string;
  cells: Record<string, string | number>;
}

export interface TableData {
  name: string;
  columns: TableColumn[];
  rows: TableRow[];
  totalRows: number;
  totalDBRowCount: number;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetching?: boolean;
  isFetchingNextPage?: boolean;
  isSearchResult?: boolean;
}

export interface TableActions {
  addRow: () => Promise<string | null>;
  updateCell: (
    rowId: string,
    columnId: string,
    value: string | number,
  ) => Promise<boolean>;
  updateColumn: (columnId: string, name: string) => Promise<boolean>;
  deleteColumn: (columnId: string) => Promise<boolean>;
  addColumn: (name: string, type: "text" | "number") => Promise<string | null>;
  deleteRow: (rowId: string) => Promise<boolean>;
  refetch: () => void;
}

interface UseTableDataProps {
  tableId: string;
  baseId: string;
  search?: string;
  sorting?: SortConfig[];
}

interface UseTableDataReturn {
  loading: boolean;
  error: string | null;
  tableData: TableData | null;
  tableActions: TableActions;
}

export function useTableData({
  tableId,
  baseId,
  search,
  sorting,
}: UseTableDataProps): UseTableDataReturn {
  const utils = api.useUtils();

  const debouncedSearch = useDebounce(search?.trim() ?? "", 500);
  const hasSearch = Boolean(debouncedSearch);

  // Use tRPC's useInfiniteQuery for proper pagination
  const infiniteQuery = api.data.getInfiniteTableData.useInfiniteQuery(
    {
      tableId,
      limit: hasSearch ? 50 : 150,
      sorting,
      search: hasSearch ? debouncedSearch : undefined,
    },
    {
      enabled: !!tableId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      retry: (failureCount: number) => failureCount < 2,
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  );

  // Flatten all pages into a single array of rows
  const allRows = useMemo(() => {
    if (!infiniteQuery.data?.pages) return [];
    return infiniteQuery.data.pages.flatMap((page) => page.items);
  }, [infiniteQuery.data?.pages]);

  // Get table info from first page
  const tableInfo = infiniteQuery.data?.pages[0]?.tableInfo;
  const totalRowCount = infiniteQuery.data?.pages[0]?.totalRowCount ?? 0;
  const isSearchResult = infiniteQuery.data?.pages[0]?.isSearchResult ?? false;

  // Mutations for table operations
  const createRowMutation = api.row.createRow.useMutation({
    onMutate: async () => {
      await utils.data.getInfiniteTableData.cancel({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });

      const previousData = utils.data.getInfiniteTableData.getInfiniteData({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });

      if (previousData && tableInfo) {
        const tempRowId = `temp-${Date.now()}`;
        const emptyCells: Record<string, string | number> = {};

        tableInfo.columns.forEach((column: Column) => {
          emptyCells[column.id] = "";
        });

        const newRow = { id: tempRowId, cells: emptyCells };

        utils.data.getInfiniteTableData.setInfiniteData(
          {
            tableId,
            limit: hasSearch ? 50 : 150,
            sorting,
            search: hasSearch ? debouncedSearch : undefined,
          },
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
          {
            tableId,
            limit: hasSearch ? 50 : 150,
            sorting,
            search: hasSearch ? debouncedSearch : undefined,
          },
          context.previousData,
        );
      }
      toast.error(`Failed to create row: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });
    },
  });

  const updateCellMutation = api.cell.updateCell.useMutation({
    onMutate: async ({ rowId, columnId, value }) => {
      await utils.data.getInfiniteTableData.cancel({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });

      const previousData = utils.data.getInfiniteTableData.getInfiniteData({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });

      if (previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          {
            tableId,
            limit: hasSearch ? 50 : 150,
            sorting,
            search: hasSearch ? debouncedSearch : undefined,
          },
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
          {
            tableId,
            limit: hasSearch ? 50 : 150,
            sorting,
            search: hasSearch ? debouncedSearch : undefined,
          },
          context.previousData,
        );
      }
      toast.error(`Failed to update cell: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });
    },
  });

  const deleteRowMutation = api.row.deleteRow.useMutation({
    onMutate: async ({ rowId }) => {
      await utils.data.getInfiniteTableData.cancel({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });

      const previousData = utils.data.getInfiniteTableData.getInfiniteData({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });

      if (previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          {
            tableId,
            limit: hasSearch ? 50 : 150,
            sorting,
            search: hasSearch ? debouncedSearch : undefined,
          },
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
          {
            tableId,
            limit: hasSearch ? 50 : 150,
            sorting,
            search: hasSearch ? debouncedSearch : undefined,
          },
          context.previousData,
        );
      }
      toast.error(`Failed to delete row: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });
    },
  });

  const updateColumnMutation = api.column.updateColumn.useMutation({
    onError: (error) => {
      toast.error(`Failed to update column: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });
    },
  });

  const deleteColumnMutation = api.column.deleteColumn.useMutation({
    onError: (error) => {
      toast.error(`Failed to delete column: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });
    },
  });

  const addColumnMutation = api.column.addColumn.useMutation({
    onError: (error) => {
      toast.error(`Failed to add column: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({
        tableId,
        limit: hasSearch ? 50 : 150,
        sorting,
        search: hasSearch ? debouncedSearch : undefined,
      });
    },
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
      })),
      rows: allRows,
      totalRows: allRows.length,
      totalDBRowCount: totalRowCount,
      hasNextPage: infiniteQuery.hasNextPage,
      fetchNextPage: () => void infiniteQuery.fetchNextPage(),
      isFetching: infiniteQuery.isFetching,
      isFetchingNextPage: infiniteQuery.isFetchingNextPage,
      isSearchResult,
    };
  }, [tableInfo, allRows, totalRowCount, isSearchResult, infiniteQuery]);

  const tableActions = useMemo(
    (): TableActions => ({
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

      updateCell: async (
        rowId: string,
        columnId: string,
        value: string | number,
      ): Promise<boolean> => {
        try {
          await updateCellMutation.mutateAsync({
            rowId,
            columnId,
            value,
            baseId,
          });
          return true;
        } catch (error) {
          console.error("Failed to update cell:", error);
          return false;
        }
      },

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

      deleteRow: async (rowId: string): Promise<boolean> => {
        try {
          await deleteRowMutation.mutateAsync({ rowId });
          return true;
        } catch (error) {
          console.error("Failed to delete row:", error);
          return false;
        }
      },

      refetch: () => {
        void infiniteQuery.refetch();
      },
    }),
    [
      createRowMutation,
      updateCellMutation,
      updateColumnMutation,
      deleteRowMutation,
      infiniteQuery,
      tableId,
      baseId,
      addColumnMutation,
      deleteColumnMutation,
    ],
  );

  // Calculate loading state
  const loading = useMemo(() => {
    const isInitialLoading = infiniteQuery.isPending && !infiniteQuery.data;
    const isMutating =
      createRowMutation.isPending ||
      updateCellMutation.isPending ||
      updateColumnMutation.isPending ||
      deleteColumnMutation.isPending ||
      deleteRowMutation.isPending ||
      addColumnMutation.isPending;

    return isInitialLoading || isMutating;
  }, [
    infiniteQuery.isPending,
    infiniteQuery.data,
    createRowMutation.isPending,
    updateCellMutation.isPending,
    updateColumnMutation.isPending,
    deleteColumnMutation.isPending,
    deleteRowMutation.isPending,
    addColumnMutation.isPending,
  ]);

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
