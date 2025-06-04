"use client";

import { use, useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import BaseTopNav from "~/components/base/BaseTopNav";
import TableNav from "~/components/tableView/TableNav";
import ViewControl from "~/components/tableView/ViewControl";
import ViewSide from "~/components/tableView/ViewSide";
import TableView from "~/components/tableView/TableView";
import { TableSkeleton } from "~/components/tableView/TableSkeleton";
import { useTableData } from "~/hooks/useTableData";
import { useViewData } from "~/hooks/useViewData";
import { useViewFiltering } from "~/hooks/useViewFiltering";
import { useViewSorting } from "~/hooks/useViewSorting";
import { useHiddenColumn } from "~/hooks/useHiddenColumn";
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

  // Simple fix: Just invalidate view queries when switching tables/views
  useEffect(() => {
    void utils.view.getViewWithValidation.invalidate({ viewId, tableId });
  }, [tableId, viewId, utils]);

  // Load view data and actions
  const {
    viewData,
    viewActions,
    isLoading: isViewLoading,
    error: viewError,
  } = useViewData({ viewId, tableId });

  // Memoize initial values to prevent infinite loops
  const initialFilters = useMemo(
    () => viewData?.filters ?? [],
    [viewData?.filters],
  );
  const initialSorting = useMemo(
    () => viewData?.sorts ?? [],
    [viewData?.sorts],
  );
  const initialHiddenColumns = useMemo(
    () => viewData?.hiddenColumns ?? [],
    [viewData?.hiddenColumns],
  );

  // Use view-aware filtering hook
  const {
    filtering,
    completeFilters,
    setFiltering: handleFilteringChange,
  } = useViewFiltering({
    initialFilters,
    viewActions,
    autoSave: true,
  });

  // Use view-aware sorting hook
  const {
    sorting,
    activeSorting,
    setSorting: handleSortingChange,
  } = useViewSorting({
    initialSorting,
    viewActions,
    autoSave: true,
  });

  // Get table data using our custom hook with view-aware filters and sorting
  const {
    loading: hookLoadingStatus,
    error,
    tableData,
    tableActions,
  } = useTableData({
    tableId,
    baseId,
    search: searchQuery,
    sorting: activeSorting,
    filtering: completeFilters,
  });

  // Use view-aware hidden columns hook with actual table columns
  const {
    hiddenColumns,
    setHiddenColumns,
    showAllColumns,
    hideAllColumns,
    loading: columnVisibilityLoading,
  } = useHiddenColumn({
    viewId,
    tableId,
    columns: tableData?.columns ?? [],
    viewActions,
    autoSave: true,
    initialHiddenColumns,
  });

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

  // Get base information using tRPC
  const { data: baseNameAndColor, error: baseError } =
    api.base.getNameAndColorById.useQuery({
      id: baseId,
    });

  // Combine loading states
  const currentLoadingStatus =
    tableSavingStatus ?? columnVisibilityLoading ?? hookLoadingStatus;

  // Derived values for UI
  const baseName = baseNameAndColor?.name;
  const baseColor = getColorFromBaseId(baseId);

  // Show error toast for table data errors (only once)
  if (error && !hookLoadingStatus) {
    toast.error(`Failed to load table: ${error}`);
  }

  // Show error toast for base errors
  if (baseError) {
    toast.error(`Failed to load base: ${baseError.message}`);
  }

  // Show error toast for view errors
  if (viewError) {
    toast.error(`Failed to load view: ${viewError}`);
  }

  // Set last viewed table and view in localStorage
  useEffect(() => {
    setLastViewedTable(baseId, tableId);
    setLastViewedView(tableId, viewId);
  }, [baseId, tableId, viewId]);

  // Show loading state if view is still loading
  if (isViewLoading) {
    return (
      <div className="flex h-screen w-screen flex-col">
        <BaseTopNav baseName={baseName} baseColor={baseColor} baseId={baseId} />
        <TableNav baseId={baseId} currentTableId={tableId} />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <TableSkeleton />
        </div>
      </div>
    );
  }

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
        tableId={tableId}
        baseId={baseId}
        currentViewId={viewId}
        tableActions={tableActions}
        tableData={tableData ?? undefined}
        setSearchQuery={handleSearchQueryChange}
        sorting={sorting}
        loadingStatus={currentLoadingStatus}
        onSortingChange={handleSortingChange}
        filtering={filtering}
        onFilteringChange={handleFilteringChange}
        onSortHighlightChange={handleSortHighlightChange}
        onFilterHighlightChange={handleFilterHighlightChange}
        hiddenColumns={hiddenColumns}
        onSetHiddenColumns={setHiddenColumns}
        onShowAllColumns={showAllColumns}
        onHideAllColumns={hideAllColumns}
        isViewSideOpen={isViewSideOpen}
        onToggleViewSide={handleToggleViewSide}
        onSearchMatches={handleSearchMatches}
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
