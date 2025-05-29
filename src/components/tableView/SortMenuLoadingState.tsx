export function SortMenuLoadingState() {
  return (
    <div className="space-y-2">
      {/* Skeleton loading state */}
      <div className="flex items-center justify-between gap-2 rounded-sm border border-gray-200 p-2">
        <div className="h-7 w-24 animate-pulse rounded bg-gray-200"></div>
        <div className="h-7 w-16 animate-pulse rounded bg-gray-200"></div>
        <div className="h-7 w-7 animate-pulse rounded bg-gray-200"></div>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-sm border border-gray-200 p-2">
        <div className="h-7 w-20 animate-pulse rounded bg-gray-200"></div>
        <div className="h-7 w-16 animate-pulse rounded bg-gray-200"></div>
        <div className="h-7 w-7 animate-pulse rounded bg-gray-200"></div>
      </div>
    </div>
  );
}
