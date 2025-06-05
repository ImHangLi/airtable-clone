import { useCallback, useState, useEffect, useRef } from "react";
import type { TableColumn } from "~/hooks/useTableData";
import { CELL_CONFIG, baseCellStyle } from "./constants";

interface DraftRowProps {
  columns: TableColumn[];
  columnVisibility: Record<string, boolean>;
  totalColumnWidth: number;
  onSave: (data: Record<string, string | number>) => void;
  onCancel: () => void;
  getCellWidth: (isRowNumber?: boolean) => React.CSSProperties;
  focusedCell: string | null;
  setFocusedCell: (cellId: string | null) => void;
}

export function DraftRow({
  columns,
  columnVisibility,
  totalColumnWidth,
  onSave,
  onCancel,
  getCellWidth,
  focusedCell,
  setFocusedCell,
}: DraftRowProps) {
  const [draftData, setDraftData] = useState<Record<string, string | number>>(
    {},
  );
  const rowRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Initialize draft data for visible columns
  useEffect(() => {
    const initialData: Record<string, string | number> = {};
    columns.forEach((column) => {
      if (columnVisibility[column.id]) {
        initialData[column.id] = "";
      }
    });
    setDraftData(initialData);
  }, [columns, columnVisibility]);

  // Focus the first cell when component mounts and auto-focus first cell
  useEffect(() => {
    // Small delay to ensure component is rendered
    const timer = setTimeout(() => {
      const firstVisibleColumn = columns.find(
        (column) => columnVisibility[column.id],
      );
      if (firstVisibleColumn) {
        setFocusedCell(firstVisibleColumn.id);
        firstInputRef.current?.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [columns, columnVisibility, setFocusedCell]);

  // Handle clicking outside the row to save - always save regardless of data
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(event.target as Node)) {
        console.log("Click outside detected, saving data:", draftData);
        onSave(draftData);
      }
    };

    // Use setTimeout to ensure the event listener is added after the component is fully rendered
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [draftData, onSave]);

  const handleCellChange = useCallback(
    (columnId: string, value: string | number) => {
      setDraftData((prev) => ({
        ...prev,
        [columnId]: value,
      }));
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSave(draftData);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [draftData, onSave, onCancel],
  );

  const visibleColumns = columns.filter(
    (column) => columnVisibility[column.id],
  );

  return (
    <div
      ref={rowRef}
      className="relative w-full"
      style={{
        height: `${CELL_CONFIG.height}px`,
        width: totalColumnWidth,
        backgroundColor: "#f3f4f6", // Light blue/gray background to indicate it's editable
        borderBottom: "1px solid #dee1e3",
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex">
        {/* Row number column - styled exactly like regular rows */}
        <div
          className="relative flex items-center justify-center"
          data-sticky="draft-row-number"
          style={{
            ...baseCellStyle,
            ...getCellWidth(true),
            borderRight: "1px solid #dee1e3",
            position: "sticky",
            left: 0,
            zIndex: 35,
            backgroundColor: "#f3f4f6",
            borderBottom: "1px solid #dee1e3",
          }}
        ></div>

        {/* Input cells for each visible column - styled exactly like regular cells */}
        {visibleColumns.map((column, index) => {
          const isFocused = focusedCell === column.id;

          return (
            <div
              key={column.id}
              className="relative flex items-center"
              data-sticky={index === 0 ? "draft-primary-column" : undefined}
              style={{
                ...baseCellStyle,
                ...getCellWidth(false),
                borderRight: isFocused
                  ? "1px solid #186ce4"
                  : "1px solid #dee1e3",
                borderTop: isFocused ? "1px solid #186ce4" : "none",
                borderBottom: isFocused
                  ? "1px solid #186ce4"
                  : "1px solid #dee1e3",
                borderLeft: isFocused ? "1px solid #186ce4" : "none",
                backgroundColor: "#f3f4f6",
                zIndex: isFocused ? 10 : "auto",
                boxShadow: isFocused ? "0 0 0 1px #186ce4 inset" : "none",
                // Make first data column sticky exactly like regular rows
                ...(index === 0 && {
                  position: "sticky",
                  left: CELL_CONFIG.rowNumberWidth,
                  zIndex: isFocused ? 20 : 35,
                  borderBottom: isFocused
                    ? "1px solid #186ce4"
                    : "1px solid #dee1e3",
                }),
              }}
            >
              <input
                ref={index === 0 ? firstInputRef : undefined}
                type={column.type === "number" ? "number" : "text"}
                value={draftData[column.id] ?? ""}
                onChange={(e) => {
                  const value =
                    column.type === "number"
                      ? e.target.value === ""
                        ? ""
                        : Number(e.target.value)
                      : e.target.value;
                  handleCellChange(column.id, value);
                }}
                onFocus={() => setFocusedCell(column.id)}
                onBlur={() => setFocusedCell(null)}
                className="h-full w-full border-0 bg-transparent text-[13px] placeholder-gray-400 outline-none"
                style={baseCellStyle}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
