"use client";

import {
  type ColumnDef,
  useReactTable,
  getCoreRowModel,
  flexRender,
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

import { RowNumberCell } from "./RowNumberCell";
import { ColumnHeaderEditor } from "./ColumnHeaderEditor";
import { SimpleContextMenu } from "./SimpleContextMenu";
import { createCellRenderer } from "./cellRenderers";
import { CELL_CONFIG, baseCellStyle } from "./constants";

interface TableViewProps {
  tableData: TableData;
  tableActions: TableActions;
  onSavingStateChange?: (isSaving: boolean) => void;
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
}: TableViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  // Notify parent when saving state changes
  useEffect(() => {
    onSavingStateChange?.(isSaving);
  }, [isSaving, onSavingStateChange]);

  // Extract individual functions to prevent dependency chain issues
  const updateCell = useMemo(
    () => tableActions.updateCell,
    [tableActions.updateCell],
  );
  const deleteRow = useMemo(
    () => tableActions.deleteRow,
    [tableActions.deleteRow],
  );
  const updateColumn = useMemo(
    () => tableActions.updateColumn,
    [tableActions.updateColumn],
  );
  const deleteColumn = useMemo(
    () => tableActions.deleteColumn,
    [tableActions.deleteColumn],
  );

  // Memoized update function for table meta
  const updateData = useCallback(
    async (rowId: string, columnId: string, value: string | number) => {
      setIsSaving(true);
      try {
        await updateCell(rowId, columnId, value);
      } finally {
        setIsSaving(false);
      }
    },
    [updateCell],
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

  // Handle context menu close
  const handleContextMenuClose = useCallback(() => {
    setContextMenu((prev) => ({
      ...prev,
      isOpen: false,
      rowId: null,
    }));
  }, []);

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

  // Handle delete row from context menu
  const handleDeleteRow = useCallback(
    async (rowId: string) => {
      setContextMenu((prev) => ({
        ...prev,
        isOpen: false,
        rowId: null,
      }));

      setIsSaving(true);
      try {
        const success = await deleteRow(rowId);
        if (success) {
          toast.success("Record deleted successfully");
        } else {
          toast.error("Failed to delete record");
        }
      } catch (error) {
        console.error("Error deleting row:", error);
        toast.error("Failed to delete record");
      } finally {
        setIsSaving(false);
      }
    },
    [deleteRow],
  );

  // Handle column update from editor
  const handleColumnUpdate = useCallback(
    async (columnName: string) => {
      if (!columnEditor.columnId) return;

      setColumnEditor((prev) => ({
        ...prev,
        isOpen: false,
        columnId: null,
        columnName: null,
      }));

      setIsSaving(true);
      try {
        await updateColumn(columnEditor.columnId, columnName);
        toast.success("Column updated successfully");
      } catch (error) {
        console.error("Error updating column:", error);
        toast.error("Failed to update column");
      } finally {
        setIsSaving(false);
      }
    },
    [columnEditor.columnId, updateColumn],
  );

  // Handle column delete from editor
  const handleColumnDelete = useCallback(
    async (columnId: string) => {
      setColumnEditor((prev) => ({
        ...prev,
        isOpen: false,
        columnId: null,
        columnName: null,
      }));

      setIsSaving(true);
      try {
        await deleteColumn(columnId);
        toast.success("Column deleted successfully");
      } catch (error) {
        console.error("Error deleting column:", error);
        toast.error("Failed to delete column");
      } finally {
        setIsSaving(false);
      }
    },
    [deleteColumn],
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

  // Generate table columns configuration
  const tableColumns = useMemo(() => {
    const columns: ColumnDef<TableRow>[] = [
      // Row number column
      {
        id: "rowNumber",
        header: "",
        cell: ({ row }) => <RowNumberCell rowIndex={row.index} />,
        size: CELL_CONFIG.rowNumberWidth,
        enableGlobalFilter: false,
      },
      // Data columns
      ...tableData.columns.map((column: TableColumn) => ({
        accessorKey: column.id,
        id: column.id,
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

  // TanStack Table instance (no client-side filtering)
  const table = useReactTable({
    data: tableData.rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData,
      editingCell,
      setEditingCell,
    },
  });

  // Virtual row renderer
  const rowVirtualizer = useVirtualizer({
    count: tableData.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CELL_CONFIG.height,
    overscan: 80,
  });

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        // Once the user has scrolled within 1500px of the bottom, fetch more data if we can
        if (
          scrollHeight - scrollTop - clientHeight < 2000 &&
          !tableData.isFetching &&
          tableData.totalRows < tableData.totalDBRowCount
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
    return (
      CELL_CONFIG.rowNumberWidth +
      tableData.columns.length * CELL_CONFIG.defaultWidth
    );
  }, [tableData.columns.length]);

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

                      return (
                        <div
                          key={cell.id}
                          className="relative flex items-center"
                          data-cell-id={`${row.original.id}-${cell.column.id}`}
                          style={{
                            ...baseCellStyle,
                            ...getCellWidth(cell.column.id === "rowNumber"),
                            borderRight: isEditing
                              ? "1px solid #186ce4"
                              : "1px solid #cccccc",
                            borderTop: isEditing ? "1px solid #186ce4" : "none",
                            borderBottom: isEditing
                              ? "1px solid #186ce4"
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
          </div>
        </div>
      </div>

      {/* Simple Context Menu */}
      <SimpleContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onCloseAction={handleContextMenuClose}
        onDeleteAction={() =>
          contextMenu.rowId && handleDeleteRow(contextMenu.rowId)
        }
      />

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
          />
        )}
    </div>
  );
}
