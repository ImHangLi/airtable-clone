"use client";

import { use, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import BaseTopNav from "~/components/base/BaseTopNav";
import TableNav from "~/components/tableView/TableNav";
import ViewControl from "~/components/tableView/ViewControl";
import ViewSide from "~/components/tableView/ViewSide";
import TableView from "~/components/tableView/TableView";
import { TableSkeleton } from "~/components/tableView/TableSkeleton";
import { useTableData } from "~/hooks/useTableData";
import { useViewConfig } from "~/hooks/useViewConfig";
import { getColorFromBaseId } from "~/lib/utils";
import { api } from "~/trpc/react";
import { setLastViewedTable } from "~/utils/lastViewedTable";
import { setLastViewedView } from "~/utils/lastViewedView";
import type { ColumnHighlight } from "~/types/sorting";
import type { SearchNavigationState } from "~/hooks/useTableSearch";

// Error component
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-lg text-red-500">{message}</div>
    </div>
  );
}

export default function TableViewPage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  const { baseId, tableId, viewId } = use(params);
  const utils = api.useUtils();

  const [tableSavingStatus, setTableSavingStatus] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isViewSideOpen, setIsViewSideOpen] = useState(true);
  const [highlights, setHighlights] = useState<ColumnHighlight[]>([]);

  // Search state management
  const [searchNavigationState, setSearchNavigationState] =
    useState<SearchNavigationState>({
      matches: [],
      currentMatchIndex: 0,
      totalMatches: 0,
      hasMatches: false,
    });

  useEffect(() => {
    void utils.view.getView.invalidate({ viewId });
  }, [viewId, utils]);

  // Get table columns with a lightweight query
  const { data: tableColumns = [] } = api.column.getColumns.useQuery({
    tableId,
  });

  // Load view configuration with table columns
  const {
    viewConfig,
    error: viewError,
    activeFilters,
    activeSorts,
    updateFilters: handleFilteringChange,
    updateSorts: handleSortingChange,
    updateHiddenColumns: setHiddenColumns,
    showAllColumns,
    hideAllColumns,
  } = useViewConfig({
    viewId,
    columns: tableColumns,
  });

  // Get filtered table data using view configuration
  const {
    loading: hookLoadingStatus,
    error,
    tableData,
    tableActions,
  } = useTableData({
    tableId,
    baseId,
    search: searchQuery,
    sorting: activeSorts,
    filtering: activeFilters,
  });

  // Get hidden columns from view config
  const hiddenColumns = viewConfig?.hiddenColumns ?? [];

  // Memoize callback handlers to prevent unnecessary re-renders
  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleToggleViewSide = useCallback(() => {
    setIsViewSideOpen((prev) => !prev);
  }, []);

  const handleSortHighlightChange = useCallback(
    (newHighlights: ColumnHighlight[]) => {
      setHighlights((prevHighlights) => {
        const filteredHighlights = prevHighlights.filter(
          (h) => h.type !== "sort",
        );
        return [...filteredHighlights, ...newHighlights];
      });
    },
    [],
  );

  const handleFilterHighlightChange = useCallback(
    (newHighlights: ColumnHighlight[]) => {
      setHighlights((prevHighlights) => {
        const filteredHighlights = prevHighlights.filter(
          (h) => h.type !== "filter",
        );
        return [...filteredHighlights, ...newHighlights];
      });
    },
    [],
  );

  // Stable search matches callback with useCallback to prevent re-renders
  const handleSearchMatches = useCallback(
    (navigationState: SearchNavigationState) => {
      setSearchNavigationState((prevState) => {
        // Only update if the state has actually changed
        if (
          prevState.totalMatches !== navigationState.totalMatches ||
          prevState.currentMatchIndex !== navigationState.currentMatchIndex ||
          prevState.hasMatches !== navigationState.hasMatches
        ) {
          return navigationState;
        }
        return prevState;
      });
    },
    [],
  );

  // Table data invalidation callback
  const handleInvalidateTableData = useCallback(() => {
    void utils.data.getInfiniteTableData.invalidate();
  }, [utils]);

  // Get base information using tRPC
  const { data: baseNameAndColor, error: baseError } =
    api.base.getNameAndColorById.useQuery({
      id: baseId,
    });

  // Combine loading states
  const currentLoadingStatus = tableSavingStatus ?? hookLoadingStatus;

  // Derived values for UI
  const baseName = baseNameAndColor?.name;
  const baseColor = getColorFromBaseId(baseId);

  // Show error toast for table data errors (only once)
  if (error && !hookLoadingStatus) {
    console.error("❌ Table data error:", error);
    console.error("Table context:", { baseId, tableId, viewId });
    toast.error(`Failed to load table: ${error}`);
  }

  // Show error toast for base errors
  if (baseError) {
    console.error("❌ Base error:", baseError);
    toast.error(`Failed to load base: ${baseError.message}`);
  }

  // Show error toast for view errors
  if (viewError) {
    console.error("❌ View error:", viewError);
    console.error("View context:", { baseId, tableId, viewId });
    toast.error(`Failed to load view: ${viewError}`);
  }

  // Set last viewed table and view in localStorage
  useEffect(() => {
    setLastViewedTable(baseId, tableId);
    setLastViewedView(tableId, viewId);
  }, [baseId, tableId, viewId]);

  // Show error state if data couldn't be loaded
  if (error && !hookLoadingStatus) {
    return (
      <div className="flex h-screen w-screen flex-col">
        <BaseTopNav baseName={baseName} baseColor={baseColor} baseId={baseId} />
        <TableNav baseId={baseId} currentTableId={tableId} />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <ErrorState message={error} />
        </div>
      </div>
    );
  }

  // Show error state if view data couldn't be loaded
  if (viewError) {
    return (
      <div className="flex h-screen w-screen flex-col">
        <BaseTopNav baseName={baseName} baseColor={baseColor} baseId={baseId} />
        <TableNav baseId={baseId} currentTableId={tableId} />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <ErrorState message={viewError} />
        </div>
      </div>
    );
  }

  // Get current target match for TableView
  const currentTargetMatch =
    searchNavigationState.matches.find((match) => match.isCurrentTarget) ??
    null;

  return (
    <div className="flex h-screen w-screen flex-col">
      {/* Top Navigation */}
      <BaseTopNav baseName={baseName} baseColor={baseColor} baseId={baseId} />

      {/* Table Navigation */}
      <TableNav baseId={baseId} currentTableId={tableId} />

      {/* View Controls */}
      <ViewControl
        // Basic identifiers
        tableId={tableId}
        baseId={baseId}
        currentViewId={viewId}
        // Data and state
        tableData={tableData ?? undefined}
        searchQuery={searchQuery}
        sorting={activeSorts}
        filtering={activeFilters}
        hiddenColumns={hiddenColumns}
        loadingStatus={currentLoadingStatus}
        isViewSideOpen={isViewSideOpen}
        // Search handlers
        setSearchQuery={handleSearchQueryChange}
        onSearchMatches={handleSearchMatches}
        onInvalidateTableData={handleInvalidateTableData}
        // View configuration handlers
        onSortingChange={handleSortingChange}
        onFilteringChange={handleFilteringChange}
        onSetHiddenColumns={setHiddenColumns}
        onShowAllColumns={showAllColumns}
        onHideAllColumns={hideAllColumns}
        // UI interaction handlers
        onToggleViewSide={handleToggleViewSide}
        onSortHighlightChange={handleSortHighlightChange}
        onFilterHighlightChange={handleFilterHighlightChange}
      />

      {/* Main Content Area */}
      <div className="flex min-h-0 flex-1">
        {/* Side Panel */}
        {isViewSideOpen && (
          <ViewSide tableId={tableId} baseId={baseId} currentViewId={viewId} />
        )}

        {/* Table Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tableData && (
            <TableView
              tableData={tableData}
              tableActions={tableActions}
              onSavingStateChange={setTableSavingStatus}
              highlights={highlights}
              hiddenColumns={hiddenColumns}
              searchMatches={searchNavigationState.matches}
              currentTargetMatch={currentTargetMatch}
            />
          )}
          {!tableData && <TableSkeleton />}
        </div>
      </div>
    </div>
  );
}
