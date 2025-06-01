import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { ArrowUpDown, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useState, useCallback, useEffect } from "react";
import type { TableColumn } from "~/hooks/useTableData";
import { SortMenuLoadingState } from "./SortMenuLoadingState";
import type { ColumnHighlight } from "~/types/sorting";

export interface SortConfig {
  id: string;
  desc: boolean;
}

interface SortMenuProps {
  columns: TableColumn[];
  sorting: SortConfig[];
  onSortingChange: (sorting: SortConfig[]) => void;
  onHighlightChange?: (highlights: ColumnHighlight[]) => void;
}

export default function SortMenu({
  columns,
  sorting,
  onSortingChange,
  onHighlightChange,
}: SortMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [addSortOpen, setAddSortOpen] = useState(false);

  // Filter columns that can be sorted (exclude hidden columns)
  const sortableColumns = columns;

  // Update column highlights when sorting changes
  useEffect(() => {
    if (!onHighlightChange) return;

    const highlights: ColumnHighlight[] = sorting.map((sort) => ({
      columnId: sort.id,
      type: "sort",
      color: "#fff2ea",
    }));

    onHighlightChange(highlights);
  }, [sorting, onHighlightChange]);

  const handleAddSort = useCallback(
    (columnId: string) => {
      const newSort: SortConfig = { id: columnId, desc: false };
      onSortingChange([...sorting, newSort]);
      setAddSortOpen(false);
    },
    [sorting, onSortingChange],
  );

  const handleRemoveSort = useCallback(
    (columnId: string) => {
      onSortingChange(sorting.filter((sort) => sort.id !== columnId));
    },
    [sorting, onSortingChange],
  );

  const handleClearAll = useCallback(() => {
    onSortingChange([]);
  }, [onSortingChange]);

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
            "h-8 gap-1.5 rounded px-2 text-[13px] font-normal",
            sorting.length > 0
              ? "bg-[#FFE0CC] text-gray-700 hover:border-rose-200 hover:shadow-[inset_0px_0px_0px_2px_rgba(0,0,0,0.1)]"
              : "text-gray-700 hover:bg-gray-100",
          )}
          title="Sort button"
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
            <h3 className="text-[13px] font-medium text-gray-500">Sort by</h3>
          </div>
        </div>

        <div className="space-y-2">
          {sorting.map((sort) => {
            const column = columns.find((col) => col.id === sort.id);
            if (!column) return null;

            return (
              <div
                key={sort.id}
                className="mx-2 flex items-center justify-between gap-2 px-1 py-2"
              >
                <div className="grow-[4] basis-0 rounded-xs border border-gray-200">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-full justify-between gap-2 text-xs"
                      >
                        <p>{column.name}</p>
                        <ChevronDown className="h-3 w-3 text-gray-500" />
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

                <div className="grow-[2] basis-0 rounded-xs border border-gray-200">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-full justify-between gap-2 text-xs"
                      >
                        {column.type === "number"
                          ? sort.desc
                            ? "9 → 1"
                            : "1 → 9"
                          : sort.desc
                            ? "Z → A"
                            : "A → Z"}
                        <ChevronDown className="h-3 w-3 text-gray-500" />
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
                  <X className="h-3 w-3 text-gray-500" />
                </Button>
              </div>
            );
          })}
        </div>

        {columns.length === 0 ? (
          <SortMenuLoadingState />
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
                <Plus className="h-3 w-3 text-gray-500" />
                <p className="text-[13px] font-normal text-gray-500">
                  Add another sort
                </p>
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
              <Trash2 className="h-3 w-3 text-gray-500" />
              <p className="text-[13px] font-normal text-gray-500">
                Clear all sorts
              </p>
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
