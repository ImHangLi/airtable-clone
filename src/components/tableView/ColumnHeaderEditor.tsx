"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ColumnRenameForm } from "./ColumnRenameForm";

interface ColumnHeaderEditorProps {
  columnId: string;
  initialName: string;
  position: { x: number; y: number };
  onUpdateAction: (columnName: string) => Promise<void>;
  onDeleteAction: (columnId: string) => Promise<void>;
  onCloseAction: () => void;
  isPrimary?: boolean;
}

export function ColumnHeaderEditor({
  columnId,
  initialName,
  position,
  onUpdateAction,
  onDeleteAction,
  onCloseAction,
  isPrimary,
}: ColumnHeaderEditorProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);

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
        if (isEditing) {
          setIsEditing(false);
        } else {
          onCloseAction();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onCloseAction, isEditing]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleDelete = useCallback(async () => {
    // Don't allow deletion of primary columns
    if (isPrimary) {
      return;
    }

    try {
      await onDeleteAction(columnId);
      onCloseAction();
    } catch (error) {
      console.error("Failed to delete column:", error);
    }
  }, [onDeleteAction, columnId, onCloseAction, isPrimary]);

  const handleRenameComplete = useCallback(
    async (columnName: string) => {
      await onUpdateAction(columnName);
      setIsEditing(false);
    },
    [onUpdateAction],
  );

  const handleRenameCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Show rename form if editing
  if (isEditing) {
    return (
      <ColumnRenameForm
        initialName={initialName}
        position={position}
        onUpdateAction={handleRenameComplete}
        onCloseAction={handleRenameCancel}
      />
    );
  }

  // Show context menu if not editing
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
          onClick={handleEdit}
          className="flex w-full items-center gap-4 rounded px-3 py-2 text-left text-[13px] hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
        >
          <Pencil className="h-3.5 w-3.5 text-gray-500" />
          Edit field
        </button>

        {/* Border separator */}
        <div className="mx-3 border-t border-gray-200"></div>

        <button
          onClick={handleDelete}
          disabled={isPrimary}
          className={`flex w-full items-center gap-4 rounded px-3 py-2 text-left text-[13px] ${
            isPrimary
              ? "cursor-not-allowed text-red-500"
              : "text-red-500 hover:bg-red-50 focus:bg-red-50"
          } focus:outline-none`}
          title={isPrimary ? "Cannot delete primary field" : ""}
        >
          <Trash2 className="h-3.5 w-3.5 text-gray-500" />
          Delete field
        </button>
      </div>
    </div>
  );
}
