import {
  ChevronDown,
  Grid,
  Menu,
  Database,
  Loader2,
  Group,
  Share2,
  Palette,
  Users,
} from "lucide-react";
import { Button } from "../ui/button";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import type { TableData } from "~/hooks/useTableData";
import { SearchInput } from "./SearchInput";
import SortMenu from "./SortMenu";
import FilterMenu from "./FilterMenu";
import HiddenColumnsMenu from "./HiddenColumnsMenu";
import type { ColumnHighlight } from "~/types/sorting";
import type { SearchNavigationState } from "~/hooks/useTableSearch";
import { useViews } from "~/hooks/useViews";
import { ViewContextMenu } from "./ViewContextMenu";

interface ViewControlProps {
  // Core identifiers only
  tableId: string;
  baseId: string;
  currentViewId: string;

  // Table data (still needed for loading states)
  tableData?: TableData;
  loadingStatus?: string | null;

  // Search state (controlled by parent for search navigation)
  searchQuery?: string;
  setSearchQuery: (query: string) => void;
  onSearchMatches?: (navigationState: SearchNavigationState) => void;

  // UI state
  isViewSideOpen: boolean;
  onToggleViewSide: () => void;

  // Highlight callbacks (for table highlighting)
  onSortHighlightChange?: (highlights: ColumnHighlight[]) => void;
  onFilterHighlightChange?: (highlights: ColumnHighlight[]) => void;

  // Data management
  onInvalidateTableData?: () => void;
}

export default function ViewControl({
  tableId,
  baseId,
  currentViewId,
  tableData,
  loadingStatus = null,
  setSearchQuery,
  onSearchMatches,
  isViewSideOpen,
  onToggleViewSide,
  onSortHighlightChange,
  onFilterHighlightChange,
  onInvalidateTableData,
}: ViewControlProps) {
  const [isAddingManyRows, setIsAddingManyRows] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    viewId: string;
    viewName: string;
    position: { x: number; y: number };
  } | null>(null);
  const utils = api.useUtils();

  // Only fetch view data that ViewControl directly needs
  const { currentView, updateViewName, deleteView, canDeleteView } = useViews({
    tableId,
    baseId,
    currentViewId,
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
      await updateViewName(contextMenu.viewId, viewName);
      setContextMenu(null);
    },
    [contextMenu, updateViewName],
  );

  const handleDeleteView = useCallback(
    async (viewId: string) => {
      await deleteView(viewId);
      setContextMenu(null);
    },
    [deleteView],
  );

  // Add many rows mutation
  const addManyRowsMutation = api.row.addManyRows.useMutation({
    onSuccess: () => {
      setIsAddingManyRows(false);
      toast.success("Successfully added 100k rows!");
      void utils.data.getInfiniteTableData.invalidate({ tableId });
    },
    onError: (error) => {
      toast.error(`Error adding rows: ${error.message}`);
      setIsAddingManyRows(false);
    },
  });

  const handleAddManyRows = useCallback(() => {
    setIsAddingManyRows(true);
    addManyRowsMutation.mutate({ tableId, baseId });
  }, [addManyRowsMutation, tableId, baseId]);

  return (
    <div className="flex flex-col">
      {/* Main controls bar */}
      <div className="flex min-h-11 items-center gap-2 border-b border-gray-200 bg-white px-2">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 gap-1.5 rounded px-2 text-sm font-normal text-gray-700 ${
            isViewSideOpen ? "bg-gray-100" : "hover:bg-gray-100"
          }`}
          title="Toggle views sidebar"
          onClick={onToggleViewSide}
        >
          <Menu className="h-4 w-4" />
          <span className="text-[13px] text-black">Views</span>
        </Button>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded px-2 text-sm font-normal text-gray-700 hover:bg-gray-100"
            title="Current view - right click to rename or delete"
            onClick={(e) => {
              if (currentView?.name) {
                handleShowContextMenu(e, currentViewId, currentView.name);
              }
            }}
          >
            <Grid className="h-4 w-4 text-blue-600" />
            <span className="text-[13px] text-black">{currentView?.name}</span>
            <Users className="h-4 w-4" />
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <HiddenColumnsMenu tableId={tableId} viewId={currentViewId} />

          <FilterMenu
            tableId={tableId}
            viewId={currentViewId}
            onHighlightChange={onFilterHighlightChange}
            onInvalidateTableData={onInvalidateTableData}
          />

          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded px-2 text-[13px] font-normal text-gray-700 hover:bg-gray-100"
          >
            <Group className="h-4 w-4" />
            Group
          </Button>

          <SortMenu
            tableId={tableId}
            viewId={currentViewId}
            onHighlightChange={onSortHighlightChange}
            onInvalidateTableData={onInvalidateTableData}
          />

          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded px-2 text-[13px] font-normal text-gray-700 hover:bg-gray-100"
          >
            <Palette className="h-4 w-4" />
            Color
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded px-2 text-[13px] font-normal text-gray-700 hover:bg-gray-100"
          >
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path
                fill="none"
                stroke="gray"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
                d="m16 35l-6 6l-6 6m12-22l-6-6l-6 6m6-6v34M44 9H22m14 10H22m22 10H22m14 10H22"
              />
            </svg>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded px-2 text-[13px] font-normal text-gray-700 hover:bg-gray-100"
          >
            <Share2 className="h-4 w-4" />
            Share and sync
          </Button>
        </div>

        {/* Action buttons section */}
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded px-2 text-sm font-normal text-gray-700 hover:bg-gray-100"
            onClick={handleAddManyRows}
            disabled={isAddingManyRows}
            title="Adds 100k rows to the table for testing"
          >
            <Database className="h-4 w-4" />
            <p className="hidden text-[13px] md:block">Add 100k rows</p>
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Loading indicators with priority order */}
        {loadingStatus && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-[13px]">{loadingStatus}</span>
          </div>
        )}

        {!loadingStatus && isAddingManyRows && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-[13px]">Adding 100k rows...</span>
          </div>
        )}

        {!loadingStatus &&
          !isAddingManyRows &&
          tableData?.isFetching &&
          !tableData?.isFetchingNextPage && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[13px]">Loading...</span>
            </div>
          )}

        {!loadingStatus &&
          !isAddingManyRows &&
          !tableData?.isFetching &&
          tableData?.isFetchingNextPage && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[13px]">Loading more...</span>
            </div>
          )}

        <SearchInput
          tableId={tableId}
          onChange={setSearchQuery}
          disabled={!!loadingStatus}
          backendSearchMatches={tableData?.searchMatches ?? []}
          onSearchMatches={onSearchMatches}
          onInvalidateTableData={onInvalidateTableData}
        />
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
    </div>
  );
}
