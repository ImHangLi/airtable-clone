"use client";

import { useCallback, useEffect, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";

interface TableContextMenuProps {
  tableId: string;
  initialName: string;
  position: { x: number; y: number };
  onRenameAction: () => void;
  onDeleteAction: (tableId: string) => Promise<void>;
  onCloseAction: () => void;
  canDelete: boolean; // Whether this table can be deleted (not the last table)
}

export function TableContextMenu({
  tableId,
  initialName,
  position,
  onRenameAction,
  onDeleteAction,
  onCloseAction,
  canDelete,
}: TableContextMenuProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside and escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onCloseAction();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseAction();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onCloseAction]);

  const handleRename = useCallback(() => {
    onRenameAction();
    onCloseAction();
  }, [onRenameAction, onCloseAction]);

  const handleDelete = useCallback(async () => {
    // Don't allow deletion if this is the last table
    if (!canDelete) {
      return;
    }

    try {
      await onDeleteAction(tableId);
      onCloseAction();
    } catch (error) {
      console.error("Failed to delete table:", error);
    }
  }, [onDeleteAction, tableId, onCloseAction, canDelete]);

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 rounded-md border border-gray-200 bg-white shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        width: "320px",
        padding: "12px",
      }}
    >
      <div className="space-y-1">
        <button
          onClick={handleRename}
          className="flex w-full items-center gap-4 rounded px-3 py-2 text-left text-[13px] hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
        >
          <Pencil className="h-3.5 w-3.5 text-gray-500" />
          Rename table
        </button>

        {/* Border separator */}
        <div className="mx-3 border-t border-gray-200"></div>

        <button
          onClick={handleDelete}
          disabled={!canDelete}
          className={`flex w-full items-center gap-4 rounded px-3 py-2 text-left text-[13px] ${
            !canDelete
              ? "cursor-not-allowed text-gray-400"
              : "text-red-500 hover:bg-red-50 focus:bg-red-50"
          } focus:outline-none`}
          title={!canDelete ? "Cannot delete the last table" : ""}
        >
          <Trash2 className="h-3.5 w-3.5 text-gray-500" />
          Delete table
        </button>
      </div>
    </div>
  );
}
