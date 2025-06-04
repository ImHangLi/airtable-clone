"use client";

import { useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/components/ui/form";
import { Button } from "~/components/ui/button";

interface TableRenameFormProps {
  initialName: string;
  position: { x: number; y: number };
  onUpdateAction: (tableName: string) => Promise<void>;
  onCloseAction: () => void;
}

export function TableRenameForm({
  initialName,
  position,
  onUpdateAction,
  onCloseAction,
}: TableRenameFormProps) {
  const formRef = useRef<HTMLDivElement>(null);

  const form = useForm({
    defaultValues: {
      name: initialName,
    },
  });

  // Reset form when component mounts
  useEffect(() => {
    form.reset({ name: initialName });
  }, [form, initialName]);

  // Handle clicks outside and escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
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

  const onSubmit = useCallback(
    async (data: { name: string }) => {
      const trimmedName = data.name.trim();
      if (!trimmedName) return;

      try {
        await onUpdateAction(trimmedName);
        onCloseAction();
      } catch (error) {
        console.error("Failed to update table:", error);
      }
    },
    [onUpdateAction, onCloseAction],
  );

  const handleCancel = useCallback(() => {
    form.reset({ name: initialName });
    onCloseAction();
  }, [form, initialName, onCloseAction]);

  const fieldValue = form.watch("name");
  const isFieldEmpty = !fieldValue?.trim();

  return (
    <div
      ref={formRef}
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
              required: "Please enter a non-empty table name",
              validate: (value) =>
                value.trim() !== "" || "Please enter a non-empty table name",
            }}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <input
                    {...field}
                    className="w-full rounded border border-gray-200 px-3 py-2 text-[13px] focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    placeholder="Table name"
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
