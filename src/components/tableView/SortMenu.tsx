import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { ArrowUpDown, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useState, useCallback } from "react";
import type { TableColumn } from "~/hooks/useTableData";

// Define sorting types
export interface SortConfig {
  id: string;
  desc: boolean;
}

interface SortMenuProps {
  columns: TableColumn[];
  sorting: SortConfig[];
  onSortingChange: (sorting: SortConfig[]) => void;
}

export default function SortMenu({
  columns,
  sorting,
  onSortingChange,
}: SortMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [addSortOpen, setAddSortOpen] = useState(false);

  // Filter columns that can be sorted (all columns in our case)
  const sortableColumns = columns;

  // Handle adding a new sort
  const handleAddSort = useCallback(
    (columnId: string) => {
      const newSort: SortConfig = { id: columnId, desc: false };
      onSortingChange([...sorting, newSort]);
      setAddSortOpen(false);
    },
    [sorting, onSortingChange],
  );

  // Handle removing a sort
  const handleRemoveSort = useCallback(
    (columnId: string) => {
      onSortingChange(sorting.filter((sort) => sort.id !== columnId));
    },
    [sorting, onSortingChange],
  );

  // Handle clearing all sorts
  const handleClearAll = useCallback(() => {
    onSortingChange([]);
  }, [onSortingChange]);

  // Handle changing which column a sort applies to
  const handleChangeSort = useCallback(
    (oldColumnId: string, newColumnId: string) => {
      onSortingChange(
        sorting.map((sort) =>
          sort.id === oldColumnId ? { ...sort, id: newColumnId } : sort,
        ),
      );
    },
    [sorting, onSortingChange],
  );

  // Handle toggling sort direction
  const handleToggleSortDirection = useCallback(
    (columnId: string) => {
      onSortingChange(
        sorting.map((sort) =>
          sort.id === columnId ? { ...sort, desc: !sort.desc } : sort,
        ),
      );
    },
    [sorting, onSortingChange],
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded px-2 text-sm font-normal",
            sorting.length > 0
              ? "bg-[#FFE0CC] text-gray-700 hover:border-rose-200 hover:shadow-[inset_0px_0px_0px_2px_rgba(0,0,0,0.1)]"
              : "text-gray-700 hover:bg-gray-100",
          )}
        >
          <ArrowUpDown className="h-4 w-4" />
          {sorting.length === 0
            ? "Sort"
            : `Sorted by ${sorting.length} ${
                sorting.length === 1 ? "field" : "fields"
              }`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[400px] p-4"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mb-4 ml-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-medium">Sort by</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mr-1 h-5 w-5 p-0"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-2">
          {sorting.map((sort) => {
            const column = columns.find((col) => col.id === sort.id);
            if (!column) return null;

            return (
              <div
                key={sort.id}
                className="mx-2 flex items-center justify-between gap-2 rounded-sm border border-gray-200 p-2"
              >
                <div className="grow-[4] basis-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 justify-between gap-2 text-xs"
                      >
                        {column.name}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[200px]">
                      {sortableColumns
                        .filter(
                          (col) =>
                            !sorting.some((s) => s.id === col.id) ||
                            col.id === sort.id,
                        )
                        .map((col) => (
                          <DropdownMenuItem
                            key={col.id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleChangeSort(sort.id, col.id);
                            }}
                          >
                            {col.name}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grow-[2] basis-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 justify-between gap-2 text-xs"
                      >
                        {column.type === "number"
                          ? sort.desc
                            ? "9 → 1"
                            : "1 → 9"
                          : sort.desc
                            ? "Z → A"
                            : "A → Z"}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[120px]">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (sort.desc) {
                            handleToggleSortDirection(sort.id);
                          }
                        }}
                      >
                        {column.type === "number" ? "1 → 9" : "A → Z"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!sort.desc) {
                            handleToggleSortDirection(sort.id);
                          }
                        }}
                      >
                        {column.type === "number" ? "9 → 1" : "Z → A"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 grow-[1] basis-0 p-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemoveSort(sort.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>

        {columns.length === 0 ? (
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
        ) : sorting.length === 0 ? (
          <div className="space-y-1">
            {sortableColumns.map((column) => (
              <DropdownMenuItem
                key={column.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddSort(column.id);
                }}
                className="h-7 text-xs"
              >
                {column.name}
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <DropdownMenu open={addSortOpen} onOpenChange={setAddSortOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 h-7 gap-2 text-xs"
                hidden={
                  sortableColumns.filter(
                    (col) => !sorting.some((sort) => sort.id === col.id),
                  ).length === 0
                }
              >
                <Plus className="h-3 w-3" />
                <p className="text-[13px] font-normal">Add another sort</p>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              {sortableColumns
                .filter((col) => !sorting.some((sort) => sort.id === col.id))
                .map((column) => (
                  <DropdownMenuItem
                    key={column.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddSort(column.id);
                    }}
                    className="h-7 text-xs"
                  >
                    {column.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {sorting.length > 0 && (
          <div>
            <div className="my-2 border-t border-gray-200"></div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-2 text-xs hover:text-rose-500"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClearAll();
              }}
            >
              <Trash2 className="h-3 w-3" />
              <p className="text-[13px] font-normal">Clear all sorts</p>
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
