"use client";

import { use, useState, useCallback } from "react";
import { toast } from "sonner";
import BaseTopNav from "~/components/base/BaseTopNav";
import TableNav from "~/components/tableView/TableNav";
import ViewControl from "~/components/tableView/ViewControl";
import ViewSide from "~/components/tableView/ViewSide";
import TableView from "~/components/tableView/TableView";
import { TableSkeleton } from "~/components/tableView/TableSkeleton";
import { useTableData, type SortConfig } from "~/hooks/useTableData";
import { getColorFromBaseId, getDarkerColorFromBaseId } from "~/lib/utils";
import { api } from "~/trpc/react";

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
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // State for sorting functionality
  const [sorting, setSorting] = useState<SortConfig[]>([]);

  // Memoize the search query setter to prevent unnecessary re-renders
  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Memoize the sorting change handler
  const handleSortingChange = useCallback((newSorting: SortConfig[]) => {
    setSorting(newSorting);
  }, []);

  // Get base information using tRPC
  const { data: baseNameAndColor, error: baseError } =
    api.base.getNameAndColorById.useQuery({
      id: baseId,
    });

  // Get table data using our custom hook
  const { loading, error, tableData, tableActions } = useTableData({
    tableId,
    baseId,
    search: searchQuery,
    sorting,
  });

  // Derived values for UI
  const baseName = baseNameAndColor?.name;
  const baseColor = getColorFromBaseId(baseId);
  const darkerColor = getDarkerColorFromBaseId(baseId);

  // Show error toast for table data errors (only once)
  if (error && !loading) {
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
        isSaving={isSaving}
        setIsSaving={setIsSaving}
        setSearchQuery={handleSearchQueryChange}
        sorting={sorting}
        onSortingChange={handleSortingChange}
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
              onSavingStateChange={setIsSaving}
            />
          ) : (
            <TableSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}
