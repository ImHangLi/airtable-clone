import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import {
  ArrowUpDown,
  ChevronDown,
  Plus,
  Trash2,
  X,
  Baseline,
  Hash,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useState } from "react";
import { SortMenuLoadingState } from "./SortMenuLoadingState";
import type { ColumnHighlight } from "~/types/sorting";
import { useViewConfig } from "~/hooks/useViewConfig";
import { useSortLogic } from "~/hooks/useSortLogic";

interface SortMenuProps {
  tableId: string;
  viewId: string;
  onHighlightChange?: (highlights: ColumnHighlight[]) => void;
  onInvalidateTableData?: () => void;
}

export default function SortMenu({
  tableId,
  viewId,
  onHighlightChange,
  onInvalidateTableData,
}: SortMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [addSortOpen, setAddSortOpen] = useState(false);

  // Get data directly from hook
  const { columns, activeSorts, updateSorts } = useViewConfig({
    viewId,
    tableId,
  });

  // Use sort logic hook for all sorting functionality
  const {
    columnSelectorOpen,
    setColumnSelectorOpen,
    directionSelectorOpen,
    setDirectionSelectorOpen,
    validSorts,
    sortableColumns,
    handleAddSort,
    handleRemoveSort,
    handleClearAll,
    handleChangeSort,
    handleToggleSortDirection,
  } = useSortLogic({
    columns,
    activeSorts,
    updateSorts,
    onHighlightChange,
    onInvalidateTableData,
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded px-2 text-[13px] font-normal",
            validSorts.length > 0
              ? "bg-[#FFE0CC] text-gray-700 hover:border-rose-200 hover:shadow-[inset_0px_0px_0px_2px_rgba(0,0,0,0.1)]"
              : "text-gray-700 hover:bg-gray-100",
          )}
          title="Sort button"
        >
          <ArrowUpDown className="h-4 w-4" />
          {validSorts.length === 0
            ? "Sort"
            : `Sorted by ${validSorts.length} ${
                validSorts.length === 1 ? "field" : "fields"
              }`}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[400px] p-4"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mb-4 ml-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-medium text-gray-500">Sort by</h3>
          </div>
        </div>

        <div className="space-y-2">
          {validSorts.map((sort) => {
            const column = columns.find((col) => col.id === sort.id);
            if (!column) return null;

            return (
              <div
                key={sort.id}
                className="mx-2 flex items-center justify-between gap-2 px-1 py-2"
              >
                <div className="grow-[4] basis-0 rounded-xs border border-gray-200">
                  <Popover
                    open={columnSelectorOpen[sort.id] ?? false}
                    onOpenChange={(open) =>
                      setColumnSelectorOpen((prev) => ({
                        ...prev,
                        [sort.id]: open,
                      }))
                    }
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-full justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {column.type === "text" ? (
                            <Baseline className="h-3.5 w-3.5 text-gray-500" />
                          ) : (
                            <Hash className="h-3.5 w-3.5 text-gray-500" />
                          )}
                          <p>{column.name}</p>
                        </div>
                        <ChevronDown className="h-3 w-3 text-gray-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[200px] p-1">
                      <div className="space-y-1">
                        {sortableColumns
                          .filter(
                            (col) =>
                              !activeSorts.some((s) => s.id === col.id) ||
                              col.id === sort.id,
                          )
                          .map((col) => (
                            <button
                              key={col.id}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleChangeSort(sort.id, col.id);
                              }}
                              className="flex h-7 w-full items-center gap-2 rounded-sm px-2 text-xs hover:bg-gray-100"
                            >
                              {col.type === "text" ? (
                                <Baseline className="h-3.5 w-3.5 text-gray-500" />
                              ) : (
                                <Hash className="h-3.5 w-3.5 text-gray-500" />
                              )}
                              {col.name}
                            </button>
                          ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grow-[2] basis-0 rounded-xs border border-gray-200">
                  <Popover
                    open={directionSelectorOpen[sort.id] ?? false}
                    onOpenChange={(open) =>
                      setDirectionSelectorOpen((prev) => ({
                        ...prev,
                        [sort.id]: open,
                      }))
                    }
                  >
                    <PopoverTrigger asChild>
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
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[120px] p-1">
                      <div className="space-y-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (sort.desc) {
                              handleToggleSortDirection(sort.id);
                            }
                          }}
                          className="flex h-7 w-full items-center rounded-sm px-2 text-xs hover:bg-gray-100"
                        >
                          {column.type === "number" ? "1 → 9" : "A → Z"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!sort.desc) {
                              handleToggleSortDirection(sort.id);
                            }
                          }}
                          className="flex h-7 w-full items-center rounded-sm px-2 text-xs hover:bg-gray-100"
                        >
                          {column.type === "number" ? "9 → 1" : "Z → A"}
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
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
        ) : validSorts.length === 0 ? (
          <div className="space-y-1">
            {sortableColumns.map((column) => (
              <button
                key={column.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddSort(column.id);
                }}
                className="flex h-7 w-full items-center gap-2 rounded-sm px-2 text-xs hover:bg-gray-100"
              >
                {column.type === "text" ? (
                  <Baseline className="h-3.5 w-3.5 text-gray-500" />
                ) : (
                  <Hash className="h-3.5 w-3.5 text-gray-500" />
                )}
                {column.name}
              </button>
            ))}
          </div>
        ) : (
          <Popover open={addSortOpen} onOpenChange={setAddSortOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 h-7 gap-2 text-xs"
                hidden={
                  sortableColumns.filter(
                    (col) => !activeSorts.some((sort) => sort.id === col.id),
                  ).length === 0
                }
              >
                <Plus className="h-3 w-3 text-gray-500" />
                <p className="text-[13px] font-normal text-gray-500">
                  Add another sort
                </p>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[200px] p-1">
              <div className="space-y-1">
                {sortableColumns
                  .filter(
                    (col) => !activeSorts.some((sort) => sort.id === col.id),
                  )
                  .map((column) => (
                    <button
                      key={column.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddSort(column.id, () => setAddSortOpen(false));
                      }}
                      className="flex h-7 w-full items-center gap-2 rounded-sm px-2 text-xs hover:bg-gray-100"
                    >
                      {column.type === "text" ? (
                        <Baseline className="h-3.5 w-3.5 text-gray-500" />
                      ) : (
                        <Hash className="h-3.5 w-3.5 text-gray-500" />
                      )}
                      {column.name}
                    </button>
                  ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {validSorts.length > 0 && (
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
      </PopoverContent>
    </Popover>
  );
}
