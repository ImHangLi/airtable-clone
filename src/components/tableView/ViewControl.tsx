import {
  ChevronDown,
  Eye,
  Filter,
  Grid,
  Group,
  Menu,
  Plus,
  Database,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/components/ui/form";
import type { TableActions, TableData } from "~/hooks/useTableData";
import { SearchInput } from "./SearchInput";
import SortMenu, { type SortConfig } from "./SortMenu";

interface ViewControlProps {
  tableId: string;
  baseId: string;
  tableActions: TableActions;
  tableData?: TableData;
  isSaving?: boolean;
  setIsSaving?: (saving: boolean) => void;
  setSearchQuery: (query: string) => void;
  sorting: SortConfig[];
  onSortingChange: (sorting: SortConfig[]) => void;
}

// Add column form component
function AddColumnForm({
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
                  <select
                    {...field}
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                  </select>
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
              size="sm"
              disabled={isFieldEmpty}
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add Column
            </Button>
          </div>
        </form>
      </Form>
    </DropdownMenuContent>
  );
}

export default function ViewControl({
  tableId,
  baseId,
  tableActions,
  tableData,
  isSaving = false,
  setIsSaving,
  setSearchQuery,
  sorting,
  onSortingChange,
}: ViewControlProps) {
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [isAddingManyRows, setIsAddingManyRows] = useState(false);
  const utils = api.useUtils();

  // Add many rows mutation
  const addManyRowsMutation = api.row.addManyRows.useMutation({
    onSuccess: () => {
      setIsAddingManyRows(false);
      toast.success("Successfully added 100k rows!");
      // Invalidate and refetch the table data
      void utils.data.getInfiniteTableData.invalidate({
        tableId: tableData?.name ?? "",
      });
    },
    onError: (error) => {
      toast.error(`Error adding rows: ${error.message}`);
      setIsAddingManyRows(false);
    },
  });

  // Handle add single row
  const handleAddRow = useCallback(async () => {
    try {
      setIsSaving?.(true);
      await tableActions.addRow();
    } catch (error) {
      console.error("Failed to add row:", error);
      toast.error("Failed to add row");
    } finally {
      setIsSaving?.(false);
    }
  }, [tableActions, setIsSaving]);

  // Handle add column
  const handleAddColumn = useCallback(
    async (name: string, type: "text" | "number") => {
      try {
        setIsSaving?.(true);
        await tableActions.addColumn(name, type);
      } catch (error) {
        console.error("Failed to add column:", error);
        toast.error("Failed to add column");
      } finally {
        setIsSaving?.(false);
      }
    },
    [tableActions, setIsSaving],
  );

  // Handle add 100k rows
  const handleAddManyRows = useCallback(() => {
    setIsAddingManyRows(true);
    addManyRowsMutation.mutate({ tableId, baseId });
  }, [addManyRowsMutation, tableId, baseId]);

  return (
    <div className="flex flex-col">
      {/* Main controls bar */}
      <div className="flex min-h-11 items-center gap-2 border-b border-gray-200 bg-white px-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded bg-gray-100 px-2 text-sm font-normal text-gray-700"
          title="Views button"
        >
          <Menu className="h-4 w-4" />
          <span className="text-[13px] text-black">Views</span>
        </Button>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded px-2 text-sm font-normal text-gray-700 hover:bg-gray-100"
            title="Grid view button"
          >
            <Grid className="h-4 w-4 text-blue-600" />
            <span className="text-[13px] text-black">Grid view</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded px-2 text-sm font-normal text-gray-700 hover:bg-gray-100"
            title="Hide fields button"
          >
            <Eye className="h-4 w-4" />
            <p className="hidden text-[13px] md:block">Hide fields</p>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded px-2 text-sm font-normal text-gray-700 hover:bg-gray-100"
            title="Filter button"
          >
            <Filter className="h-4 w-4" />
            <p className="hidden text-[13px] md:block">Filter</p>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded px-2 text-sm font-normal text-gray-700 hover:bg-gray-100"
          >
            <Group className="h-4 w-4" />
            <p className="hidden text-[13px] md:block">Group</p>
          </Button>

          <SortMenu
            columns={tableData?.columns ?? []}
            sorting={sorting}
            onSortingChange={onSortingChange}
          />
        </div>

        {/* Action buttons section */}
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex items-center gap-0.5">
          {/* Add Row Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded px-2 text-sm font-normal text-gray-700 hover:bg-gray-100"
            onClick={handleAddRow}
            disabled={isSaving}
            title="Adds a row to the table"
          >
            <Plus className="h-4 w-4" />
            <p className="hidden text-[13px] md:block">Add row</p>
          </Button>

          {/* Add Column Button */}
          <DropdownMenu
            open={isAddColumnOpen}
            onOpenChange={setIsAddColumnOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded p-3 text-sm font-normal text-gray-700 hover:bg-gray-100"
              >
                <Plus className="h-4 w-4" />
                <p className="hidden text-[13px] md:block">Add column</p>
              </Button>
            </DropdownMenuTrigger>
            <AddColumnForm
              onAddColumn={handleAddColumn}
              isOpen={isAddColumnOpen}
              setIsOpen={setIsAddColumnOpen}
            />
          </DropdownMenu>

          {/* Add 100k Rows Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded px-2 text-sm font-normal text-gray-700 hover:bg-gray-100 disabled:opacity-75"
            onClick={handleAddManyRows}
            disabled={isAddingManyRows}
            title="Adds 100k rows magic button"
          >
            {isAddingManyRows ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            <p className="hidden text-[13px] md:block">Add 100k rows</p>
          </Button>
        </div>

        <div className="flex-1" />

        {/* Saving indicator */}
        {isSaving && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving...</span>
          </div>
        )}

        {!isSaving && isAddingManyRows && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Adding 100k rows...</span>
          </div>
        )}

        {!isSaving &&
          !isAddingManyRows &&
          tableData?.isFetching &&
          !tableData?.isFetchingNextPage && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          )}

        {/* Show loading more data (lowest priority) */}
        {!isSaving &&
          !isAddingManyRows &&
          !tableData?.isFetching &&
          tableData?.isFetchingNextPage && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="h-3 w-3 animate-spin rounded-full border border-gray-300 border-t-blue-600"></div>
              <span>Loading more...</span>
            </div>
          )}

        <SearchInput onChange={setSearchQuery} disabled={isSaving} />
      </div>
    </div>
  );
}
