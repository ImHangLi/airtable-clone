import { z } from "zod";
import type { ColumnType } from "~/server/db/schema";

export const createDefaultTableSchema = z.object({
  tableName: z.string().min(1, "Table name is required"),
  viewName: z.string().min(1, "View name is required"),
  baseId: z.string().uuid("Invalid base ID"),
});

export const getLatestSchema = z.object({
  baseId: z.string().uuid("Invalid base ID"),
});

export const updateCellSchema = z.object({
  rowId: z.string().uuid("Invalid row ID"),
  columnId: z.string().uuid("Invalid column ID"),
  value: z.union([z.string(), z.number()]),
  baseId: z.string().uuid("Invalid base ID"),
});

export const createRowSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  baseId: z.string().uuid("Invalid base ID"),
});

export const deleteRowSchema = z.object({
  rowId: z.string().uuid("Invalid row ID"),
});

export const updateColumnSchema = z.object({
  columnId: z.string().uuid("Invalid column ID"),
  name: z.string().min(1, "Column name is required"),
});

export const deleteColumnSchema = z.object({
  columnId: z.string().uuid("Invalid column ID"),
});

export const addColumnSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  name: z.string().min(1, "Column name is required"),
  type: z.enum(["text", "number"]),
});

export const addManyRowsSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  baseId: z.string().uuid("Invalid base ID"),
});

export type TableWithView = {
  table: {
    id: string;
    name: string;
    base_id: string;
    created_at: Date;
    updated_at: Date;
  };
  view: {
    id: string;
    name: string;
    table_id: string;
    base_id: string;
    config: unknown;
    created_at: Date;
    updated_at: Date;
  };
};

export async function getCellValue(
  columnType: ColumnType,
  value: string | number,
) {
  if (columnType === "text") {
    return {
      value_text: value === "" ? null : String(value),
      value_number: null,
    };
  } else if (columnType === "number") {
    return {
      value_text: null,
      value_number: value === "" ? null : Number(value),
    };
  }

  throw new Error("Unsupported column type");
}
