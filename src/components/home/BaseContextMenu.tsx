"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Pencil, Trash2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/components/ui/form";
import { Button } from "~/components/ui/button";

interface BaseContextMenuProps {
  baseId: string;
  initialName: string;
  position: { x: number; y: number };
  onUpdateAction: (baseName: string) => Promise<void>;
  onDeleteAction: (baseId: string) => Promise<void>;
  onCloseAction: () => void;
}

export function BaseContextMenu({
  baseId,
  initialName,
  position,
  onUpdateAction,
  onDeleteAction,
  onCloseAction,
}: BaseContextMenuProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm({
    defaultValues: {
      name: initialName,
    },
  });

  useEffect(() => {
    form.reset({ name: initialName });
  }, [form, initialName]);

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

  const onSubmit = useCallback(
    async (data: { name: string }) => {
      const trimmedName = data.name.trim();
      if (!trimmedName) return;

      try {
        await onUpdateAction(trimmedName);
        setIsEditing(false);
        onCloseAction();
      } catch (error) {
        console.error("Failed to update base:", error);
      }
    },
    [onUpdateAction, onCloseAction],
  );

  const handleCancel = useCallback(() => {
    form.reset({ name: initialName });
    setIsEditing(false);
  }, [form, initialName]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleDelete = useCallback(async () => {
    try {
      await onDeleteAction(baseId);
      onCloseAction();
    } catch (error) {
      console.error("Failed to delete base:", error);
    }
  }, [onDeleteAction, baseId, onCloseAction]);

  const fieldValue = form.watch("name");
  const isFieldEmpty = !fieldValue?.trim();

  if (!isEditing) {
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
            Rename base
          </button>

          <div className="mx-3 border-t border-gray-200"></div>

          <button
            onClick={handleDelete}
            className="flex w-full items-center gap-4 rounded px-3 py-2 text-left text-[13px] text-red-500 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
          >
            <Trash2 className="h-3.5 w-3.5 text-gray-500" />
            Delete base
          </button>
        </div>
      </div>
    );
  }

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
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            rules={{
              required: "Please enter a non-empty base name",
              validate: (value) =>
                value.trim() !== "" || "Please enter a non-empty base name",
            }}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <input
                    {...field}
                    className="w-full rounded border border-gray-200 px-3 py-2 text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    placeholder="Base name"
                    autoFocus
                  />
                </FormControl>
                <FormMessage className="text-xs text-red-500" />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isFieldEmpty}
              className="h-8 w-16 bg-blue-600 text-[13px] font-normal text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
