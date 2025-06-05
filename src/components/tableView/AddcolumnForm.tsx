import { useForm } from "react-hook-form";
import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Baseline, Hash } from "lucide-react";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "../ui/form";
import { Button } from "../ui/button";
import { DropdownMenuContent } from "../ui/dropdown-menu";

export default function AddColumnForm({
  onAddColumn,
  isOpen,
  setIsOpen,
}: {
  onAddColumn: (name: string, type: "text" | "number") => Promise<void>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const form = useForm({
    defaultValues: {
      name: "",
      type: "text" as "text" | "number",
    },
  });

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      form.reset({ name: "", type: "text" });
    }
  }, [form, isOpen]);

  const onSubmit = useCallback(
    async (data: { name: string; type: "text" | "number" }) => {
      const trimmedName = data.name.trim();
      if (!trimmedName) return;

      setIsOpen(false);

      try {
        await onAddColumn(trimmedName, data.type);
      } catch (error) {
        console.error("Failed to add column:", error);
        toast.error("Failed to add column");
      }
    },
    [onAddColumn, setIsOpen],
  );

  const handleCancel = useCallback(() => {
    form.reset({ name: "", type: "text" });
    setIsOpen(false);
  }, [form, setIsOpen]);

  const fieldValue = form.watch("name");
  const isFieldEmpty = !fieldValue?.trim();

  return (
    <DropdownMenuContent className="w-64 p-4" align="end">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            rules={{
              required: "Please enter a column name",
              validate: (value) =>
                value.trim() !== "" || "Please enter a column name",
            }}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <input
                    {...field}
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    placeholder="Column name"
                    autoFocus
                  />
                </FormControl>
                <FormMessage className="text-xs text-red-500" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <select
                      {...field}
                      className="w-full appearance-none rounded border border-gray-200 py-2 pr-8 pl-9 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                    </select>
                    <div className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 transform">
                      {field.value === "text" ? (
                        <Baseline className="h-3.5 w-3.5 text-gray-500" />
                      ) : (
                        <Hash className="h-3.5 w-3.5 text-gray-500" />
                      )}
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <svg
                        className="h-4 w-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
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
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isFieldEmpty}
              className="h-8 w-24 bg-blue-600 text-[13px] font-normal text-white hover:bg-blue-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add Column
            </Button>
          </div>
        </form>
      </Form>
    </DropdownMenuContent>
  );
}
