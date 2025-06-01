import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { setLastViewedTable } from "~/utils/lastViewedTable";
import { setLastViewedView } from "~/utils/lastViewedView";

interface UseTableActionsProps {
  baseId: string;
  currentTableId: string;
}

export function useTableActions({
  baseId,
  currentTableId,
}: UseTableActionsProps) {
  const router = useRouter();
  const utils = api.useUtils();

  // State for context menu
  const [contextMenu, setContextMenu] = useState<{
    tableId: string;
    tableName: string;
    position: { x: number; y: number };
  } | null>(null);

  // Get tables for the current base
  const { data: tables = [] } = api.table.getTablesByBase.useQuery(
    { baseId },
    {
      enabled: !!baseId,
      refetchOnWindowFocus: false,
    },
  );

  // Update table name mutation
  const updateTableNameMutation = api.table.updateTableName.useMutation({
    onMutate: async ({ tableId, name }) => {
      // Cancel outgoing queries
      await utils.table.getTablesByBase.cancel({ baseId });

      // Get previous data
      const previousTables = utils.table.getTablesByBase.getData({
        baseId,
      });

      // Optimistically update the table
      utils.table.getTablesByBase.setData({ baseId }, (old) => {
        if (!old) return old;
        return old.map((table) =>
          table.id === tableId ? { ...table, name } : table,
        );
      });

      return { previousTables };
    },
    onSuccess: () => {
      toast.success("Table renamed successfully");
    },
    onError: (error, _, context) => {
      // Revert optimistic update
      if (context?.previousTables) {
        utils.table.getTablesByBase.setData({ baseId }, context.previousTables);
      }
      toast.error(`Failed to rename table: ${error.message}`);
      // Only invalidate on error to ensure data consistency
      void utils.table.getTablesByBase.invalidate({ baseId });
    },
  });

  // Delete table mutation
  const deleteTableMutation = api.table.deleteTable.useMutation({
    onMutate: async ({ tableId }) => {
      // Cancel outgoing queries
      await utils.table.getTablesByBase.cancel({ baseId });

      // Get previous data
      const previousTables = utils.table.getTablesByBase.getData({
        baseId,
      });

      // Optimistically remove the table
      utils.table.getTablesByBase.setData({ baseId }, (old) => {
        if (!old) return old;
        return old.filter((table) => table.id !== tableId);
      });

      return { previousTables };
    },
    onSuccess: () => {
      toast.success("Table deleted successfully");
    },
    onError: (error, _, context) => {
      // Revert optimistic update
      if (context?.previousTables) {
        utils.table.getTablesByBase.setData({ baseId }, context.previousTables);
      }
      toast.error(`Failed to delete table: ${error.message}`);
      // Only invalidate on error to ensure data consistency
      void utils.table.getTablesByBase.invalidate({ baseId });
    },
  });

  // Context menu handlers
  const handleShowContextMenu = useCallback(
    (e: React.MouseEvent, tableId: string, tableName: string) => {
      e.preventDefault();
      e.stopPropagation();

      setContextMenu({
        tableId,
        tableName,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleUpdateTableName = useCallback(
    async (tableName: string) => {
      if (!contextMenu) return;

      await updateTableNameMutation.mutateAsync({
        tableId: contextMenu.tableId,
        name: tableName,
      });
    },
    [contextMenu, updateTableNameMutation],
  );

  const handleDeleteTable = useCallback(
    async (tableId: string) => {
      try {
        // First, invalidate all caches related to this table to prevent stale queries
        await utils.data.getInfiniteTableData.invalidate({ tableId });
        await utils.view.getViewsByTable.invalidate({ tableId });

        // If we're deleting the current table, navigate immediately to avoid errors
        if (tableId === currentTableId) {
          // Find the table to navigate to (prefer previous table, then next table)
          const currentIndex = tables.findIndex(
            (table) => table.id === tableId,
          );
          let targetTable = null;

          if (currentIndex > 0) {
            // Navigate to previous table
            targetTable = tables[currentIndex - 1];
          } else if (currentIndex < tables.length - 1) {
            // Navigate to next table (if this is the first table)
            targetTable = tables[currentIndex + 1];
          }

          if (targetTable) {
            // Get the default view for the target table specifically
            try {
              const tableDefaultView =
                await utils.table.getTableDefaultView.fetch({
                  tableId: targetTable.id,
                });
              if (tableDefaultView) {
                setLastViewedTable(baseId, targetTable.id);
                setLastViewedView(targetTable.id, tableDefaultView.view.id);

                // Navigate immediately to prevent any stale view queries
                router.push(
                  `/${baseId}/${targetTable.id}/${tableDefaultView.view.id}`,
                );

                // Wait a bit for navigation to start before deleting
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
            } catch (error) {
              console.error("Failed to get table default view:", error);
              // Fallback: navigate with just table ID
              setLastViewedTable(baseId, targetTable.id);
              router.push(`/${baseId}/${targetTable.id}`);
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
        }

        // Then delete the table
        await deleteTableMutation.mutateAsync({ tableId });

        // Finally, invalidate all caches to ensure clean state
        await utils.table.getTablesByBase.invalidate({ baseId });
      } catch (error) {
        console.error("Error in handleDeleteTable:", error);
        toast.error("Failed to delete table");
      }
    },
    [
      deleteTableMutation,
      currentTableId,
      tables,
      router,
      baseId,
      utils.table.getTableDefaultView,
      utils.table.getTablesByBase,
      utils.data.getInfiniteTableData,
      utils.view.getViewsByTable,
    ],
  );

  // Get current table data
  const currentTable = tables.find((table) => table.id === currentTableId);

  return {
    tables,
    currentTable,
    contextMenu,
    canDeleteTable: tables.length > 1,
    handleShowContextMenu,
    handleCloseContextMenu,
    handleUpdateTableName,
    handleDeleteTable,
  };
}
