import { useForm } from "react-hook-form";
import { useEffect, useCallback, useState } from "react";
import { toast } from "sonner";
import { Baseline, Hash, ChevronDown } from "lucide-react";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "../ui/form";
import { Button } from "../ui/button";
import { PopoverContent, Popover, PopoverTrigger } from "../ui/popover";

export default function AddColumnForm({
  onAddColumn,
  isOpen,
  setIsOpen,
}: {
  onAddColumn: (name: string, type: "text" | "number") => Promise<void>;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const [typeSelectorOpen, setTypeSelectorOpen] = useState(false);

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
    <PopoverContent className="w-64 p-4" align="end">
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
                  <Popover
                    open={typeSelectorOpen}
                    onOpenChange={setTypeSelectorOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-auto w-full justify-between gap-2 rounded border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-400"
                      >
                        <div className="flex items-center gap-2">
                          {field.value === "text" ? (
                            <Baseline className="h-3.5 w-3.5 text-gray-500" />
                          ) : (
                            <Hash className="h-3.5 w-3.5 text-gray-500" />
                          )}
                          <span>
                            {field.value === "text" ? "Text" : "Number"}
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[200px] p-1">
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            field.onChange("text");
                            setTypeSelectorOpen(false);
                          }}
                          className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-sm hover:bg-gray-100"
                        >
                          <Baseline className="h-3.5 w-3.5 text-gray-500" />
                          Text
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            field.onChange("number");
                            setTypeSelectorOpen(false);
                          }}
                          className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-sm hover:bg-gray-100"
                        >
                          <Hash className="h-3.5 w-3.5 text-gray-500" />
                          Number
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
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
    </PopoverContent>
  );
}
