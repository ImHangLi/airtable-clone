import { useState, useCallback, useEffect, useMemo } from "react";
import type { TableColumn } from "~/hooks/useTableData";
import type { ColumnHighlight, SortConfig } from "~/types/sorting";

interface UseSortLogicProps {
  columns: TableColumn[];
  activeSorts: SortConfig[];
  updateSorts: (sorts: SortConfig[]) => void;
  onHighlightChange?: (highlights: ColumnHighlight[]) => void;
  onInvalidateTableData?: () => void;
}

export function useSortLogic({
  columns,
  activeSorts,
  updateSorts,
  onHighlightChange,
  onInvalidateTableData,
}: UseSortLogicProps) {
  const [columnSelectorOpen, setColumnSelectorOpen] = useState<
    Record<string, boolean>
  >({});
  const [directionSelectorOpen, setDirectionSelectorOpen] = useState<
    Record<string, boolean>
  >({});

  // Filter out sorts for columns that no longer exist
  const validSorts = useMemo(
    () =>
      activeSorts.filter((sort) => columns.some((col) => col.id === sort.id)),
    [activeSorts, columns],
  );

  // Filter columns that can be sorted (exclude hidden columns)
  const sortableColumns = columns;

  // Update column highlights when sorting changes
  useEffect(() => {
    if (!onHighlightChange) return;

    const highlights: ColumnHighlight[] = validSorts.map((sort) => ({
      columnId: sort.id,
      type: "sort",
      color: "#fff2ea",
    }));

    onHighlightChange(highlights);
  }, [validSorts, onHighlightChange]);

  const handleAddSort = useCallback(
    (columnId: string, onClose?: () => void) => {
      const newSort: SortConfig = { id: columnId, desc: false };
      updateSorts([...activeSorts, newSort]);
      if (onClose) onClose();
    },
    [activeSorts, updateSorts],
  );

  const handleRemoveSort = useCallback(
    (columnId: string) => {
      updateSorts(activeSorts.filter((sort) => sort.id !== columnId));
    },
    [activeSorts, updateSorts],
  );

  const handleClearAll = useCallback(() => {
    updateSorts([]);
    if (onInvalidateTableData) {
      onInvalidateTableData();
    }
  }, [updateSorts, onInvalidateTableData]);

  const handleChangeSort = useCallback(
    (oldColumnId: string, newColumnId: string) => {
      updateSorts(
        activeSorts.map((sort) =>
          sort.id === oldColumnId ? { ...sort, id: newColumnId } : sort,
        ),
      );

      // Close the popover
      setColumnSelectorOpen((prev) => ({
        ...prev,
        [oldColumnId]: false,
      }));
    },
    [activeSorts, updateSorts],
  );

  const handleToggleSortDirection = useCallback(
    (columnId: string) => {
      updateSorts(
        activeSorts.map((sort) =>
          sort.id === columnId ? { ...sort, desc: !sort.desc } : sort,
        ),
      );

      // Close the popover
      setDirectionSelectorOpen((prev) => ({
        ...prev,
        [columnId]: false,
      }));
    },
    [activeSorts, updateSorts],
  );

  return {
    // State
    columnSelectorOpen,
    setColumnSelectorOpen,
    directionSelectorOpen,
    setDirectionSelectorOpen,

    // Computed values
    validSorts,
    sortableColumns,

    // Handlers
    handleAddSort,
    handleRemoveSort,
    handleClearAll,
    handleChangeSort,
    handleToggleSortDirection,
  };
}
