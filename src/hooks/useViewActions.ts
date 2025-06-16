import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { setLastViewedView } from "~/utils/lastViewedView";

interface UseViewActionsProps {
  tableId: string;
  baseId: string;
  currentViewId: string;
}

export function useViewActions({
  tableId,
  baseId,
  currentViewId,
}: UseViewActionsProps) {
  const router = useRouter();
  const utils = api.useUtils();

  // State for context menu
  const [contextMenu, setContextMenu] = useState<{
    viewId: string;
    viewName: string;
    position: { x: number; y: number };
  } | null>(null);

  // Get views for the current table
  const { data: views = [], isLoading } = api.view.getViewsByTable.useQuery(
    { tableId },
    {
      enabled: !!tableId,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30 seconds - reasonable for view metadata
    },
  );

  const updateViewNameMutation = api.view.updateViewName.useMutation({
    onMutate: async ({ viewId, name }) => {
      // Cancel outgoing queries for the views list only
      await utils.view.getViewsByTable.cancel({ tableId });

      // Get previous data from views list cache only
      const previousViews = utils.view.getViewsByTable.getData({ tableId });

      // Optimistically update ONLY the views list cache
      // Don't touch the individual view data cache to avoid overwriting config changes
      utils.view.getViewsByTable.setData({ tableId }, (old) => {
        if (!old) return old;
        return old.map((view) =>
          view.id === viewId ? { ...view, name } : view,
        );
      });

      return { previousViews };
    },
    onError: (error, _, context) => {
      // Revert optimistic updates for views list only
      if (context?.previousViews) {
        utils.view.getViewsByTable.setData({ tableId }, context.previousViews);
      }
      toast.error(`Failed to rename view: ${error.message}`);
      // Only invalidate views list on error
      void utils.view.getViewsByTable.invalidate({ tableId });
    },
    onSuccess: (updatedView) => {
      // After successful rename, invalidate the individual view cache
      // to ensure the name is updated everywhere, but this happens after
      // the mutation is complete so it won't overwrite config changes
      void utils.view.getView.invalidate({ viewId: updatedView.id });
    },
  });

  // Delete view mutation
  const deleteViewMutation = api.view.deleteView.useMutation({
    onMutate: async ({ viewId }) => {
      // Cancel outgoing queries
      await utils.view.getViewsByTable.cancel({ tableId });

      // Get previous data
      const previousViews = utils.view.getViewsByTable.getData({
        tableId,
      });

      // Optimistically remove the view
      utils.view.getViewsByTable.setData({ tableId }, (old) => {
        if (!old) return old;
        return old.filter((view) => view.id !== viewId);
      });

      return { previousViews };
    },
    onError: (error, _, context) => {
      // Revert optimistic update
      if (context?.previousViews) {
        utils.view.getViewsByTable.setData({ tableId }, context.previousViews);
      }
      toast.error(`Failed to delete view: ${error.message}`);
      // Only invalidate on error to ensure data consistency
      void utils.view.getViewsByTable.invalidate({ tableId });
    },
  });

  // Context menu handlers
  const handleShowContextMenu = useCallback(
    (e: React.MouseEvent, viewId: string, viewName: string) => {
      e.preventDefault();
      e.stopPropagation();

      setContextMenu({
        viewId,
        viewName,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleUpdateViewName = useCallback(
    async (viewName: string) => {
      if (!contextMenu) return;

      await updateViewNameMutation.mutateAsync({
        viewId: contextMenu.viewId,
        name: viewName,
      });
    },
    [contextMenu, updateViewNameMutation],
  );

  const handleDeleteView = useCallback(
    async (viewId: string) => {
      // If we're deleting the current view, navigate immediately to avoid flickering
      if (viewId === currentViewId) {
        // Find the view to navigate to (prefer previous view, then next view)
        const currentIndex = views.findIndex((view) => view.id === viewId);
        let targetView = null;

        if (currentIndex > 0) {
          // Navigate to previous view
          targetView = views[currentIndex - 1];
        } else if (currentIndex < views.length - 1) {
          // Navigate to next view (if this is the first view)
          targetView = views[currentIndex + 1];
        }

        if (targetView) {
          // Navigate immediately to prevent flickering
          setLastViewedView(tableId, targetView.id);
          router.push(`/${baseId}/${tableId}/${targetView.id}`);
        }
      }

      // Then delete the view in the background with optimistic updates
      await deleteViewMutation.mutateAsync({ viewId });
    },
    [deleteViewMutation, currentViewId, views, router, baseId, tableId],
  );

  // Get current view data
  const currentView = views.find((view) => view.id === currentViewId);

  return {
    views,
    currentView,
    isLoading,
    contextMenu,
    canDeleteView: views.length > 1,
    handleShowContextMenu,
    handleCloseContextMenu,
    handleUpdateViewName,
    handleDeleteView,
  };
}
