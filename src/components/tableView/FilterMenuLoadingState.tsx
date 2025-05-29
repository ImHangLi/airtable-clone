export function FilterMenuLoadingState() {
  return (
    <div className="space-y-2">
      {/* Skeleton loading state for filter rows */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-1/4 animate-pulse rounded-xs bg-gray-200"></div>
        <div className="h-8 w-1/4 animate-pulse rounded-xs bg-gray-200"></div>
        <div className="h-8 w-1/4 animate-pulse rounded-xs bg-gray-200"></div>
        <div className="h-8 w-1/4 animate-pulse rounded-xs bg-gray-200"></div>
        <div className="h-8 w-8 animate-pulse rounded-xs bg-gray-200"></div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-1/4 animate-pulse rounded-xs bg-gray-200"></div>
        <div className="h-8 w-1/4 animate-pulse rounded-xs bg-gray-200"></div>
        <div className="h-8 w-1/4 animate-pulse rounded-xs bg-gray-200"></div>
        <div className="h-8 w-1/4 animate-pulse rounded-xs bg-gray-200"></div>
        <div className="h-8 w-8 animate-pulse rounded-xs bg-gray-200"></div>
      </div>
    </div>
  );
}
