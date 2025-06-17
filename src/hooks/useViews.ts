import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { setLastViewedView } from "~/utils/lastViewedView";

interface UseViewActionsProps {
  tableId: string;
  baseId: string;
  currentViewId: string;
}

export function useViews({
  tableId,
  baseId,
  currentViewId,
}: UseViewActionsProps) {
  const router = useRouter();
  const utils = api.useUtils();

  // Get views for the current table
  const { data: views = [], isLoading } = api.view.getViewsByTable.useQuery({
    tableId,
  });

  // Update view name mutation
  const updateViewNameMutation = api.view.updateViewName.useMutation({
    onMutate: async ({ viewId, name }) => {
      // Cancel all related queries
      await Promise.all([
        utils.view.getViewsByTable.cancel({ tableId }),
        utils.view.getView.cancel({ viewId }),
      ]);

      // Get previous data
      const previousViews = utils.view.getViewsByTable.getData({ tableId });
      const previousView = utils.view.getView.getData({ viewId });

      // Update views list
      utils.view.getViewsByTable.setData({ tableId }, (old) =>
        old?.map((view) => (view.id === viewId ? { ...view, name } : view)),
      );

      // Update individual view
      utils.view.getView.setData({ viewId }, (old) =>
        old ? { ...old, name } : old,
      );

      return { previousViews, previousView };
    },
    onError: (error, { viewId }, context) => {
      // Revert all changes
      if (context?.previousViews) {
        utils.view.getViewsByTable.setData({ tableId }, context.previousViews);
      }
      if (context?.previousView) {
        utils.view.getView.setData({ viewId }, context.previousView);
      }
      toast.error(`Failed to rename view: ${error.message}`);
    },
  });

  // Delete view mutation
  const deleteViewMutation = api.view.deleteView.useMutation({
    onMutate: async ({ viewId }) => {
      await utils.view.getViewsByTable.cancel({ tableId });

      const previousViews = utils.view.getViewsByTable.getData({ tableId });

      utils.view.getViewsByTable.setData({ tableId }, (old) =>
        old?.filter((view) => view.id !== viewId),
      );

      return { previousViews };
    },
    onError: (error, _, context) => {
      if (context?.previousViews) {
        utils.view.getViewsByTable.setData({ tableId }, context.previousViews);
      }
      toast.error(`Failed to delete view: ${error.message}`);
    },
  });

  // Actions
  const updateViewName = useCallback(
    async (viewId: string, name: string) => {
      await updateViewNameMutation.mutateAsync({ viewId, name });
    },
    [updateViewNameMutation],
  );

  const deleteView = useCallback(
    async (viewId: string) => {
      // Navigate away if deleting current view
      if (viewId === currentViewId && views.length > 1) {
        const currentIndex = views.findIndex((view) => view.id === viewId);
        const targetView =
          views[currentIndex > 0 ? currentIndex - 1 : currentIndex + 1];

        if (targetView) {
          setLastViewedView(tableId, targetView.id);
          router.push(`/${baseId}/${tableId}/${targetView.id}`);
        }
      }

      await deleteViewMutation.mutateAsync({ viewId });
    },
    [deleteViewMutation, currentViewId, views, router, baseId, tableId],
  );

  return {
    views,
    currentView: views.find((view) => view.id === currentViewId),
    isLoading,
    canDeleteView: views.length > 1,
    updateViewName,
    deleteView,
  };
}
