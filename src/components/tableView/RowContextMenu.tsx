"use client";

import { useCallback, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

interface RowContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  rowId: string;
  onCloseAction: () => void;
  onDeleteAction: (rowId: string) => Promise<void>;
}

export function RowContextMenu({
  isOpen,
  position,
  rowId,
  onCloseAction,
  onDeleteAction,
}: RowContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isDeleting = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !isDeleting.current
      ) {
        onCloseAction();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting.current) {
        onCloseAction();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onCloseAction]);

  const handleDelete = useCallback(async () => {
    isDeleting.current = true;
    try {
      await onDeleteAction(rowId);
    } catch (error) {
      console.error("Error deleting record:", error);
      isDeleting.current = false;
    }
  }, [onDeleteAction, rowId]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
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
          onClick={handleDelete}
          className="flex w-full items-center gap-4 rounded px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
        >
          <Trash2 className="h-3.5 w-3.5 text-gray-500" />
          Delete record
        </button>
      </div>
    </div>
  );
}
