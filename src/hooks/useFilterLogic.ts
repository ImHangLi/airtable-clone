import { useState, useCallback, useEffect, useMemo } from "react";
import { useDebounce } from "~/hooks/useDebounce";
import type { TableColumn } from "~/hooks/useTableData";
import type { FilterConfig } from "~/types/filtering";
import { operatorRequiresValue } from "~/types/filtering";
import type { ColumnHighlight } from "~/types/sorting";

interface UseFilterLogicProps {
  columns: TableColumn[];
  filtering?: FilterConfig[];
  onFilteringChange: (filtering: FilterConfig[]) => void;
  onHighlightChange?: (highlights: ColumnHighlight[]) => void;
  onInvalidateTableData?: () => void;
}

export function useFilterLogic({
  columns,
  filtering = [],
  onFilteringChange,
  onHighlightChange,
  onInvalidateTableData,
}: UseFilterLogicProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const debouncedInputValues = useDebounce(inputValues, 1000);

  // Filter out filters for columns that no longer exist
  const validFilters = useMemo(() => {
    return filtering.filter((filter) =>
      columns.some((col) => col.id === filter.columnId),
    );
  }, [filtering, columns]);

  // Get filters that are actually applied (have values or don't require values)
  const appliedFilters = useMemo(() => {
    return validFilters.filter((filter) => {
      // If operator doesn't require a value (like "is empty", "is not empty"), it's always applied
      if (!operatorRequiresValue(filter.operator)) {
        return true;
      }
      // For operators that require values, check if value is not empty
      const currentValue = inputValues[filter.id] ?? filter.value;
      return currentValue.trim() !== "";
    });
  }, [validFilters, inputValues]);

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
    if (!filtering.length) return;

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

    // appliedFilters is already filtered for valid columns, so no need to filter again
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

      const newFiltering = [...filtering];
      const defaultOperator = column.type === "text" ? "contains" : "equals";

      // Determine logical operator for new filter
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
      const newFiltering = filtering.filter((filter) => filter.id !== filterId);
      onFilteringChange(newFiltering);

      // Clean up input values
      setInputValues((prev) => {
        const { ...rest } = prev;
        return rest;
      });
    },
    [filtering, onFilteringChange],
  );

  const handleChangeFilterColumn = useCallback(
    (filterId: string, newColumnId: string) => {
      const newColumn = columns.find((col) => col.id === newColumnId);
      if (!newColumn) return;

      const newFiltering = filtering.map((filter) => {
        if (filter.id === filterId) {
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
      const newFiltering = filtering.map((filter) => {
        if (filter.id === filterId) {
          return {
            ...filter,
            operator: newOperator,
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
      const newFiltering = filtering.map((filter, index) => {
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

  const handleClearAllFilters = useCallback(() => {
    onFilteringChange([]);
    setInputValues({});
    if (onInvalidateTableData) {
      onInvalidateTableData();
    }
  }, [onFilteringChange, onInvalidateTableData]);

  return {
    // State
    inputValues,

    // Computed values
    appliedFilters,
    activeFilters: validFilters, // Use validFilters instead of raw filtering
    getFilteredFieldNames,

    // Handlers
    handleAddFilter,
    handleRemoveFilter,
    handleChangeFilterColumn,
    handleChangeFilterOperator,
    handleChangeFilterLogicalOperator,
    handleChangeFilterValue,
    handleClearAllFilters,
  };
}
