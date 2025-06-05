import {
  ChevronDown,
  Grid,
  Menu,
  Database,
  Loader2,
  Group,
  Share2,
  Palette,
} from "lucide-react";
import { Button } from "../ui/button";
import { useState, useCallback, memo } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import type { TableData } from "~/hooks/useTableData";
import { SearchInput } from "./SearchInput";
import SortMenu from "./SortMenu";
import FilterMenu from "./FilterMenu";
import HiddenColumnsMenu from "./HiddenColumnsMenu";
import type { FilterConfig } from "~/types/filtering";
import type { SortConfig, ColumnHighlight } from "~/types/sorting";
import type { SearchNavigationState } from "~/hooks/useTableSearch";
import { useViewData } from "~/hooks/useViewData";
import { useViewActions } from "~/hooks/useViewActions";
import { ViewContextMenu } from "./ViewContextMenu";

interface ViewControlProps {
  tableId: string;
  baseId: string;
  currentViewId: string;
  tableData?: TableData;
  loadingStatus?: string | null;
  setSearchQuery: (query: string) => void;
  sorting: SortConfig[];
  onSortingChange: (sorting: SortConfig[]) => void;
  filtering: FilterConfig[];
  onFilteringChange: (filtering: FilterConfig[]) => void;
  onSortHighlightChange?: (highlights: ColumnHighlight[]) => void;
  onFilterHighlightChange?: (highlights: ColumnHighlight[]) => void;
  hiddenColumns: string[];
  onSetHiddenColumns: (columns: string[]) => void;
  onShowAllColumns: () => void;
  onHideAllColumns: () => void;
  isViewSideOpen: boolean;
  onToggleViewSide: () => void;
  onSearchMatches?: (navigationState: SearchNavigationState) => void;
}

export default memo(function ViewControl({
  tableId,
  baseId,
  currentViewId,
  tableData,
  loadingStatus = null,
  setSearchQuery,
  sorting,
  onSortingChange,
  filtering,
  onFilteringChange,
  onSortHighlightChange,
  onFilterHighlightChange,
  hiddenColumns,
  onSetHiddenColumns,
  onShowAllColumns,
  onHideAllColumns,
  isViewSideOpen,
  onToggleViewSide,
  onSearchMatches,
}: ViewControlProps) {
  const [isAddingManyRows, setIsAddingManyRows] = useState(false);
  const utils = api.useUtils();

  // Use the view data hook for current view info
  const { viewData: currentView } = useViewData({
    viewId: currentViewId,
    tableId,
  });

  // Use the view actions hook for all view management
  const {
    contextMenu,
    canDeleteView,
    handleShowContextMenu,
    handleCloseContextMenu,
    handleUpdateViewName,
    handleDeleteView,
  } = useViewActions({
    tableId,
    baseId,
    currentViewId,
  });

  // Add many rows mutation
  const addManyRowsMutation = api.row.addManyRows.useMutation({
    onSuccess: () => {
      setIsAddingManyRows(false);
      toast.success("Successfully added 100k rows!");
      // Invalidate all queries for this table to refresh data across all views
      void utils.data.getInfiniteTableData.invalidate({
        tableId,
      });
    },
    onError: (error) => {
      toast.error(`Error adding rows: ${error.message}`);
      setIsAddingManyRows(false);
    },
  });

  // Handle add 100k rows
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
              if (currentView) {
                handleShowContextMenu(e, currentView.id, currentView.name);
              }
            }}
          >
            <Grid className="h-4 w-4 text-blue-600" />
            <span className="text-[13px] text-black">
              {currentView?.name ?? "Grid view"}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <HiddenColumnsMenu
            columns={tableData?.columns ?? []}
            hiddenColumns={hiddenColumns}
            onSetHiddenColumns={onSetHiddenColumns}
            onShowAllColumns={onShowAllColumns}
            onHideAllColumns={onHideAllColumns}
          />

          <FilterMenu
            columns={tableData?.columns ?? []}
            filtering={filtering}
            onFilteringChange={onFilteringChange}
            onHighlightChange={onFilterHighlightChange}
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
            columns={tableData?.columns ?? []}
            sorting={sorting}
            onSortingChange={onSortingChange}
            onHighlightChange={onSortHighlightChange}
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
                d="m16 35l-6 6l-6-6m12-22l-6-6l-6 6m6-6v34M44 9H22m14 10H22m22 10H22m14 10H22"
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
          {/* Add 100k Rows Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded px-2 text-sm font-normal text-gray-700 hover:bg-gray-100"
            onClick={handleAddManyRows}
            disabled={!!loadingStatus || isAddingManyRows}
            title="Adds 100k rows to the table for testing"
          >
            <Database className="h-4 w-4" />
            <p className="hidden text-[13px] md:block">Add 100k rows</p>
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Loading indicators with priority order */}
        {/* Show specific operation status (highest priority) */}
        {loadingStatus && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-[13px]">{loadingStatus}</span>
          </div>
        )}

        {/* Show adding many rows status */}
        {!loadingStatus && isAddingManyRows && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-[13px]">Adding 100k rows...</span>
          </div>
        )}

        {/* Show general loading (medium priority) */}
        {!loadingStatus &&
          !isAddingManyRows &&
          tableData?.isFetching &&
          !tableData?.isFetchingNextPage && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[13px]">Loading...</span>
            </div>
          )}

        {/* Show loading more data (lowest priority) */}
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
          onChange={setSearchQuery}
          disabled={!!loadingStatus}
          tableRows={tableData?.rows ?? []}
          tableColumns={tableData?.columns ?? []}
          onSearchMatches={onSearchMatches}
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
});
