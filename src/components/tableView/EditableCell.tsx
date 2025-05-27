"use client";

import { useCallback, useState, useEffect } from "react";
import { toast } from "sonner";
import type { CellContext, Table } from "@tanstack/react-table";
import type { TableRow } from "~/hooks/useTableData";
import { baseCellStyle } from "./constants";

interface TableMeta {
  updateData: (
    rowId: string,
    columnId: string,
    value: string | number,
  ) => Promise<void>;
  editingCell?: { rowId: string; columnId: string } | null;
  setEditingCell?: (cell: { rowId: string; columnId: string } | null) => void;
}

interface EditableCellProps {
  props: CellContext<TableRow, unknown>;
  columnType: "text" | "number";
}

export function EditableCell({ props, columnType }: EditableCellProps) {
  const { row, column, getValue, table } = props;
  const initialValue = getValue() as string | number;
  const [value, setValue] = useState<string | number>(initialValue);

  // Get table meta with editing state handlers
  const tableWithMeta = table as Table<TableRow> & {
    options: { meta: TableMeta };
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      if (columnType === "number") {
        // Allow empty string or valid numbers (including negative and decimal)
        if (inputValue === "" || /^-?\d*\.?\d*$/.test(inputValue)) {
          setValue(inputValue === "" ? "" : Number(inputValue));
        } else {
          toast.error("Please enter a valid number");
        }
      } else {
        setValue(inputValue);
      }
    },
    [columnType],
  );

  const handleFocus = useCallback(() => {
    tableWithMeta.options.meta.setEditingCell?.({
      rowId: row.original.id,
      columnId: column.id,
    });
  }, [row.original.id, column.id, tableWithMeta.options.meta]);

  // Save changes on blur
  const handleBlur = useCallback(async () => {
    tableWithMeta.options.meta.setEditingCell?.(null);

    if (value === initialValue) return;

    try {
      await tableWithMeta.options.meta.updateData(
        row.original.id,
        column.id,
        value,
      );
    } catch (error) {
      console.error("Failed to update cell:", error);
      toast.error("Failed to update cell");
    }
  }, [
    value,
    initialValue,
    tableWithMeta.options.meta,
    row.original.id,
    column.id,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        setValue(initialValue);
        (e.target as HTMLInputElement).blur();
      }
    },
    [initialValue],
  );

  return (
    <input
      className="h-full w-full border-0 bg-transparent text-[13px] outline-none"
      style={baseCellStyle}
      value={value === "" ? "" : String(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      id={`editable-cell-${row.original.id}-${column.id}`}
    />
  );
}
