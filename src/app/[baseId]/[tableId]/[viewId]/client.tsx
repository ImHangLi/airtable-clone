"use client";

import { use, useState, useCallback } from "react";
import { toast } from "sonner";
import BaseTopNav from "~/components/base/BaseTopNav";
import TableNav from "~/components/tableView/TableNav";
import ViewControl from "~/components/tableView/ViewControl";
import ViewSide from "~/components/tableView/ViewSide";
import TableView from "~/components/tableView/TableView";
import { TableSkeleton } from "~/components/tableView/TableSkeleton";
import { useTableData } from "~/hooks/useTableData";
import { getColorFromBaseId, getDarkerColorFromBaseId } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { FilterPreference } from "~/types/filtering";
import type { SortConfig, ColumnHighlight } from "~/types/sorting";

// Component props
interface TableViewPageClientProps {
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}

// Error component
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-lg text-red-500">{message}</div>
    </div>
  );
}

export default function TableViewPageClient({
  params,
}: TableViewPageClientProps) {
  const { baseId, tableId } = use(params);
  const [tableSavingStatus, setTableSavingStatus] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");

  // State for sorting functionality
  const [sorting, setSorting] = useState<SortConfig[]>([]);
  const [filtering, setFiltering] = useState<FilterPreference[]>([]);

  // State for column highlighting
  const [highlights, setHighlights] = useState<ColumnHighlight[]>([]);

  // Memoize the search query setter to prevent unnecessary re-renders
  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Memoize the sorting change handler
  const handleSortingChange = useCallback((newSorting: SortConfig[]) => {
    setSorting(newSorting);
  }, []);

  // Memoize the filtering change handler
  const handleFilteringChange = useCallback(
    (newFiltering: FilterPreference[]) => {
      setFiltering(newFiltering);
    },
    [],
  );

  // Memoize separate highlight change handlers
  const handleSortHighlightChange = useCallback(
    (newHighlights: ColumnHighlight[]) => {
      setHighlights((prevHighlights) => {
        // Remove all existing sort highlights
        const filteredHighlights = prevHighlights.filter(
          (h) => h.type !== "sort",
        );
        // Add new sort highlights
        return [...filteredHighlights, ...newHighlights];
      });
    },
    [],
  );

  const handleFilterHighlightChange = useCallback(
    (newHighlights: ColumnHighlight[]) => {
      setHighlights((prevHighlights) => {
        // Remove all existing filter highlights
        const filteredHighlights = prevHighlights.filter(
          (h) => h.type !== "filter",
        );
        // Add new filter highlight
        return [...filteredHighlights, ...newHighlights];
      });
    },
    [],
  );

  // Get base information using tRPC
  const { data: baseNameAndColor, error: baseError } =
    api.base.getNameAndColorById.useQuery({
      id: baseId,
    });

  // Get table data using our custom hook
  const {
    loading: hookLoadingStatus,
    error,
    tableData,
    tableActions,
  } = useTableData({
    tableId,
    baseId,
    search: searchQuery,
    sorting,
    filtering,
  });

  // Combine loading states - prioritize table operations over hook operations
  const currentLoadingStatus = tableSavingStatus ?? hookLoadingStatus;

  // Derived values for UI
  const baseName = baseNameAndColor?.name;
  const baseColor = getColorFromBaseId(baseId);
  const darkerColor = getDarkerColorFromBaseId(baseId);

  // Show error toast for table data errors (only once)
  if (error && !hookLoadingStatus) {
    toast.error(`Failed to load table: ${error}`);
  }

  // Show error toast for base errors
  if (baseError) {
    toast.error(`Failed to load base: ${baseError.message}`);
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      {/* Top Navigation */}
      <BaseTopNav baseName={baseName} baseColor={baseColor} />

      {/* Table Navigation */}
      <TableNav darkerColor={darkerColor} />

      {/* View Controls */}
      <ViewControl
        tableId={tableId}
        baseId={baseId}
        tableActions={tableActions}
        tableData={tableData ?? undefined}
        loadingStatus={currentLoadingStatus}
        setSearchQuery={handleSearchQueryChange}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        filtering={filtering}
        onFilteringChange={handleFilteringChange}
        onSortHighlightChange={handleSortHighlightChange}
        onFilterHighlightChange={handleFilterHighlightChange}
      />

      {/* Main Content Area */}
      <div className="flex min-h-0 flex-1 flex-row">
        {/* Left Sidebar */}
        <ViewSide />

        {/* Table Content */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {error ? (
            <ErrorState message={error} />
          ) : tableData ? (
            <TableView
              tableData={tableData}
              tableActions={tableActions}
              onSavingStateChange={setTableSavingStatus}
              highlights={highlights}
            />
          ) : (
            <TableSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}
