import { EyeOff, Baseline, Hash } from "lucide-react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { useState, useCallback } from "react";
import type { TableColumn } from "~/hooks/useTableData";

interface HiddenColumnsMenuProps {
  columns: TableColumn[];
  hiddenColumns: string[];
  onSetHiddenColumns: (columns: string[]) => void;
  onShowAllColumns: () => void;
  onHideAllColumns: () => void;
}

export default function HiddenColumnsMenu({
  columns,
  hiddenColumns,
  onSetHiddenColumns,
  onShowAllColumns,
  onHideAllColumns,
}: HiddenColumnsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filter out primary columns since they can never be hidden
  const hideableColumns = columns.filter((column) => !column.is_primary);

  const hiddenCount = hiddenColumns.length;
  const hasHiddenColumns = hiddenCount > 0;

  const handleToggleColumn = useCallback(
    (columnId: string) => {
      const isCurrentlyHidden = hiddenColumns.includes(columnId);
      let newHiddenColumns: string[];

      if (isCurrentlyHidden) {
        newHiddenColumns = hiddenColumns.filter((id) => id !== columnId);
      } else {
        newHiddenColumns = [...hiddenColumns, columnId];
      }

      onSetHiddenColumns(newHiddenColumns);
    },
    [hiddenColumns, onSetHiddenColumns],
  );

  const handleHideAll = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onHideAllColumns();
    },
    [onHideAllColumns],
  );

  const handleShowAll = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onShowAllColumns();
    },
    [onShowAllColumns],
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded px-2 text-[13px] font-normal",
            hasHiddenColumns
              ? "bg-[#C4ECFF] text-gray-700 hover:shadow-[inset_0px_0px_0px_2px_rgba(0,0,0,0.1)]"
              : "text-gray-700 hover:bg-gray-100",
          )}
          title="Hide fields button"
        >
          <EyeOff className="h-4 w-4" />
          <p className="hidden text-[13px] md:block">
            {hasHiddenColumns
              ? `${hiddenCount} hidden ${hiddenCount === 1 ? "field" : "fields"}`
              : "Hide fields"}
          </p>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="p-4"
        style={{ width: "320px", maxHeight: "80vh" }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mb-4 ml-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-medium text-gray-500">
              Hide fields
            </h3>
          </div>
        </div>

        {/* Fields list with switches */}
        <div className="mb-4 max-h-[calc(80vh-120px)] space-y-2 overflow-y-auto">
          {hideableColumns.length === 0 ? (
            <div className="py-2 text-center text-[13px] text-gray-500">
              No hideable fields available
            </div>
          ) : (
            hideableColumns.map((column) => {
              const isHidden = hiddenColumns.includes(column.id);
              const isVisible = !isHidden;

              return (
                <div
                  key={column.id}
                  className="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    {column.type === "text" ? (
                      <Baseline className="h-3.5 w-3.5 text-gray-500" />
                    ) : (
                      <Hash className="h-3.5 w-3.5 text-gray-500" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-[13px] font-normal text-gray-900">
                        {column.name}
                      </span>
                    </div>
                  </div>

                  <Switch
                    checked={isVisible}
                    onCheckedChange={() => handleToggleColumn(column.id)}
                    className="scale-75"
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-auto border-t border-gray-200 pt-3">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 flex-1 text-[13px] font-normal text-gray-700 hover:bg-gray-100"
              onClick={handleHideAll}
              disabled={hideableColumns.length === 0}
            >
              Hide all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 flex-1 text-[13px] font-normal text-gray-700 hover:bg-gray-100"
              onClick={handleShowAll}
              disabled={hiddenColumns.length === 0}
            >
              Show all
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
