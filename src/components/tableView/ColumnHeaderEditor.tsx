"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/components/ui/form";
import { Button } from "~/components/ui/button";
import { DROPDOWN_STYLE } from "./constants";

interface ColumnHeaderEditorProps {
  columnId: string;
  initialName: string;
  position: { x: number; y: number };
  onUpdateAction: (columnName: string) => Promise<void>;
  onDeleteAction: (columnId: string) => Promise<void>;
  onCloseAction: () => void;
}

export function ColumnHeaderEditor({
  columnId,
  initialName,
  position,
  onUpdateAction,
  onDeleteAction,
  onCloseAction,
}: ColumnHeaderEditorProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm({
    defaultValues: {
      name: initialName,
    },
  });

  // Reset form when component mounts
  useEffect(() => {
    form.reset({ name: initialName });
  }, [initialName, form]);

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

  const onSubmit = useCallback(
    async (data: { name: string }) => {
      const trimmedName = data.name.trim();
      if (!trimmedName) return;

      try {
        await onUpdateAction(trimmedName);
        setIsEditing(false);
        onCloseAction();
      } catch (error) {
        console.error("Failed to update column:", error);
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
      await onDeleteAction(columnId);
      onCloseAction();
    } catch (error) {
      console.error("Failed to delete column:", error);
    }
  }, [onDeleteAction, columnId, onCloseAction]);

  const fieldValue = form.watch("name");
  const isFieldEmpty = !fieldValue?.trim();

  // Show context menu if not editing
  if (!isEditing) {
    return (
      <div
        ref={dropdownRef}
        className="fixed z-50 rounded-md border border-gray-200 bg-white shadow-lg"
        style={{
          left: position.x,
          top: position.y,
          ...DROPDOWN_STYLE,
        }}
      >
        <div className="py-1">
          <button
            onClick={handleEdit}
            className="w-full px-4 py-2 text-left text-[13px] hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
          >
            Edit column
          </button>
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-[13px] text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
          >
            Delete column
          </button>
        </div>
      </div>
    );
  }

  // Show edit form if editing
  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 rounded-md border border-gray-200 bg-white p-3 shadow-lg"
      style={{
        left: position.x,
        top: position.y,
        ...DROPDOWN_STYLE,
      }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            rules={{
              required: "Please enter a non-empty field name",
              validate: (value) =>
                value.trim() !== "" || "Please enter a non-empty field name",
            }}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <input
                    {...field}
                    className="w-full rounded border border-gray-200 px-3 py-2 text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    placeholder="Column name"
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
              className="text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
