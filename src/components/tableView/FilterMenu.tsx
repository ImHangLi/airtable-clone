import { useState, useCallback, useEffect, useMemo } from "react";
import { Filter, ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { useDebounce } from "~/hooks/useDebounce";
import type { TableColumn } from "~/hooks/useTableData";
import type { FilterConfig } from "~/types/filtering";
import {
  getAvailableOperators,
  formatOperatorName,
  operatorRequiresValue,
} from "~/types/filtering";
import { FilterMenuLoadingState } from "./FilterMenuLoadingState";
import type { ColumnHighlight } from "~/types/sorting";

interface FilterMenuProps {
  columns: TableColumn[];
  filtering?: FilterConfig[];
  onFilteringChange: (filtering: FilterConfig[]) => void;
  onHighlightChange?: (highlights: ColumnHighlight[]) => void;
  onInvalidateTableData?: () => void;
}

export default function FilterMenu({
  columns,
  filtering = [],
  onFilteringChange,
  onHighlightChange,
  onInvalidateTableData,
}: FilterMenuProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // All columns are filterable - we can filter on any column type
  const filterableColumns = columns;

  // Get filters that are actually applied (have values or don't require values)
  const appliedFilters = useMemo(() => {
    return filtering.filter((filter) => {
      // If operator doesn't require a value (like "is empty", "is not empty"), it's always applied
      if (!operatorRequiresValue(filter.operator)) {
        return true;
      }

      // For operators that require values, check if value is not empty
      const currentValue = inputValues[filter.id] ?? filter.value;
      return currentValue.trim() !== "";
    });
  }, [filtering, inputValues]);

  const activeFilters = filtering || [];

  const debouncedInputValues = useDebounce(inputValues, 1000);

  // Helper function to get field names for applied filters only and remove duplicates
  const getFilteredFieldNames = useCallback(() => {
    if (appliedFilters.length === 0) return "";

    const fieldNames = appliedFilters
      .map((filter) => {
        const column = columns.find((col) => col.id === filter.columnId);
        return column?.name ?? "";
      })
      .filter((name, index, self) => self.indexOf(name) === index)
      .join(", ");

    return fieldNames;
  }, [appliedFilters, columns]);

  // Effect to update filter values when debounced input changes
  useEffect(() => {
    if (!filtering) return;

    const updatedFiltering = filtering.map((filter) => ({
      ...filter,
      value: debouncedInputValues[filter.id] ?? filter.value,
    }));

    if (JSON.stringify(updatedFiltering) !== JSON.stringify(filtering)) {
      onFilteringChange(updatedFiltering);
    }
  }, [debouncedInputValues, filtering, onFilteringChange]);

  // Update column highlights when applied filters change
  useEffect(() => {
    if (!onHighlightChange) return;

    const highlights: ColumnHighlight[] = appliedFilters.map((filter) => ({
      columnId: filter.columnId,
      type: "filter",
      color: "#CFF5D1",
    }));

    onHighlightChange(highlights);
  }, [appliedFilters, onHighlightChange]);

  const handleAddFilter = useCallback(
    (columnId: string) => {
      const column = columns.find((col) => col.id === columnId);
      if (!column) return;

      const newFiltering = [...(filtering || [])];
      const defaultOperator = column.type === "text" ? "contains" : "equals";

      // Determine logical operator for new filter
      // If there are existing filters, use the same logical operator as the last filter
      // Otherwise, default to "and"
      const lastFilter = newFiltering[newFiltering.length - 1];
      const logicalOperator =
        newFiltering.length > 0
          ? (lastFilter?.logicalOperator ?? "and")
          : undefined;

      const newFilter: FilterConfig = {
        id: crypto.randomUUID(),
        columnId,
        operator: defaultOperator as FilterConfig["operator"],
        value: "",
        order: newFiltering.length,
        logicalOperator: newFiltering.length > 0 ? logicalOperator : undefined,
      };
      newFiltering.push(newFilter);
      onFilteringChange(newFiltering);
    },
    [filtering, onFilteringChange, columns],
  );

  const handleRemoveFilter = useCallback(
    (filterId: string) => {
      const newFiltering = (filtering || []).filter(
        (filter) => filter.id !== filterId,
      );
      onFilteringChange(newFiltering);
    },
    [filtering, onFilteringChange],
  );

  const handleChangeFilterColumn = useCallback(
    (filterId: string, newColumnId: string) => {
      const newColumn = columns.find((col) => col.id === newColumnId);
      if (!newColumn) return;

      const newFiltering = (filtering || []).map((filter) => {
        if (filter.id === filterId) {
          // Reset operator to default for new column type
          const defaultOperator =
            newColumn.type === "text" ? "contains" : "equals";
          return {
            ...filter,
            columnId: newColumnId,
            operator: defaultOperator as FilterConfig["operator"],
            value: "", // Reset value when changing column
          };
        }
        return filter;
      });
      onFilteringChange(newFiltering);

      // Clear input value for this filter
      setInputValues((prev) => ({
        ...prev,
        [filterId]: "",
      }));
    },
    [filtering, onFilteringChange, columns],
  );

  const handleChangeFilterOperator = useCallback(
    (filterId: string, newOperator: FilterConfig["operator"]) => {
      const newFiltering = (filtering || []).map((filter) => {
        if (filter.id === filterId) {
          return {
            ...filter,
            operator: newOperator,
            // Clear value if switching to empty/not empty operators
            value: operatorRequiresValue(newOperator) ? filter.value : "",
          };
        }
        return filter;
      });
      onFilteringChange(newFiltering);

      // Clear input value if operator doesn't require value
      if (!operatorRequiresValue(newOperator)) {
        setInputValues((prev) => ({
          ...prev,
          [filterId]: "",
        }));
      }
    },
    [filtering, onFilteringChange],
  );

  const handleChangeFilterLogicalOperator = useCallback(
    (filterId: string, newLogicalOperator: "and" | "or") => {
      const newFiltering = (filtering || []).map((filter, index) => {
        // Update all filters from the second one onwards (index >= 1)
        if (index >= 1) {
          return {
            ...filter,
            logicalOperator: newLogicalOperator,
          };
        }
        return filter;
      });
      onFilteringChange(newFiltering);
    },
    [filtering, onFilteringChange],
  );

  const handleChangeFilterValue = useCallback(
    (filterId: string, newValue: string) => {
      setInputValues((prev) => ({
        ...prev,
        [filterId]: newValue,
      }));
    },
    [],
  );

  return (
    <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="p-4"
        style={{
          width: activeFilters.length === 0 ? "331px" : "590px",
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
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
            activeFilters.map((filter, index) => {
              const column = columns.find((col) => col.id === filter.columnId);
              if (!column) return null;

              const availableOperators = getAvailableOperators(column.type);

              return (
                <div key={filter.id} className="flex items-center gap-2">
                  {/* Logical Operator - only second filter gets dropdown, others just show text */}
                  {index === 0 ? (
                    <div className="flex h-8 w-1/4 items-center justify-center rounded-xs text-[13px] font-light">
                      Where
                    </div>
                  ) : index === 1 ? (
                    // Only the second filter (first with logical operator) gets a dropdown
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-[24.5%] justify-center gap-1 rounded-xs border border-gray-200 text-[13px] font-light hover:bg-gray-50"
                        >
                          {filter.logicalOperator ?? "and"}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[80px]">
                        <DropdownMenuItem
                          onClick={() =>
                            handleChangeFilterLogicalOperator(filter.id, "and")
                          }
                          className="h-7 text-[13px] font-light"
                        >
                          and
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleChangeFilterLogicalOperator(filter.id, "or")
                          }
                          className="h-7 text-[13px] font-light"
                        >
                          or
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    // All subsequent filters just show the logical operator as text
                    <div className="flex h-8 w-1/4 items-center justify-center rounded-xs text-[13px] font-light">
                      {filter.logicalOperator ?? "and"}
                    </div>
                  )}

                  {/* Column Selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-1/4 justify-between gap-2 rounded-xs border border-gray-200 text-[13px] font-light"
                      >
                        <div className="flex items-center gap-2">
                          <span>{column.name}</span>
                        </div>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[190px]">
                      {filterableColumns.map((col) => (
                        <DropdownMenuItem
                          key={col.id}
                          onClick={() =>
                            handleChangeFilterColumn(filter.id, col.id)
                          }
                          className="h-7 text-[13px] font-light"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span>{col.name}</span>
                            <span className="ml-2 text-[13px] font-light text-gray-400">
                              {col.type}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Operator Selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-1/4 justify-between gap-2 rounded-xs border border-gray-200 text-[13px] font-light"
                      >
                        {formatOperatorName(filter.operator)}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[190px]">
                      {availableOperators.map((op) => (
                        <DropdownMenuItem
                          key={op}
                          onClick={() =>
                            handleChangeFilterOperator(filter.id, op)
                          }
                          className="h-7 text-[13px] font-light"
                        >
                          {formatOperatorName(op)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Value Input - only show if operator requires a value */}
                  {operatorRequiresValue(filter.operator) ? (
                    <Input
                      value={inputValues[filter.id] ?? filter.value}
                      onChange={(e) =>
                        handleChangeFilterValue(filter.id, e.target.value)
                      }
                      placeholder={"Enter a value"}
                      type={column.type === "number" ? "number" : "text"}
                      className="h-8 w-1/4 rounded-xs border border-gray-200 text-[13px] font-light"
                    />
                  ) : (
                    // Empty placeholder to maintain layout when no input is needed
                    <div className="w-1/4"></div>
                  )}

                  {/* Remove Filter Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 rounded-xs border border-gray-200 p-0 text-gray-400 hover:bg-gray-50"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveFilter(filter.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })
          )}

          {columns.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[13px] text-[#616670]"
              onClick={() => {
                // Create filter with first available column
                if (filterableColumns.length > 0 && filterableColumns[0]) {
                  handleAddFilter(filterableColumns[0].id);
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
              onClick={() => {
                // Clear all filters
                onFilteringChange([]);
                setInputValues({});
                if (onInvalidateTableData) {
                  onInvalidateTableData();
                }
              }}
            >
              <Trash2 className="ml-[-12px] h-3 w-3" />
              Clear all filters
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
