"use client";

import { useEffect, useRef } from "react";
import { DROPDOWN_STYLE } from "./constants";

interface SimpleContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onCloseAction: () => void;
  onDeleteAction: () => void;
}

export function SimpleContextMenu({
  isOpen,
  position,
  onCloseAction,
  onDeleteAction,
}: SimpleContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onCloseAction();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-md border border-gray-200 bg-white p-3 shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        ...DROPDOWN_STYLE,
      }}
    >
      <button
        onClick={onDeleteAction}
        className="w-full cursor-pointer rounded px-2 py-1.5 text-left text-[13px] text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
      >
        Delete record
      </button>
    </div>
  );
}
