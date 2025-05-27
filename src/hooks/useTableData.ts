import { useMemo } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { Column } from "~/server/db/schema";
import { useDebounce } from "./useDebounce";

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
  search?: string; // Add search parameter
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
}: UseTableDataProps): UseTableDataReturn {
  const utils = api.useUtils();

  const debouncedSearch = useDebounce(search?.trim() ?? "", 500);
  const hasSearch = Boolean(debouncedSearch);

  // Normal table data query
  const infiniteTableQuery = api.data.getInfiniteTableData.useInfiniteQuery(
    {
      tableId,
      limit: 100,
    },
    {
      enabled: !!tableId && !hasSearch, // Only enabled when not searching
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      retry: (failureCount) => failureCount < 2,
      // Keep previous data to avoid loading states during transitions
      // Instant background updates for immediate transitions
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  );

  // Search query
  const searchQuery = api.data.searchTableData.useInfiniteQuery(
    {
      tableId,
      search: debouncedSearch,
      limit: 30,
    },
    {
      enabled: !!tableId && hasSearch, // Only enabled when searching
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      retry: (failureCount) => failureCount < 2,
      // Keep previous data to avoid loading states during transitions
      // Instant background updates for immediate transitions
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  );

  const createRowMutation = api.row.createRow.useMutation({
    onMutate: async ({ tableId }) => {
      await utils.data.getInfiniteTableData.cancel({
        tableId,
        limit: 100,
      });

      const previousData = utils.data.getInfiniteTableData.getInfiniteData({
        tableId,
        limit: 100,
      });

      if (previousData && previousData.pages.length > 0) {
        const tempRowId = `temp-${Date.now()}`;

        const emptyCells: Record<string, string | number> = {};
        const firstPage = previousData.pages[0];
        if (firstPage?.tableInfo.columns) {
          firstPage.tableInfo.columns.forEach((column) => {
            emptyCells[column.id] = "";
          });
        }

        const newRow = {
          id: tempRowId,
          cells: emptyCells,
        };

        const updatedPages = [...previousData.pages];
        const lastPageIndex = updatedPages.length - 1;
        if (lastPageIndex >= 0) {
          updatedPages[lastPageIndex] = {
            ...updatedPages[lastPageIndex]!,
            rows: [...updatedPages[lastPageIndex]!.rows, newRow],
          };
        }

        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          {
            ...previousData,
            pages: updatedPages,
          },
        );
      }

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          context.previousData,
        );
      }
      toast.error(`Failed to create row: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({
        tableId,
        limit: 100,
      });
    },
  });

  const updateCellMutation = api.cell.updateCell.useMutation({
    onMutate: async ({ rowId, columnId, value }) => {
      await utils.data.getInfiniteTableData.cancel({ tableId, limit: 100 });

      const previousData = utils.data.getInfiniteTableData.getInfiniteData({
        tableId,
        limit: 100,
      });

      if (previousData) {
        const updatedPages = previousData.pages.map((page) => ({
          ...page,
          rows: page.rows.map((row) =>
            row.id === rowId
              ? {
                  ...row,
                  cells: {
                    ...row.cells,
                    [columnId]: value,
                  },
                }
              : row,
          ),
        }));

        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          {
            ...previousData,
            pages: updatedPages,
          },
        );
      }

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          context.previousData,
        );
      }
      toast.error(`Failed to update cell: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({ tableId, limit: 100 });
    },
  });

  const deleteRowMutation = api.row.deleteRow.useMutation({
    onMutate: async ({ rowId }) => {
      await utils.data.getInfiniteTableData.cancel({ tableId, limit: 100 });

      const previousData = utils.data.getInfiniteTableData.getInfiniteData({
        tableId,
        limit: 100,
      });

      if (previousData) {
        const updatedPages = previousData.pages.map((page) => ({
          ...page,
          rows: page.rows.filter((row) => row.id !== rowId),
        }));

        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          {
            ...previousData,
            pages: updatedPages,
          },
        );
      }

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          context.previousData,
        );
      }
      toast.error(`Failed to delete row: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({ tableId, limit: 100 });
    },
  });

  const updateColumnMutation = api.column.updateColumn.useMutation({
    onMutate: async ({ columnId, name }) => {
      await utils.data.getInfiniteTableData.cancel({ tableId, limit: 100 });

      const previousData = utils.data.getInfiniteTableData.getInfiniteData({
        tableId,
        limit: 100,
      });

      if (previousData) {
        const updatedPages = previousData.pages.map((page) => ({
          ...page,
          tableInfo: {
            ...page.tableInfo,
            columns: page.tableInfo.columns.map((col) =>
              col.id === columnId ? { ...col, name } : col,
            ),
          },
        }));

        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          {
            ...previousData,
            pages: updatedPages,
          },
        );
      }

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          context.previousData,
        );
      }
      toast.error(`Failed to update column: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({ tableId, limit: 100 });
    },
  });

  const deleteColumnMutation = api.column.deleteColumn.useMutation({
    onMutate: async ({ columnId }) => {
      await utils.data.getInfiniteTableData.cancel({ tableId, limit: 100 });

      const previousData = utils.data.getInfiniteTableData.getInfiniteData({
        tableId,
        limit: 100,
      });

      if (previousData) {
        const updatedPages = previousData.pages.map((page) => ({
          ...page,
          tableInfo: {
            ...page.tableInfo,
            columns: page.tableInfo.columns.filter(
              (col) => col.id !== columnId,
            ),
          },
          rows: page.rows.map((row) => {
            const { ...remainingCells } = row.cells;
            return {
              ...row,
              cells: remainingCells,
            };
          }),
        }));

        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          {
            ...previousData,
            pages: updatedPages,
          },
        );
      }

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          context.previousData,
        );
      }
      toast.error(`Failed to delete column: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({ tableId, limit: 100 });
    },
  });

  const addColumnMutation = api.column.addColumn.useMutation({
    onMutate: async ({ name, type }) => {
      await utils.data.getInfiniteTableData.cancel({ tableId, limit: 100 });

      const currentData = utils.data.getInfiniteTableData.getInfiniteData({
        tableId,
        limit: 100,
      });

      if (currentData && currentData.pages.length > 0) {
        const tempColumnId = `temp-col-${Date.now()}`;

        const updatedPages = currentData.pages.map((page) => ({
          ...page,
          tableInfo: {
            ...page.tableInfo,
            columns: [
              ...page.tableInfo.columns,
              {
                id: tempColumnId,
                name,
                type,
                created_at: new Date(),
                updated_at: new Date(),
                base_id: page.tableInfo.columns[0]?.base_id ?? "",
                table_id: page.tableInfo.columns[0]?.table_id ?? "",
                position: page.tableInfo.columns.length,
                is_visible: true,
                sort: "asc" as const,
              },
            ],
          },
          rows: page.rows.map((row) => ({
            ...row,
            cells: {
              ...row.cells,
              [tempColumnId]: "",
            },
          })),
        }));

        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          {
            ...currentData,
            pages: updatedPages,
          },
        );
      }

      return {
        previousData: currentData,
      };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        utils.data.getInfiniteTableData.setInfiniteData(
          { tableId, limit: 100 },
          context.previousData,
        );
      }
      toast.error(`Failed to add column: ${error.message}`);
    },
    onSettled: () => {
      void utils.data.getInfiniteTableData.invalidate({ tableId, limit: 100 });
    },
  });

  // Transform infinite data to our clean format
  const tableData = useMemo((): TableData | null => {
    // Use search query if searching, otherwise use normal query
    const activeQuery = hasSearch ? searchQuery : infiniteTableQuery;

    if (!activeQuery.data || activeQuery.data.pages.length === 0) return null;

    const firstPage = activeQuery.data.pages[0]!;
    const allRows = activeQuery.data.pages.flatMap((page) => page.rows);
    const totalDBRowCount = firstPage.totalRowCount ?? 0;
    const totalFetched = allRows.length;

    return {
      name: firstPage.tableInfo.name,
      columns: firstPage.tableInfo.columns.map((col: Column) => ({
        id: col.id,
        name: col.name,
        type: col.type,
      })),
      rows: allRows,
      totalRows: totalFetched,
      totalDBRowCount,
      hasNextPage: activeQuery.hasNextPage,
      fetchNextPage: () => {
        void activeQuery.fetchNextPage();
      },
      isFetching: activeQuery.isFetching,
      isFetchingNextPage: activeQuery.isFetchingNextPage,
    };
  }, [infiniteTableQuery, searchQuery, hasSearch]);

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
        void infiniteTableQuery.refetch();
      },
    }),
    [
      tableId,
      baseId,
    ],
  );

  // Calculate loading state - exclude initial query loading for immediate transitions
  const loading = useMemo(() => {
    const activeQuery = hasSearch ? searchQuery : infiniteTableQuery;
    return (
      (activeQuery.isPending && !activeQuery.data) ||
      createRowMutation.isPending ||
      updateCellMutation.isPending ||
      updateColumnMutation.isPending ||
      deleteColumnMutation.isPending ||
      deleteRowMutation.isPending ||
      addColumnMutation.isPending
    );
  }, [
    hasSearch,
    searchQuery,
    infiniteTableQuery,
    createRowMutation.isPending,
    updateCellMutation.isPending,
    updateColumnMutation.isPending,
    deleteColumnMutation.isPending,
    deleteRowMutation.isPending,
    addColumnMutation.isPending,
  ]);

  // Error handling
  const error = useMemo(() => {
    const activeQuery = hasSearch ? searchQuery : infiniteTableQuery;
    if (activeQuery.error) {
      return activeQuery.error.message;
    }
    return null;
  }, [hasSearch, searchQuery, infiniteTableQuery]);

  return {
    loading,
    error,
    tableData,
    tableActions,
  };
}
