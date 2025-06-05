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
import { DropdownMenu, DropdownMenuTrigger } from "../ui/dropdown-menu";
import AddColumnForm from "./AddcolumnForm";
import { Plus } from "lucide-react";

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
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);

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

  // Handle add column
  const handleAddColumn = useCallback(
    async (name: string, type: "text" | "number") => {
      try {
        await tableActions.addColumn(name, type);
        setIsAddColumnOpen(false);
      } catch (error) {
        console.error("Failed to add column:", error);
        toast.error("Failed to add column");
      }
    },
    [tableActions],
  );

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

  // Check if we should show the add row button - always show for easy access
  const shouldShowAddRowButton = useMemo(() => {
    // Don't show if table is loading
    if (tableData.isFetching || tableData.isFetchingNextPage) {
      return false;
    }

    // Always show the add row button for better UX when not loading
    return true;
  }, [tableData.isFetching, tableData.isFetchingNextPage]);

  // Handle add row
  const handleAddRow = useCallback(async () => {
    try {
      await tableActions.addRow();
    } catch (error) {
      console.error("Failed to add row:", error);
      toast.error("Failed to add row");
    }
  }, [tableActions]);

  // Table View
  return (
    <div className="relative flex-1 overflow-hidden bg-[#f2f4f8]">
      {/* Main table scroll container */}
      <div
        ref={parentRef}
        className="h-full overflow-auto"
        onScroll={handleScroll}
      >
        <div
          style={{
            width: "100%", // Take full width to allow header extension
            minWidth: totalColumnWidth + CELL_CONFIG.defaultWidth / 2 + 120, // Add 120px extra scrollable space
            minHeight: "100%",
            paddingBottom: "120px",
          }}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 bg-gray-100"
            style={{
              borderBottom: "1px solid #dee1e3",
            }}
          >
            <div className="flex">
              {/* Existing table headers */}
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    className="flex items-center text-left font-normal"
                    style={{
                      ...baseCellStyle,
                      ...getCellWidth(header.id === "rowNumber"),
                      borderRight: "1px solid #dee1e3",
                      // Make row number column sticky
                      ...(header.id === "rowNumber" && {
                        position: "sticky",
                        left: 0,
                        zIndex: 15,
                        backgroundColor: "rgb(243, 244, 246)", // Same as bg-gray-100
                      }),
                      // Make first data column (primary) sticky
                      ...(header.column.getIndex() === 1 && {
                        position: "sticky",
                        left: CELL_CONFIG.rowNumberWidth,
                        zIndex: 15,
                        backgroundColor: "rgb(243, 244, 246)", // Same as bg-gray-100
                      }),
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

              {/* Add Column Button */}
              <div
                className="flex cursor-pointer items-center justify-center border-r bg-gray-100 transition-colors hover:bg-gray-50"
                style={{
                  ...baseCellStyle,
                  width: CELL_CONFIG.defaultWidth / 2,
                  borderColor: "#dee1e3",
                  // Make add column button sticky
                  position: "sticky",
                  left: CELL_CONFIG.rowNumberWidth + CELL_CONFIG.defaultWidth,
                  zIndex: 15,
                }}
              >
                <DropdownMenu
                  open={isAddColumnOpen}
                  onOpenChange={setIsAddColumnOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <div
                      className="flex h-full w-full items-center justify-center rounded text-gray-600"
                      title="Add column"
                    >
                      <Plus className="h-4 w-4 text-gray-600" />
                    </div>
                  </DropdownMenuTrigger>
                  <AddColumnForm
                    onAddColumn={handleAddColumn}
                    isOpen={isAddColumnOpen}
                    setIsOpen={setIsAddColumnOpen}
                  />
                </DropdownMenu>
              </div>

              {/* Extension area to fill remaining space to the right */}
              <div
                className="flex-1 bg-white"
                style={{
                  ...baseCellStyle,
                  borderRight: "none",
                }}
              />
            </div>
          </div>

          {/* Background area for the extension column */}
          <div
            className="absolute bg-[#f2f4f8]"
            style={{
              top: "33px", // Start after header
              left: totalColumnWidth + CELL_CONFIG.defaultWidth / 2,
              right: 0,
              bottom: 0,
              zIndex: 1,
            }}
          />

          {/* Virtualized Table Body - no changes to existing rows */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
              zIndex: 2, // Ensure rows are above background
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = table.getRowModel().rows[virtualRow.index];
              if (!row) return null;

              const isRowBeingEdited = editingCell?.rowId === row.original.id;
              const isAnyRowBeingEdited = editingCell !== null;

              return (
                <div
                  key={virtualRow.key}
                  className="absolute top-0 left-0 w-full"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    width: totalColumnWidth,
                    backgroundColor: isRowBeingEdited ? "#f3f4f6" : "white",
                    borderBottom: "1px solid #dee1e3",
                  }}
                  onMouseOver={(e) => {
                    if (!isAnyRowBeingEdited || isRowBeingEdited) {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                      // Also update sticky cells
                      const stickyRowNumber = e.currentTarget.querySelector(
                        '[data-sticky="row-number"]',
                      );
                      const stickyPrimary = e.currentTarget.querySelector(
                        '[data-sticky="primary-column"]',
                      );
                      if (
                        stickyRowNumber &&
                        stickyRowNumber instanceof HTMLElement
                      ) {
                        stickyRowNumber.style.backgroundColor = "#f3f4f6";
                      }
                      if (
                        stickyPrimary &&
                        stickyPrimary instanceof HTMLElement
                      ) {
                        stickyPrimary.style.backgroundColor = "#f3f4f6";
                      }
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRowBeingEdited) {
                      e.currentTarget.style.backgroundColor = "white";
                      // Also reset sticky cells
                      const stickyRowNumber = e.currentTarget.querySelector(
                        '[data-sticky="row-number"]',
                      );
                      const stickyPrimary = e.currentTarget.querySelector(
                        '[data-sticky="primary-column"]',
                      );
                      if (
                        stickyRowNumber &&
                        stickyRowNumber instanceof HTMLElement
                      ) {
                        stickyRowNumber.style.backgroundColor = "white";
                      }
                      if (
                        stickyPrimary &&
                        stickyPrimary instanceof HTMLElement
                      ) {
                        stickyPrimary.style.backgroundColor = "white";
                      }
                    }
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
                          {...(cell.column.id === "rowNumber" && {
                            "data-sticky": "row-number",
                          })}
                          {...(cell.column.getIndex() === 1 && {
                            "data-sticky": "primary-column",
                          })}
                          style={{
                            ...baseCellStyle,
                            ...getCellWidth(cell.column.id === "rowNumber"),
                            ...getCombinedHighlightStyle(
                              row.original.id,
                              cell.column.id,
                            ),
                            borderRight: isEditing
                              ? "1px solid #186ce4"
                              : "1px solid #dee1e3",
                            borderTop: isEditing ? "1px solid #186ce4" : "none",
                            borderBottom: isEditing
                              ? "1px solid #186ce4"
                              : isHighlighted
                                ? "1px solid #dee1e3"
                                : "none",
                            borderLeft: isEditing
                              ? "1px solid #186ce4"
                              : "none",
                            zIndex: isEditing ? 10 : "auto",
                            boxShadow: isEditing
                              ? "0 0 0 1px #186ce4 inset"
                              : "none",
                            // Make row number cells sticky
                            ...(cell.column.id === "rowNumber" && {
                              position: "sticky",
                              left: 0,
                              zIndex: isEditing ? 20 : 12,
                              backgroundColor: isRowBeingEdited
                                ? "#f3f4f6"
                                : "white",
                              borderBottom: "1px solid #dee1e3",
                            }),
                            // Make first data column (primary) cells sticky
                            ...(cell.column.getIndex() === 1 && {
                              position: "sticky",
                              left: CELL_CONFIG.rowNumberWidth,
                              zIndex: isEditing ? 20 : 12,
                              backgroundColor: isRowBeingEdited
                                ? "#f3f4f6"
                                : "white",
                              borderBottom: "1px solid #dee1e3",
                            }),
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

            {/* Add Row Button - styled like a regular table row */}
            {shouldShowAddRowButton && (
              <div
                className="absolute top-0 left-0 w-full cursor-pointer"
                style={{
                  height: `${CELL_CONFIG.height}px`,
                  transform: `translateY(${rowVirtualizer.getTotalSize()}px)`,
                  width: totalColumnWidth,
                  borderBottom: "1px solid #dee1e3",
                  backgroundColor: "white",
                  transition: "background-color 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f3f4f6"; // gray-100
                  // Also update sticky cells in add row
                  const stickyRowNumber = e.currentTarget.querySelector(
                    '[data-sticky="add-row-number"]',
                  );
                  const stickyPrimary = e.currentTarget.querySelector(
                    '[data-sticky="add-primary-column"]',
                  );
                  if (
                    stickyRowNumber &&
                    stickyRowNumber instanceof HTMLElement
                  ) {
                    stickyRowNumber.style.backgroundColor = "#f3f4f6";
                  }
                  if (stickyPrimary && stickyPrimary instanceof HTMLElement) {
                    stickyPrimary.style.backgroundColor = "#f3f4f6";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "white";
                  // Also reset sticky cells in add row
                  const stickyRowNumber = e.currentTarget.querySelector(
                    '[data-sticky="add-row-number"]',
                  );
                  const stickyPrimary = e.currentTarget.querySelector(
                    '[data-sticky="add-primary-column"]',
                  );
                  if (
                    stickyRowNumber &&
                    stickyRowNumber instanceof HTMLElement
                  ) {
                    stickyRowNumber.style.backgroundColor = "white";
                  }
                  if (stickyPrimary && stickyPrimary instanceof HTMLElement) {
                    stickyPrimary.style.backgroundColor = "white";
                  }
                }}
                onClick={handleAddRow}
                title="Add row"
              >
                <div className="flex">
                  {/* Row number column with Add Row icon */}
                  <div
                    className="justify-left relative flex items-center"
                    data-sticky="add-row-number"
                    style={{
                      ...baseCellStyle,
                      ...getCellWidth(true), // true for row number column
                      borderRight: "1px solid #dee1e3",
                      // Make add row button's row number cell sticky
                      position: "sticky",
                      left: 0,
                      zIndex: 12,
                      backgroundColor: "white",
                      borderBottom: "1px solid #dee1e3",
                    }}
                  >
                    <Plus className="ml-1 h-4 w-4 text-gray-400" />
                  </div>

                  {/* Border extension for row number column */}
                  <div
                    className="absolute"
                    style={{
                      left: CELL_CONFIG.rowNumberWidth - 1,
                      top: CELL_CONFIG.height,
                      width: "1px",
                      height: "120px",
                      backgroundColor: "#dee1e3",
                    }}
                  />

                  {/* Empty cells for each visible column */}
                  {tableData.columns
                    .filter((column) => columnVisibility[column.id])
                    .map((column, index) => (
                      <div
                        key={column.id}
                        className="relative flex items-center"
                        {...(index === 0 && {
                          "data-sticky": "add-primary-column",
                        })}
                        style={{
                          ...baseCellStyle,
                          ...getCellWidth(false),
                          borderRight: "1px solid #dee1e3",
                          // Make first data column sticky in add row
                          ...(index === 0 && {
                            position: "sticky",
                            left: CELL_CONFIG.rowNumberWidth,
                            zIndex: 12,
                            backgroundColor: "white",
                            borderBottom: "1px solid #dee1e3",
                          }),
                        }}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Loading more indicator at bottom */}
            {tableData.isFetchingNextPage && (
              <div
                className="absolute left-0 flex w-full items-center justify-center bg-white/90 py-4"
                style={{
                  top: `${rowVirtualizer.getTotalSize() + (shouldShowAddRowButton ? CELL_CONFIG.height : 0)}px`,
                  width: totalColumnWidth,
                  borderBottom: "1px solid #dee1e3",
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

      {/* Sticky Footer Row - Record Count */}
      <div
        className="sticky bottom-0 z-20 overflow-clip bg-white"
        style={{
          borderTop: "1px solid #dee1e3",
          borderBottom: "1px solid #dee1e3",
        }}
      >
        <div className="flex">
          {/* Record count in first cell */}
          <div
            className="flex cursor-default items-center justify-center text-[11px] text-gray-600"
            style={{
              ...baseCellStyle,
              width: CELL_CONFIG.rowNumberWidth * 2,
              borderRight: "1px solid #dee1e3",
              backgroundColor: "#f8f9fa",
              fontWeight: "500",
              whiteSpace: "nowrap",
              overflow: "visible", // Allow text to show fully
              // Make footer record count sticky
              position: "sticky",
              left: 0,
              zIndex: 25,
            }}
            title={`${tableData.totalDBRowCount.toLocaleString()} total records (${tableData.rows.length.toLocaleString()} loaded)`} // Show full count on hover
          >
            {tableData.totalDBRowCount.toLocaleString()} records
          </div>

          {/* Empty cells for each visible column to maintain table structure */}
          {tableData.columns
            .filter((column) => columnVisibility[column.id])
            .map((column, index) => (
              <div
                key={`footer-${column.id}`}
                className="flex items-center"
                style={{
                  ...baseCellStyle,
                  ...getCellWidth(false),
                  backgroundColor: "white",
                  // Make first data column sticky in footer
                  ...(index === 0 && {
                    position: "sticky",
                    left: CELL_CONFIG.rowNumberWidth,
                    zIndex: 25,
                    backgroundColor: "#f8f9fa",
                  }),
                }}
              />
            ))}

          {/* Add column space */}
          <div
            className="flex items-center"
            style={{
              ...baseCellStyle,
              width: CELL_CONFIG.defaultWidth / 2,
              backgroundColor: "white",
            }}
          />

          {/* Extension area to fill remaining space */}
          <div
            className="flex-1"
            style={{
              ...baseCellStyle,
              borderRight: "none",
              backgroundColor: "white",
            }}
          />
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
