import { useState } from "react";
import { Filter, Plus, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { ColumnHighlight } from "~/types/sorting";
import { useFilterLogic } from "~/hooks/useFilterLogic";
import { FilterCondition } from "./FilterCondition";
import { FilterMenuLoadingState } from "./FilterMenuLoadingState";
import { useViewConfig } from "~/hooks/useViewConfig";

interface FilterMenuProps {
  tableId: string;
  viewId: string;
  onHighlightChange?: (highlights: ColumnHighlight[]) => void;
  onInvalidateTableData?: () => void;
}

export default function FilterMenu({
  tableId,
  viewId,
  onHighlightChange,
  onInvalidateTableData,
}: FilterMenuProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  // Get data directly from hook
  const { columns, allFilters, updateFilters } = useViewConfig({
    viewId,
    tableId,
  });

  // Use our custom hook for all filter logic
  const {
    inputValues,
    appliedFilters,
    activeFilters,
    getFilteredFieldNames,
    handleAddFilter,
    handleRemoveFilter,
    handleChangeFilterColumn,
    handleChangeFilterOperator,
    handleChangeFilterLogicalOperator,
    handleChangeFilterValue,
    handleClearAllFilters,
  } = useFilterLogic({
    columns,
    filtering: allFilters,
    onFilteringChange: updateFilters,
    onHighlightChange,
    onInvalidateTableData,
  });

  return (
    <Popover open={filterOpen} onOpenChange={setFilterOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded px-2 text-[13px] font-normal",
            appliedFilters.length > 0
              ? "bg-[#CFF5D1] text-gray-700 hover:shadow-[inset_0px_0px_0px_2px_rgba(0,0,0,0.1)]"
              : "text-gray-700 hover:bg-gray-100",
          )}
          title="Filter button"
        >
          <Filter className="h-4 w-4" />
          {appliedFilters.length === 0
            ? "Filter"
            : `Filtered by ${getFilteredFieldNames()}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-4"
        style={{
          width: activeFilters.length === 0 ? "331px" : "590px",
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[13px] text-gray-500">
              {activeFilters.length === 0
                ? "No filter conditions applied"
                : "In this view, show records where"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {columns.length === 0 ? (
            <FilterMenuLoadingState />
          ) : (
            activeFilters.map((filter, index) => (
              <FilterCondition
                key={filter.id}
                filter={filter}
                index={index}
                columns={columns}
                inputValue={inputValues[filter.id] ?? filter.value}
                onChangeColumn={handleChangeFilterColumn}
                onChangeOperator={handleChangeFilterOperator}
                onChangeLogicalOperator={handleChangeFilterLogicalOperator}
                onChangeValue={handleChangeFilterValue}
                onRemove={handleRemoveFilter}
              />
            ))
          )}

          {columns.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[13px] text-[#616670]"
              onClick={() => {
                // Create filter with first available column
                if (columns.length > 0 && columns[0]) {
                  handleAddFilter(columns[0].id);
                }
              }}
            >
              <Plus className="ml-[-12px] h-3 w-3" />
              Add condition
            </Button>
          )}
        </div>

        {activeFilters.length > 0 && (
          <div>
            <div className="my-2 border-t border-gray-200"></div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[13px] text-[#616670] hover:text-rose-500"
              onClick={handleClearAllFilters}
            >
              <Trash2 className="ml-[-12px] h-3 w-3" />
              Clear all filters
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
