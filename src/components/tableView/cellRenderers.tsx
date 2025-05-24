"use client";

import type { CellContext } from "@tanstack/react-table";
import type { TableRow } from "~/hooks/useTableData";
import { EditableCell } from "./EditableCell";

export const createCellRenderer = (columnType: "text" | "number") => {
  return function CellRenderer(props: CellContext<TableRow, unknown>) {
    return <EditableCell props={props} columnType={columnType} />;
  };
};
