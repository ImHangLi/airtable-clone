import {
  ChevronUp,
  ChevronDown,
  Grid,
  Plus,
  Search,
  Calendar,
  LayoutGrid,
  Columns,
  Clock,
  List,
  GanttChart,
  FormInput,
  Check,
  Star,
} from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useState, useCallback, useEffect, useRef, memo } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { ViewContextMenu } from "./ViewContextMenu";
import { setLastViewedView } from "~/utils/lastViewedView";
import { useViewActions } from "~/hooks/useViewActions";
import { Separator } from "../ui/separator";

interface ViewSideProps {
  tableId: string;
  baseId: string;
  currentViewId: string;
}

function ViewSide({ tableId, baseId, currentViewId }: ViewSideProps) {
  const router = useRouter();

  const [isAddingView, setIsAddingView] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(true);
  // Use the shared view actions hook
  const {
    views,
    contextMenu,
    canDeleteView,
    isLoading,
    handleShowContextMenu,
    handleCloseContextMenu,
    handleUpdateViewName,
    handleDeleteView,
  } = useViewActions({ tableId, baseId, currentViewId });

  // Create view mutation - keep this in ViewSide since it's specific to this component
  const utils = api.useUtils();
  const createViewMutation = api.view.createView.useMutation({
    onMutate: async ({ name }) => {
      // Cancel outgoing queries
      await utils.view.getViewsByTable.cancel({ tableId });

      // Get previous data
      const previousViews = utils.view.getViewsByTable.getData({
        tableId,
      });

      // Optimistically add the new view
      const tempView = {
        id: `temp-${Date.now()}`,
        name,
        table_id: tableId,
        base_id: baseId,
        filters: [],
        sorts: [],
        hiddenColumns: [],
        created_at: new Date(),
        updated_at: new Date(),
      };

      utils.view.getViewsByTable.setData({ tableId }, (old) =>
        old ? [...old, tempView] : [tempView],
      );

      return { previousViews, tempView };
    },
    onSuccess: (newView, variables, context) => {
      console.log("View created successfully, navigating to:", newView.id);

      // First, update the cache with the real view data, replacing the temp view
      utils.view.getViewsByTable.setData({ tableId }, (old) => {
        if (!old || !context?.tempView)
          return old ? [...old, newView] : [newView];

        // Replace the temp view with the real view
        return old.map((view) =>
          view.id === context.tempView.id ? newView : view,
        );
      });

      // Use setTimeout to ensure the cache update and re-render happen first
      setTimeout(() => {
        // Then navigate to the new view and track it
        setLastViewedView(tableId, newView.id);
        const navigationUrl = `/${baseId}/${tableId}/${newView.id}`;
        router.replace(navigationUrl);
      }, 100);

      toast.success("View created successfully");
      setIsAddingView(false);
      setNewViewName("");
    },
    onError: (error, _, context) => {
      console.error("View creation failed:", error);

      // Revert optimistic update
      if (context?.previousViews) {
        utils.view.getViewsByTable.setData({ tableId }, context.previousViews);
      }
      toast.error(`Failed to create view: ${error.message}`);
      // Only invalidate on error to ensure data consistency
      void utils.view.getViewsByTable.invalidate({ tableId });
    },
  });

  // Generate default view name
  const getDefaultViewName = useCallback(() => {
    if (!views.length) return "Grid 2";

    // Find views that match exactly "Grid " followed by a number
    const gridViews = views.filter((view) => {
      return /^Grid \d+$/.test(view.name);
    });

    if (gridViews.length === 0) return "Grid 2";

    // Find the highest number
    let maxNumber = 1;
    gridViews.forEach((view) => {
      const match = /^Grid (\d+)$/.exec(view.name);
      if (match) {
        const num = parseInt(match[1] ?? "0", 10);
        if (num > maxNumber) maxNumber = num;
      }
    });

    return `Grid ${maxNumber + 1}`;
  }, [views]);

  const handleAddView = useCallback(() => {
    setIsAddingView(true);
    setNewViewName(getDefaultViewName()); // Set default name immediately when opening form
  }, [getDefaultViewName]);

  const handleCancelAdd = useCallback(() => {
    setIsAddingView(false);
    setNewViewName("");
  }, []);

  // Handle click outside form
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        formRef.current &&
        !formRef.current.contains(event.target as Node) &&
        isAddingView
      ) {
        handleCancelAdd();
      }
    };

    if (isAddingView) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAddingView, handleCancelAdd]);

  const handleCreateView = useCallback(async () => {
    const trimmedName = newViewName.trim();
    if (!trimmedName || !tableId || !baseId) return;

    createViewMutation.mutate({
      name: trimmedName,
      tableId,
      baseId,
    });
  }, [newViewName, tableId, baseId, createViewMutation]);

  const handleViewClick = useCallback(
    (viewId: string) => {
      if (viewId.startsWith("temp-")) {
        return; // Don't navigate to temp views
      }

      if (viewId === currentViewId) {
        return; // Already on this view
      }

      console.log("Switching to view:", viewId);
      setLastViewedView(tableId, viewId);
      const newUrl = `/${baseId}/${tableId}/${viewId}`;
      router.push(newUrl);
    },
    [router, baseId, tableId, currentViewId],
  );

  const handleViewRightClick = useCallback(
    (e: React.MouseEvent, viewId: string, viewName: string) => {
      e.preventDefault();
      e.stopPropagation();

      handleShowContextMenu(e, viewId, viewName);
    },
    [handleShowContextMenu],
  );

  // Filter views based on search
  const filteredViews = views.filter((view) =>
    view.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!tableId) {
    return (
      <div className="flex min-h-0 w-[270px] max-w-[270px] flex-col border-r border-gray-200 bg-gray-50/50 px-3">
        <div className="flex h-full items-center justify-center text-[13px] text-gray-500">
          No table selected
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-[270px] max-w-[270px] flex-col border-r border-gray-200 bg-gray-50/50 px-3">
      <div className="flex h-full flex-1 flex-col justify-between">
        <div className="p-2">
          <div className="relative border-b border-gray-200">
            <Search className="absolute top-1/2 left-1 h-3.5 w-3.5 -translate-y-1/2 text-[13px] text-gray-500" />
            <Input
              placeholder="Find a view"
              className="h-7 w-full border-none bg-white pl-7 text-[13px] shadow-none placeholder:text-gray-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="h-full flex-1 p-1">
          <div className="space-y-0.5">
            {isLoading ? (
              <div className="py-4 text-center text-[13px] text-gray-500">
                Loading views...
              </div>
            ) : filteredViews.length === 0 && searchQuery ? (
              <div className="py-4 text-center text-[13px] text-gray-500">
                No views found
              </div>
            ) : (
              filteredViews.map((view) => {
                const isActive = view.id === currentViewId;
                const isTemp = view.id.startsWith("temp-");

                return (
                  <Button
                    key={view.id}
                    variant="ghost"
                    size="sm"
                    className={`group h-8 w-full justify-between gap-2 rounded px-2 text-[13px] font-normal ${
                      isActive
                        ? "bg-blue-100 text-blue-900 hover:bg-blue-100"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleViewClick(view.id);
                    }}
                    onContextMenu={(e) =>
                      handleViewRightClick(e, view.id, view.name)
                    }
                    disabled={isTemp}
                  >
                    <div className="flex items-center gap-2">
                      <Grid className="h-4 w-4 flex-shrink-0 text-blue-600 group-hover:hidden" />
                      <Star className="hidden h-4 w-4 flex-shrink-0 text-gray-500 group-hover:block" />
                      <span className="truncate">{view.name}</span>
                    </div>
                    {isActive && (
                      <Check className="h-3.5 w-3.5 text-gray-500 group-hover:hidden" />
                    )}
                  </Button>
                );
              })
            )}
          </div>
        </div>

        <div className="mx-auto h-[1px] w-full bg-gray-200" />

        <Separator className="mx-auto h-[1px] w-full bg-gray-200" />
        <div className="px-2">
          <div
            className="flex cursor-pointer items-center justify-between gap-2 py-[11px] pl-1"
            onClick={() => setIsCreateOpen(!isCreateOpen)}
          >
            <span className="text-[15px] font-medium text-gray-700">
              Create...
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 pr-0.5 hover:bg-white"
            >
              {isCreateOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>

          {isCreateOpen && (
            <div className="pb-4">
              <div className="flex items-center justify-between pr-1 hover:bg-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 rounded px-2 text-[13px] font-normal text-gray-700"
                  onClick={handleAddView}
                >
                  <Grid className="h-4 w-4 text-blue-600" />
                  Grid
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between pr-1 hover:bg-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 rounded px-2 text-[13px] font-normal text-gray-700"
                >
                  <Calendar className="h-4 w-4 text-orange-600" />
                  Calendar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between pr-1 hover:bg-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 rounded px-2 text-[13px] font-normal text-gray-700"
                >
                  <LayoutGrid className="h-4 w-4 text-purple-600" />
                  Gallery
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between pr-1 hover:bg-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 rounded px-2 text-[13px] font-normal text-gray-700"
                >
                  <Columns className="h-4 w-4 text-green-600" />
                  Kanban
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between pr-1 hover:bg-gray-100">
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start gap-2 rounded px-2 text-[13px] font-normal text-gray-700"
                  >
                    <Clock className="h-4 w-4 text-red-600" />
                    Timeline
                  </Button>
                  <span className="rounded-full bg-[#c4ecff] px-1.5 py-0.5 text-xs text-[#0f68a2]">
                    Team
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative left-[2px] h-8 w-8 text-gray-500"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between pr-1 hover:bg-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 rounded px-2 text-[13px] font-normal text-gray-700"
                >
                  <List className="h-4 w-4 text-blue-600" />
                  List
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between pr-1 hover:bg-gray-100">
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start gap-2 rounded px-2 text-[13px] font-normal text-gray-700"
                  >
                    <GanttChart className="h-4 w-4 text-teal-600" />
                    Gantt
                  </Button>
                  <span className="rounded-full bg-[#c4ecff] px-1.5 py-0.5 text-xs text-[#0f68a2]">
                    Team
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative left-[2px] h-8 w-8 text-gray-500"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between pr-1 pb-2 hover:bg-gray-100">
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start gap-2 rounded px-2 text-[13px] font-normal text-gray-700"
                  >
                    New section
                  </Button>
                  <span className="rounded-full bg-[#c4ecff] px-1.5 py-0.5 text-xs text-[#0f68a2]">
                    Team
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative left-[2px] h-8 w-8 text-gray-500"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Separator className="mx-auto !mb-[9px] h-[1px] w-full bg-gray-200" />
              <div className="flex items-center justify-between pr-1 hover:bg-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 rounded px-2 text-[13px] font-normal text-gray-700"
                >
                  <FormInput className="h-4 w-4 text-pink-600" />
                  Form
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ViewContextMenu
          viewId={contextMenu.viewId}
          initialName={contextMenu.viewName}
          position={contextMenu.position}
          onUpdateAction={handleUpdateViewName}
          onDeleteAction={handleDeleteView}
          onCloseAction={handleCloseContextMenu}
          canDelete={canDeleteView}
        />
      )}

      {/* Floating Add View Form */}
      {isAddingView && (
        <div
          ref={formRef}
          className="fixed z-50 rounded-md border border-gray-200 bg-white shadow-lg"
          style={{
            left: "260px", // Position to the right of the sidebar
            top: "90%",
            transform: "translateY(-50%)",
            width: "320px",
            padding: "16px",
          }}
        >
          <div className="flex h-full flex-col justify-between">
            <div className="mb-6">
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleCreateView();
                  } else if (e.key === "Escape") {
                    handleCancelAdd();
                  }
                }}
                className="h-8 text-[13px]"
                placeholder="View name"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-16 text-[13px] font-normal text-gray-700"
                onClick={handleCancelAdd}
                disabled={createViewMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 w-31 bg-blue-600 text-[13px] font-normal text-white hover:bg-blue-600"
                onClick={handleCreateView}
                disabled={!newViewName.trim() || createViewMutation.isPending}
              >
                {"Create new view"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ViewSide);
