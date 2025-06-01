"use client";

import {
  type ColumnDef,
  useReactTable,
  getCoreRowModel,
  flexRender,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import type {
  TableRow,
  TableActions,
  TableData,
  TableColumn,
} from "~/hooks/useTableData";
import type { ColumnHighlight } from "~/types/sorting";
import type { SearchMatch } from "~/hooks/useTableSearch";

import { RowNumberCell } from "./RowNumberCell";
import { ColumnHeaderEditor } from "./ColumnHeaderEditor";
import { RowContextMenu } from "./RowContextMenu";
import { createCellRenderer } from "./cellRenderers";
import { CELL_CONFIG, baseCellStyle } from "./constants";
import { useSearchScrolling } from "~/hooks/useSearchScrolling";

interface TableViewProps {
  tableData: TableData;
  tableActions: TableActions;
  onSavingStateChange?: (savingStatus: string | null) => void;
  highlights?: ColumnHighlight[];
  hiddenColumns: string[];
  searchMatches?: SearchMatch[];
  currentTargetMatch?: SearchMatch | null;
}

const getCellWidth = (isRowNumber = false) => ({
  width: isRowNumber ? CELL_CONFIG.rowNumberWidth : CELL_CONFIG.defaultWidth,
  minWidth: isRowNumber ? CELL_CONFIG.rowNumberWidth : CELL_CONFIG.defaultWidth,
  maxWidth: isRowNumber ? CELL_CONFIG.rowNumberWidth : CELL_CONFIG.defaultWidth,
});

// Main TableView component with virtualization
export default function TableView({
  tableData,
  tableActions,
  onSavingStateChange,
  highlights,
  hiddenColumns = [],
  searchMatches = [],
  currentTargetMatch = null,
}: TableViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    rowId: string | null;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    rowId: null,
    position: { x: 0, y: 0 },
  });

  // Column editor state
  const [columnEditor, setColumnEditor] = useState<{
    isOpen: boolean;
    columnId: string | null;
    columnName: string | null;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    columnId: null,
    columnName: null,
    position: { x: 0, y: 0 },
  });

  // Hidden columns state
  const columnVisibility = useMemo(() => {
    const visibility: VisibilityState = {
      // Always show row number column
      rowNumber: true,
    };

    // Show all columns that are not hidden
    tableData.columns.forEach((column) => {
      visibility[column.id] = !hiddenColumns.includes(column.id);
    });

    return visibility;
  }, [tableData.columns, hiddenColumns]);

  // Notify parent when saving state changes
  useEffect(() => {
    onSavingStateChange?.(savingStatus);
  }, [savingStatus, onSavingStateChange]);

  // Helper function to get cell highlight style
  const getCellHighlightStyle = useCallback(
    (columnId: string): React.CSSProperties => {
      if (!highlights || highlights.length === 0) return {};

      const highlight = highlights.find((h) => h.columnId === columnId);
      if (!highlight) return {};

      return {
        backgroundColor: highlight.color,
      };
    },
    [highlights],
  );

  // Helper function to get search highlight style
  const getSearchHighlightStyle = useCallback(
    (rowId: string, columnId: string): React.CSSProperties => {
      if (!searchMatches || searchMatches.length === 0) return {};

      const searchMatch = searchMatches.find(
        (match) => match.rowId === rowId && match.columnId === columnId,
      );

      if (!searchMatch) return {};

      return {
        backgroundColor: searchMatch.isCurrentTarget ? "#f1cf6b" : "#fff3d3",
      };
    },
    [searchMatches],
  );

  // Combined highlight style that prioritizes search over sort/filter
  const getCombinedHighlightStyle = useCallback(
    (rowId: string, columnId: string): React.CSSProperties => {
      const searchStyle = getSearchHighlightStyle(rowId, columnId);
      const cellStyle = getCellHighlightStyle(columnId);

      // Search highlighting takes priority over sort/filter highlighting
      return searchStyle.backgroundColor ? searchStyle : cellStyle;
    },
    [getSearchHighlightStyle, getCellHighlightStyle],
  );

  // Virtual row renderer
  const rowVirtualizer = useVirtualizer({
    count: tableData.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CELL_CONFIG.height,
    overscan: 20,
  });

  // Search scrolling functionality - moved after rowVirtualizer definition
  const { scrollToMatch: _scrollToMatch } = useSearchScrolling({
    currentTargetMatch,
    tableRows: tableData.rows,
    parentRef: parentRef as React.RefObject<HTMLDivElement>,
    rowVirtualizer,
    rowHeight: CELL_CONFIG.height,
  });

  // Note: _scrollToMatch is available for manual scrolling if needed

  // Memoized update function for table meta
  const updateData = useCallback(
    async (rowId: string, columnId: string, value: string | number) => {
      setSavingStatus("Updating cell...");
      try {
        await tableActions.updateCell(rowId, columnId, value);
      } finally {
        setSavingStatus(null);
      }
    },
    [tableActions],
  );

  // Handle right-click on row
  const handleRowRightClick = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        isOpen: true,
        rowId,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [],
  );

  // Handle delete row from context menu
  const handleDeleteRow = useCallback(
    async (rowId: string) => {
      // Immediately close the menu and set saving state
      setContextMenu((prev) => ({
        ...prev,
        isOpen: false,
        rowId: null,
      }));
      setSavingStatus("Deleting row...");

      try {
        const success = await tableActions.deleteRow(rowId);
        if (!success) {
          toast.error("Failed to delete record");
        }
      } catch (error) {
        console.error("Error deleting row:", error);
        toast.error("Failed to delete record");
      } finally {
        setSavingStatus(null);
      }
    },
    [tableActions],
  );

  // Handle context menu close
  const handleContextMenuClose = useCallback(() => {
    if (!savingStatus) {
      setContextMenu((prev) => ({
        ...prev,
        isOpen: false,
        rowId: null,
      }));
    }
  }, [savingStatus]);

  // Handle column header click
  const handleColumnHeaderRightClick = useCallback(
    (e: React.MouseEvent, columnId: string, columnName: string) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setColumnEditor({
        isOpen: true,
        columnId,
        columnName,
        position: { x: rect.left, y: rect.bottom + 4 },
      });
    },
    [],
  );

  // Handle column editor close
  const handleColumnEditorClose = useCallback(() => {
    setColumnEditor((prev) => ({
      ...prev,
      isOpen: false,
      columnId: null,
      columnName: null,
    }));
  }, []);

  // Handle column update from editor
  const handleColumnUpdate = useCallback(
    async (columnName: string) => {
      if (!columnEditor.columnId) return;

      handleColumnEditorClose();

      setSavingStatus("Updating column...");
      try {
        const success = await tableActions.updateColumn(
          columnEditor.columnId,
          columnName,
        );
        if (!success) {
          toast.error("Failed to update column");
        }
      } catch (error) {
        console.error("Error updating column:", error);
        toast.error("Failed to update column");
      } finally {
        setSavingStatus(null);
      }
    },
    [columnEditor.columnId, handleColumnEditorClose, tableActions],
  );

  // Handle column delete from editor
  const handleColumnDelete = useCallback(
    async (columnId: string) => {
      handleColumnEditorClose();

      // Check if this is a primary column
      const column = tableData.columns.find((col) => col.id === columnId);
      if (column?.is_primary) {
        toast.error("Cannot delete primary field");
        return;
      }

      setSavingStatus("Deleting column...");
      try {
        const success = await tableActions.deleteColumn(columnId);
        if (!success) {
          toast.error("Failed to delete column");
        }
      } catch (error) {
        console.error("Error deleting column:", error);
        toast.error("Failed to delete column");
      } finally {
        setSavingStatus(null);
      }
    },
    [handleColumnEditorClose, tableActions, tableData.columns],
  );

  // Memoized cell renderers
  const textCellRenderer = useMemo(() => createCellRenderer("text"), []);
  const numberCellRenderer = useMemo(() => createCellRenderer("number"), []);

  // Memoized header renderer
  const createHeaderRenderer = useCallback(
    (columnId: string, columnName: string) => {
      const columnHeaderEditor = () => (
        <button
          className="h-full w-full bg-transparent text-left text-[13px] outline-none hover:bg-gray-50 focus:bg-gray-50"
          style={baseCellStyle}
          onContextMenu={(e) =>
            handleColumnHeaderRightClick(e, columnId, columnName)
          }
        >
          {columnName}
        </button>
      );
      return columnHeaderEditor;
    },
    [handleColumnHeaderRightClick],
  );

  // Create table columns with enhanced meta
  const tableColumns: ColumnDef<TableRow>[] = useMemo(() => {
    const columns: ColumnDef<TableRow>[] = [
      {
        id: "rowNumber",
        header: "",
        cell: ({ row }) => <RowNumberCell rowIndex={row.index} />,
        size: CELL_CONFIG.rowNumberWidth,
      },
      ...tableData.columns.map((column: TableColumn) => ({
        id: column.id,
        accessorKey: `cells.${column.id}`,
        header: createHeaderRenderer(column.id, column.name),
        accessorFn: (row: TableRow) => row.cells[column.id],
        cell: column.type === "text" ? textCellRenderer : numberCellRenderer,
        size: CELL_CONFIG.defaultWidth,
      })),
    ];

    return columns;
  }, [
    tableData.columns,
    createHeaderRenderer,
    textCellRenderer,
    numberCellRenderer,
  ]);

  // TanStack Table instance with enhanced meta
  const table = useReactTable({
    data: tableData.rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility,
    },
    meta: {
      updateData,
      editingCell,
      setEditingCell,
    },
  });

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        // Optimized trigger distance - fetch when within 1000px of bottom
        if (
          scrollHeight - scrollTop - clientHeight < 1000 &&
          !tableData.isFetching &&
          !tableData.isFetchingNextPage &&
          tableData.hasNextPage
        ) {
          tableData.fetchNextPage?.();
        }
      }
    },
    [tableData],
  );

  // Check on mount and after data changes to see if we need to fetch more
  useEffect(() => {
    fetchMoreOnBottomReached(parentRef.current);
  }, [fetchMoreOnBottomReached]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      fetchMoreOnBottomReached(e.currentTarget);
    },
    [fetchMoreOnBottomReached],
  );

  const totalColumnWidth = useMemo(() => {
    const visibleColumns = tableData.columns.filter(
      (column) => columnVisibility[column.id],
    );
    return (
      CELL_CONFIG.rowNumberWidth +
      visibleColumns.length * CELL_CONFIG.defaultWidth
    );
  }, [tableData.columns, columnVisibility]);

  return (
    <div className="relative flex-1 overflow-hidden bg-gray-50">
      {/* Shared horizontal scroll container */}
      <div
        ref={parentRef}
        className="h-full overflow-auto"
        onScroll={handleScroll}
      >
        <div
          style={{
            width: totalColumnWidth,
            minHeight: "100%",
          }}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 bg-gray-100 shadow-sm"
            style={{
              borderBottom: "1px solid #cccccc",
            }}
          >
            <div className="flex">
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    className="flex items-center text-left font-normal"
                    style={{
                      ...baseCellStyle,
                      ...getCellWidth(header.id === "rowNumber"),
                      borderRight: "1px solid #cccccc",
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="w-full text-[13px]">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </div>
                    )}
                  </div>
                )),
              )}
            </div>
          </div>

          {/* Virtualized Table Body */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = table.getRowModel().rows[virtualRow.index];
              if (!row) return null;

              const isRowBeingEdited = editingCell?.rowId === row.original.id;

              return (
                <div
                  key={virtualRow.key}
                  className={`absolute top-0 left-0 w-full hover:bg-gray-100 ${isRowBeingEdited ? "bg-gray-100" : ""}`}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    width: totalColumnWidth,
                    borderBottom: "1px solid #cccccc",
                  }}
                  onContextMenu={(e) => handleRowRightClick(e, row.original.id)}
                >
                  <div className="flex">
                    {row.getVisibleCells().map((cell) => {
                      const isEditing =
                        editingCell?.rowId === row.original.id &&
                        editingCell?.columnId === cell.column.id;

                      const isHighlighted = highlights?.some(
                        (h) => h.columnId === cell.column.id,
                      );

                      return (
                        <div
                          key={cell.id}
                          className="relative flex items-center"
                          data-cell-id={`${row.original.id}-${cell.column.id}`}
                          style={{
                            ...baseCellStyle,
                            ...getCellWidth(cell.column.id === "rowNumber"),
                            ...getCombinedHighlightStyle(
                              row.original.id,
                              cell.column.id,
                            ),
                            borderRight: isEditing
                              ? "1px solid #186ce4"
                              : "1px solid #cccccc",
                            borderTop: isEditing ? "1px solid #186ce4" : "none",
                            borderBottom: isEditing
                              ? "1px solid #186ce4"
                              : isHighlighted
                                ? "1px solid #cccccc"
                                : "none",
                            borderLeft: isEditing
                              ? "1px solid #186ce4"
                              : "none",
                            zIndex: isEditing ? 10 : "auto",
                            boxShadow: isEditing
                              ? "0 0 0 1px #186ce4 inset"
                              : "none",
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Loading more indicator at bottom */}
            {tableData.isFetchingNextPage && (
              <div
                className="absolute left-0 flex w-full items-center justify-center bg-white/90 py-4"
                style={{
                  top: `${rowVirtualizer.getTotalSize()}px`,
                  width: totalColumnWidth,
                  borderBottom: "1px solid #cccccc",
                }}
              >
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                  <span>Loading more rows...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simple Context Menu */}
      {contextMenu.isOpen && contextMenu.rowId && (
        <RowContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          rowId={contextMenu.rowId}
          onCloseAction={handleContextMenuClose}
          onDeleteAction={handleDeleteRow}
        />
      )}

      {/* Column Header Editor */}
      {columnEditor.isOpen &&
        columnEditor.columnId &&
        columnEditor.columnName && (
          <ColumnHeaderEditor
            columnId={columnEditor.columnId}
            initialName={columnEditor.columnName}
            position={columnEditor.position}
            onUpdateAction={handleColumnUpdate}
            onCloseAction={handleColumnEditorClose}
            onDeleteAction={handleColumnDelete}
            isPrimary={
              tableData.columns.find((col) => col.id === columnEditor.columnId)
                ?.is_primary ?? false
            }
          />
        )}
    </div>
  );
}
