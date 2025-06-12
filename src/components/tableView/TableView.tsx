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
import { ColumnRenameForm } from "./ColumnRenameForm";
import { RowContextMenu } from "./RowContextMenu";
import { createCellRenderer } from "./cellRenderers";
import { CELL_CONFIG, baseCellStyle } from "./constants";
import { useSearchScrolling } from "~/hooks/useSearchScrolling";
import { DropdownMenu, DropdownMenuTrigger } from "../ui/dropdown-menu";
import AddColumnForm from "./AddcolumnForm";
import { Plus, Baseline, Hash, ChevronDown } from "lucide-react";
import { FloatingAddRowButton } from "./FloatingAddRowButton";
import { DraftRow } from "./DraftRow";

interface TableViewProps {
  tableData: TableData;
  tableActions: TableActions;
  onSavingStateChange?: (savingStatus: string | null) => void;
  highlights?: ColumnHighlight[];
  hiddenColumns: string[];
  searchMatches?: SearchMatch[];
  currentTargetMatch?: SearchMatch | null;
}

// Style utilities and constants
const COLORS = {
  border: "#dee1e3",
  hover: "#f3f4f6",
  editing: "#186ce4",
  newRow: "#dbeafe",
  newRowHover: "#c7d2fe",
  background: "#f2f4f8",
  headerBg: "rgb(243, 244, 246)",
  footerBg: "#f8f9fa",
  white: "white",
  searchHighlight: "#f1cf6b",
  searchHighlightSecondary: "#fff3d3",
} as const;

const SEARCH_HIGHLIGHT_COLORS = {
  primary: "#f1cf6b",
  primaryHover: "#efc455",
  secondary: "#fff3d3",
  secondaryHover: "#ffeaa3",
  columnHighlight: "#CFF5D1",
  columnHighlightHover: "#b8e6c1",
  otherHighlight: "#fff2ea",
  otherHighlightHover: "#f5e6d3",
} as const;

// Style helper functions
const createCellWidthStyle = (isRowNumber = false) => ({
  width: isRowNumber ? CELL_CONFIG.rowNumberWidth : CELL_CONFIG.defaultWidth,
  minWidth: isRowNumber ? CELL_CONFIG.rowNumberWidth : CELL_CONFIG.defaultWidth,
  maxWidth: isRowNumber ? CELL_CONFIG.rowNumberWidth : CELL_CONFIG.defaultWidth,
});

const createStickyStyle = (
  position: "row-number" | "primary-column",
  zIndex = 12,
  backgroundColor: string = COLORS.white,
) => ({
  position: "sticky" as const,
  left: position === "row-number" ? 0 : CELL_CONFIG.rowNumberWidth,
  zIndex,
  backgroundColor,
});

const createBorderStyle = (isEditing = false) => ({
  borderRight: `1px solid ${isEditing ? COLORS.editing : COLORS.border}`,
  borderTop: isEditing ? `1px solid ${COLORS.editing}` : "none",
  borderBottom: `1px solid ${isEditing ? COLORS.editing : COLORS.border}`,
  borderLeft: isEditing ? `1px solid ${COLORS.editing}` : "none",
  ...(isEditing && {
    boxShadow: `0 0 0 1px ${COLORS.editing} inset`,
  }),
});

