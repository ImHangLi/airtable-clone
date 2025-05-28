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
  loading: string | null;
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
    onSuccess: () => {
      toast.success("Row created successfully");
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
    onSuccess: () => {
      toast.success("Cell updated successfully");
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
    onSuccess: () => {
      toast.success("Row deleted successfully");
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
    onMutate: async ({ columnId, name }) => {
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
    onSuccess: () => {
      toast.success("Column updated successfully");
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
    onMutate: async ({ columnId }) => {
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
    onSuccess: () => {
      toast.success("Column deleted successfully");
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
    onMutate: async ({ name, type }) => {
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
        const tempColumnId = `temp-col-${Date.now()}`;
        const now = new Date();

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
          sort: "asc" as const,
        };

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
      }

      return { previousData };
    },
    onSuccess: () => {
      toast.success("Column added successfully");
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

    if (isInitialLoading) {
      return "Loading table...";
    }

    // Check for specific mutation loading states
    if (createRowMutation.isPending) {
      return "Adding row...";
    }
    if (updateCellMutation.isPending) {
      return "Updating cell...";
    }
    if (updateColumnMutation.isPending) {
      return "Updating column...";
    }
    if (deleteColumnMutation.isPending) {
      return "Deleting column...";
    }
    if (deleteRowMutation.isPending) {
      return "Deleting row...";
    }
    if (addColumnMutation.isPending) {
      return "Adding column...";
    }

    return null;
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
