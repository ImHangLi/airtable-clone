"use client";

import { baseCellStyle } from "./constants";

interface RowNumberCellProps {
  rowIndex: number;
}

export function RowNumberCell({ rowIndex }: RowNumberCellProps) {
  return (
    <div
      className="text-[13px] font-normal text-gray-500"
      style={baseCellStyle}
    >
      {rowIndex + 1}
    </div>
  );
}