const getCellWidth = (isRowNumber = false) => createCellWidthStyle(isRowNumber);

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
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [isAddRowHovered, setIsAddRowHovered] = useState(false);
  const [isDraftRowVisible, setIsDraftRowVisible] = useState(false);
  const [draftFocusedCell, setDraftFocusedCell] = useState<string | null>(null);
  const [newlyAddedRowId, setNewlyAddedRowId] = useState<string | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Column rename form state
  const [columnRenameForm, setColumnRenameForm] = useState<{
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

  useEffect(() => {
    onSavingStateChange?.(savingStatus);
  }, [savingStatus, onSavingStateChange]);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Track data loading state to prevent search scrolling during fetch
  useEffect(() => {
    if (tableData.isFetching || tableData.isFetchingNextPage) {
      setIsDataLoading(true);
    } else {
      // Add a delay before allowing search scrolling again to ensure data is fully loaded
      const timeout = setTimeout(() => {
        setIsDataLoading(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [tableData.isFetching, tableData.isFetchingNextPage]);

  // Add wheel event listener to detect active scrolling
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const handleWheel = () => {
      setIsUserScrolling(true);

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set longer timeout for wheel events
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
      }, 1500); // Even longer for wheel scrolling
    };

    container.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const getCellHighlightStyle = useCallback(
    (columnId: string): React.CSSProperties => {
      if (!highlights || highlights.length === 0) return {};
      const highlight = highlights.find((h) => h.columnId === columnId);
      if (!highlight) return {};
      return { backgroundColor: highlight.color };
    },
    [highlights],
  );

  const getSearchHighlightStyle = useCallback(
    (rowId: string, columnId: string): React.CSSProperties => {
      if (!searchMatches || searchMatches.length === 0) return {};
      const searchMatch = searchMatches.find(
        (match) => match.rowId === rowId && match.columnId === columnId,
      );
      if (!searchMatch) return {};
      return {
        backgroundColor: searchMatch.isCurrentTarget
          ? SEARCH_HIGHLIGHT_COLORS.primary
          : SEARCH_HIGHLIGHT_COLORS.secondary,
      };
    },
    [searchMatches],
  );

  const getCombinedHighlightStyle = useCallback(
    (rowId: string, columnId: string): React.CSSProperties => {
      const searchStyle = getSearchHighlightStyle(rowId, columnId);
      const cellStyle = getCellHighlightStyle(columnId);
      return searchStyle.backgroundColor ? searchStyle : cellStyle;
    },
    [getSearchHighlightStyle, getCellHighlightStyle],
  );

  const rowVirtualizer = useVirtualizer({
    count: tableData.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CELL_CONFIG.height,
    overscan: 50, // Increased from 20 for smoother scrolling
  });

  useSearchScrolling({
    currentTargetMatch,
    tableRows: tableData.rows,
    parentRef: parentRef as React.RefObject<HTMLDivElement>,
    rowVirtualizer,
    rowHeight: CELL_CONFIG.height,
    isUserScrolling: isUserScrolling || isDataLoading,
  });

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

  // Handle opening rename form directly
  const handleOpenRenameForm = useCallback(
    (e: React.MouseEvent, columnId: string, columnName: string) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setColumnRenameForm({
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

  // Handle column rename form close
  const handleColumnRenameFormClose = useCallback(() => {
    setColumnRenameForm((prev) => ({
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

  // Handle column update from rename form
  const handleColumnRenameUpdate = useCallback(
    async (columnName: string) => {
      if (!columnRenameForm.columnId) return;

      handleColumnRenameFormClose();

      setSavingStatus("Updating column...");
      try {
        const success = await tableActions.updateColumn(
          columnRenameForm.columnId,
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
    [columnRenameForm.columnId, handleColumnRenameFormClose, tableActions],
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
    (columnId: string, columnName: string, columnType: "text" | "number") => {
      const handleChevronClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleColumnHeaderRightClick(e, columnId, columnName);
      };

      const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleOpenRenameForm(e, columnId, columnName);
      };

      const columnHeaderEditor = () => (
        <button
          className="group h-full w-full bg-transparent text-left text-[13px] outline-none hover:bg-gray-50 focus:bg-gray-50"
          style={baseCellStyle}
          onContextMenu={(e) =>
            handleColumnHeaderRightClick(e, columnId, columnName)
          }
          onDoubleClick={handleDoubleClick}
        >
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1.5">
              {columnType === "text" ? (
                <Baseline className="h-3.5 w-3.5 text-gray-500" />
              ) : (
                <Hash className="h-3.5 w-3.5 text-gray-500" />
              )}
              <span>{columnName}</span>
            </div>
            <ChevronDown
              className="h-3.5 w-3.5 cursor-pointer text-gray-400 hover:text-gray-600"
              onClick={handleChevronClick}
            />
          </div>
        </button>
      );
      return columnHeaderEditor;
    },
    [handleColumnHeaderRightClick, handleOpenRenameForm],
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
        header: createHeaderRenderer(column.id, column.name, column.type),
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
        // Optimized trigger distance - fetch when within 2500px of bottom
        if (
          scrollHeight - scrollTop - clientHeight < 2500 &&
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
      // Mark that user is actively scrolling
      setIsUserScrolling(true);

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set timeout to mark scrolling as finished after user stops scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
      }, 1000); // Increased to 1 second to be even more generous

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

  const shouldShowAddRowButton = useMemo(() => {
    return !tableData.isFetchingNextPage;
  }, [tableData.isFetchingNextPage]);

  const handleAddRow = useCallback(async () => {
    try {
      await tableActions.addRow();
    } catch (error) {
      console.error("Failed to add row:", error);
      toast.error("Failed to add row");
    }
  }, [tableActions]);

  const handleFloatingAddRow = useCallback(() => {
    setIsDraftRowVisible(true);
  }, []);

  const handleDraftRowSave = useCallback(
    async (draftData: Record<string, string | number>) => {
      setIsDraftRowVisible(false);
      setDraftFocusedCell(null);
      setSavingStatus("Creating row...");

      try {
        // Filter out empty values before sending to the server
        const filteredData = Object.fromEntries(
          Object.entries(draftData).filter(
            ([, value]) =>
              value !== "" && value !== null && value !== undefined,
          ),
        );

        // Use the more efficient single-operation method
        const newRowId = await tableActions.addRowWithCellValues(filteredData);

        if (newRowId) {
          setNewlyAddedRowId(newRowId);

          setTimeout(() => {
            if (parentRef.current) {
              const rowIndex = tableData.totalDBRowCount - 1;
              const scrollTop = rowIndex * CELL_CONFIG.height;
              parentRef.current.scrollTo({
                top: scrollTop,
                behavior: "smooth",
              });
            }
          }, 100);

          setTimeout(() => {
            setNewlyAddedRowId(null);
          }, 2000);
        } else {
          toast.error("Failed to create row");
        }
      } catch (error) {
        console.error("Failed to create row with data:", error);
        toast.error("Failed to create row");
      } finally {
        setSavingStatus(null);
      }
    },
    [tableActions, tableData.totalDBRowCount],
  );

  const handleDraftRowCancel = useCallback(() => {
    setIsDraftRowVisible(false);
    setDraftFocusedCell(null);
  }, []);

  const getCellBackgroundColor = useCallback(
    (
      rowId: string,
      columnId: string,
      isRowBeingEdited: boolean,
      isNewlyAdded: boolean,
    ): string => {
      const combinedHighlightStyle = getCombinedHighlightStyle(rowId, columnId);
      const hasHighlight = !!combinedHighlightStyle.backgroundColor;
      const isHovered =
        hoveredRowId === rowId && !isRowBeingEdited && !isNewlyAdded;

      if (hasHighlight) {
        const baseColor = combinedHighlightStyle.backgroundColor as string;
        if (isHovered) {
          if (baseColor === SEARCH_HIGHLIGHT_COLORS.primary)
            return SEARCH_HIGHLIGHT_COLORS.primaryHover;
          if (baseColor === SEARCH_HIGHLIGHT_COLORS.secondary)
            return SEARCH_HIGHLIGHT_COLORS.secondaryHover;
          if (baseColor === SEARCH_HIGHLIGHT_COLORS.columnHighlight)
            return SEARCH_HIGHLIGHT_COLORS.columnHighlightHover;
          if (baseColor === SEARCH_HIGHLIGHT_COLORS.otherHighlight)
            return SEARCH_HIGHLIGHT_COLORS.otherHighlightHover;
          return baseColor;
        }
        return baseColor;
      }

      if (isNewlyAdded) {
        return isHovered ? COLORS.newRowHover : COLORS.newRow;
      }

      if (isRowBeingEdited) {
        return COLORS.hover;
      }

      if (isHovered) {
        return COLORS.hover;
      }

      return COLORS.white;
    },
    [getCombinedHighlightStyle, hoveredRowId],
  );

  // Style objects for reuse
  const containerStyles = {
    main: "relative flex-1 overflow-hidden bg-[#f2f4f8]",
    extensionArea: {
      className:
        "absolute top-0 left-0 h-full border-r border-[#dee1e3] bg-gray-100",
      style: { width: CELL_CONFIG.rowNumberWidth },
    },
    scrollContainer: "h-full overflow-auto",
    content: {
      style: {
        width: "100%",
        minWidth: totalColumnWidth + CELL_CONFIG.defaultWidth / 2 + 120,
        minHeight: "100%",
        paddingBottom: "120px",
      },
    },
  };

  const headerStyles = {
    container: {
      className: "sticky top-0 z-10 bg-gray-100",
      style: { borderBottom: `1px solid ${COLORS.border}` },
    },
    cell: (isRowNumber: boolean, isPrimary: boolean) => ({
      className: "flex items-center text-left font-normal",
      style: {
        ...baseCellStyle,
        ...createCellWidthStyle(isRowNumber),
        borderRight: `1px solid ${COLORS.border}`,
        ...(isRowNumber &&
          createStickyStyle("row-number", 15, COLORS.headerBg)),
        ...(isPrimary &&
          createStickyStyle("primary-column", 15, COLORS.headerBg)),
      },
    }),
    addColumn: {
      className:
        "flex cursor-pointer items-center justify-center border-r bg-gray-100 transition-colors hover:bg-gray-50",
      style: {
        ...baseCellStyle,
        width: CELL_CONFIG.defaultWidth / 2,
        borderColor: COLORS.border,
        position: "sticky" as const,
        left: CELL_CONFIG.rowNumberWidth + CELL_CONFIG.defaultWidth,
        zIndex: 15,
      },
    },
    extension: {
      className: "flex-1 bg-white",
      style: { ...baseCellStyle, borderRight: "none" },
    },
  };

  const rowStyles = {
    container: (rowId: string, isEditing: boolean, isNewlyAdded: boolean) => ({
      style: {
        backgroundColor: getCellBackgroundColor(
          rowId,
          "",
          isEditing,
          isNewlyAdded,
        ),
        borderBottom: `1px solid ${COLORS.border}`,
        transition: isNewlyAdded ? "background-color 1s ease-out" : "none",
      },
    }),
    cell: (
      isRowNumber: boolean,
      isPrimary: boolean,
      isEditing: boolean,
      backgroundColor: string,
      isNewlyAdded: boolean,
    ) => ({
      className: "relative flex items-center",
      style: {
        ...baseCellStyle,
        ...createCellWidthStyle(isRowNumber),
        ...createBorderStyle(isEditing),
        backgroundColor,
        transition: isNewlyAdded ? "background-color 0.5s ease-out" : "none",
        zIndex: isEditing ? 10 : "auto",
        ...(isRowNumber &&
          createStickyStyle(
            "row-number",
            isEditing ? 20 : 12,
            backgroundColor,
          )),
        ...(isPrimary &&
          createStickyStyle(
            "primary-column",
            isEditing ? 20 : 12,
            backgroundColor,
          )),
      },
    }),
  };

  // Table View
  return (
    <div className={containerStyles.main}>
      {/* Extension area */}
      <div
        className={containerStyles.extensionArea.className}
        style={containerStyles.extensionArea.style}
      />

      {/* Main table scroll container */}
      <div
        ref={parentRef}
        className={containerStyles.scrollContainer}
        onScroll={handleScroll}
      >
        <div style={containerStyles.content.style}>
          {/* Header */}
          <div
            className={headerStyles.container.className}
            style={headerStyles.container.style}
          >
            <div className="flex">
              {/* Existing table headers */}
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    {...headerStyles.cell(
                      header.id === "rowNumber",
                      header.column.getIndex() === 1,
                    )}
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
              <div {...headerStyles.addColumn}>
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
              <div {...headerStyles.extension} />
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

          {/* Virtualized Table Body */}
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
              const isNewlyAdded = newlyAddedRowId === row.original.id;

              return (
                <div
                  key={virtualRow.key}
                  className="absolute top-0 left-0 w-full"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    width: totalColumnWidth,
                    ...rowStyles.container(
                      row.original.id,
                      isRowBeingEdited,
                      isNewlyAdded,
                    ).style,
                  }}
                  onMouseEnter={() => {
                    if (
                      !isNewlyAdded &&
                      (!isAnyRowBeingEdited || isRowBeingEdited)
                    ) {
                      setHoveredRowId(row.original.id);
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredRowId(null);
                  }}
                  onContextMenu={(e) => handleRowRightClick(e, row.original.id)}
                >
                  <div className="flex">
                    {row.getVisibleCells().map((cell) => {
                      const isEditing =
                        editingCell?.rowId === row.original.id &&
                        editingCell?.columnId === cell.column.id;

                      const cellBackgroundColor = getCellBackgroundColor(
                        row.original.id,
                        cell.column.id,
                        isEditing,
                        isNewlyAdded,
                      );

                      return (
                        <div
                          key={cell.id}
                          data-cell-id={`${row.original.id}-${cell.column.id}`}
                          {...(cell.column.id === "rowNumber" && {
                            "data-sticky": "row-number",
                          })}
                          {...(cell.column.getIndex() === 1 && {
                            "data-sticky": "primary-column",
                          })}
                          {...rowStyles.cell(
                            cell.column.id === "rowNumber",
                            cell.column.getIndex() === 1,
                            isEditing,
                            cellBackgroundColor,
                            isNewlyAdded,
                          )}
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
                  borderBottom: `1px solid ${COLORS.border}`,
                  backgroundColor: isAddRowHovered
                    ? COLORS.hover
                    : COLORS.white,
                  transition: "background-color 0.1s ease",
                }}
                onMouseEnter={() => setIsAddRowHovered(true)}
                onMouseLeave={() => setIsAddRowHovered(false)}
                onClick={handleAddRow}
                title="Add row"
              >
                <div className="flex">
                  <div
                    className="justify-left relative flex items-center"
                    data-sticky="add-row-number"
                    style={{
                      ...baseCellStyle,
                      ...createCellWidthStyle(true),
                      borderRight: `1px solid ${COLORS.border}`,
                      ...createStickyStyle(
                        "row-number",
                        12,
                        isAddRowHovered ? COLORS.hover : COLORS.white,
                      ),
                      borderBottom: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <Plus className="ml-1 h-4 w-4 text-gray-400" />
                  </div>

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
                          ...createCellWidthStyle(false),
                          borderRight: `1px solid ${COLORS.border}`,
                          backgroundColor: isAddRowHovered
                            ? COLORS.hover
                            : COLORS.white,
                          ...(index === 0 &&
                            createStickyStyle(
                              "primary-column",
                              12,
                              isAddRowHovered ? COLORS.hover : COLORS.white,
                            )),
                          borderBottom: `1px solid ${COLORS.border}`,
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
                  top: `${rowVirtualizer.getTotalSize() + (shouldShowAddRowButton ? CELL_CONFIG.height : 0) + (isDraftRowVisible ? CELL_CONFIG.height : 0)}px`,
                  width: totalColumnWidth,
                  borderBottom: `1px solid ${COLORS.border}`,
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

      {/* Draft Row - positioned at the bottom */}
      {isDraftRowVisible && (
        <div
          className="sticky bottom-0 z-30 bg-white"
          style={{
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <DraftRow
            columns={tableData.columns}
            columnVisibility={columnVisibility}
            totalColumnWidth={totalColumnWidth}
            onSave={handleDraftRowSave}
            onCancel={handleDraftRowCancel}
            getCellWidth={getCellWidth}
            focusedCell={draftFocusedCell}
            setFocusedCell={setDraftFocusedCell}
          />
        </div>
      )}

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

      {/* Column Rename Form */}
      {columnRenameForm.isOpen &&
        columnRenameForm.columnId &&
        columnRenameForm.columnName && (
          <ColumnRenameForm
            initialName={columnRenameForm.columnName}
            position={columnRenameForm.position}
            onUpdateAction={handleColumnRenameUpdate}
            onCloseAction={handleColumnRenameFormClose}
          />
        )}

      {/* Floating Add Row Button */}
      <FloatingAddRowButton onClick={handleFloatingAddRow} />
    </div>
  );
}
