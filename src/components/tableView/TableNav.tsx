import { Plus, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { useCallback, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { TableContextMenu } from "./TableContextMenu";
import { TableRenameForm } from "./TableRenameForm";
import { setLastViewedTable } from "~/utils/lastViewedTable";
import { setLastViewedView, getLastViewedView } from "~/utils/lastViewedView";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "../ui/form";
import { getColorFromBaseId, getDarkerColorFromBaseId } from "~/lib/utils";
import { useTableActions } from "~/hooks/useTableActions";

interface TableNavProps {
  baseId: string;
  currentTableId: string;
}

export default function TableNav({ baseId, currentTableId }: TableNavProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const formRef = useRef<HTMLDivElement>(null);

  const baseColor = getColorFromBaseId(baseId);
  const darkerColor = getDarkerColorFromBaseId(baseId);

  // State management with persistence
  const [isAddingTable, setIsAddingTable] = useState(() => {
    if (typeof window !== "undefined") {
      const savedState = sessionStorage.getItem(`addingTable_${baseId}`);
      return savedState === "true";
    }
    return false;
  });

  // State for rename form
  const [renameForm, setRenameForm] = useState<{
    tableId: string;
    tableName: string;
    position: { x: number; y: number };
  } | null>(null);

  const form = useForm({
    defaultValues: {
      name:
        typeof window !== "undefined"
          ? (sessionStorage.getItem(`newTableName_${baseId}`) ?? "")
          : "",
    },
  });

  const {
    tables,
    contextMenu,
    canDeleteTable,
    handleShowContextMenu,
    handleCloseContextMenu,
    handleDeleteTable,
  } = useTableActions({ baseId, currentTableId });

  const { isLoading } = api.table.getTablesByBase.useQuery(
    { baseId },
    {
      enabled: !!baseId,
      refetchOnWindowFocus: false,
    },
  );

  // Persistence helper
  const persistFormState = useCallback(
    (showForm: boolean, tableName = "") => {
      if (typeof window !== "undefined") {
        if (showForm) {
          sessionStorage.setItem(`addingTable_${baseId}`, "true");
          sessionStorage.setItem(`newTableName_${baseId}`, tableName);
        } else {
          sessionStorage.removeItem(`addingTable_${baseId}`);
          sessionStorage.removeItem(`newTableName_${baseId}`);
        }
      }
    },
    [baseId],
  );

  // Mutations
  const createTableMutation = api.table.createTable.useMutation({
    onMutate: async ({ name }) => {
      await utils.table.getTablesByBase.cancel({ baseId });

      const previousTables = utils.table.getTablesByBase.getData({ baseId });
      const tempId = `temp-${Date.now()}`;
      const tempTable = {
        id: tempId,
        name,
        base_id: baseId,
        created_at: new Date(),
        updated_at: new Date(),
      };

      utils.table.getTablesByBase.setData({ baseId }, (old) =>
        old ? [...old, tempTable] : [tempTable],
      );

      return { previousTables, tempTable, tempId };
    },
    onSuccess: (newTableData, variables, context) => {
      utils.table.getTablesByBase.setData({ baseId }, (old) => {
        if (!old) return old;
        return old.map((table) =>
          table.id === context?.tempId ? newTableData.table : table,
        );
      });

      if (newTableData?.table?.id && newTableData?.view?.id) {
        const navigationUrl = `/${baseId}/${newTableData.table.id}/${newTableData.view.id}`;

        setLastViewedTable(baseId, newTableData.table.id);
        setLastViewedView(newTableData.table.id, newTableData.view.id);

        router.push(navigationUrl);
      }
    },
    onError: (error, _, context) => {
      if (context?.previousTables) {
        utils.table.getTablesByBase.setData({ baseId }, context.previousTables);
      }
      toast.error(`Failed to create table: ${error.message}`);
    },
  });

  const updateTableNameMutation = api.table.updateTableName.useMutation({
    onMutate: async ({ tableId, name }) => {
      await utils.table.getTablesByBase.cancel({ baseId });

      const previousTables = utils.table.getTablesByBase.getData({ baseId });

      utils.table.getTablesByBase.setData({ baseId }, (old) => {
        if (!old) return old;
        return old.map((table) =>
          table.id === tableId ? { ...table, name } : table,
        );
      });

      return { previousTables };
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousTables) {
        utils.table.getTablesByBase.setData({ baseId }, context.previousTables);
      }
      toast.error(`Failed to rename table: ${error.message}`);
      // Invalidate to ensure fresh data after error
      void utils.table.getTablesByBase.invalidate({ baseId });
    },
    onSettled: () => {
      // Ensure data is fresh after mutation completes
      void utils.table.getTablesByBase.invalidate({ baseId });
    },
  });

  // Helper functions
  const getDefaultTableName = useCallback(() => {
    if (!tables.length) return "Table 1";

    const numberTables = tables.filter((table) => {
      return /^Table \d+$/.test(table.name);
    });

    if (numberTables.length === 0) return "Table 1";

    let maxNumber = 0;
    numberTables.forEach((table) => {
      const match = /^Table (\d+)$/.exec(table.name);
      if (match) {
        const num = parseInt(match[1] ?? "0", 10);
        if (num > maxNumber) maxNumber = num;
      }
    });

    return `Table ${maxNumber + 1}`;
  }, [tables]);

  // Event handlers
  const handleAddTable = useCallback(() => {
    const defaultName = getDefaultTableName();

    form.reset({ name: defaultName });
    setIsAddingTable(true);
    persistFormState(true, defaultName);

    createTableMutation.mutate({
      name: defaultName,
      baseId,
    });
  }, [
    getDefaultTableName,
    form,
    createTableMutation,
    baseId,
    persistFormState,
  ]);

  const handleCreateTable = useCallback(
    async (data: { name: string }) => {
      const trimmedName = data.name.trim();
      if (!trimmedName) return;

      setIsAddingTable(false);
      persistFormState(false);

      const mostRecentTable = tables[tables.length - 1];
      if (mostRecentTable && mostRecentTable.name !== trimmedName) {
        updateTableNameMutation.mutate({
          tableId: mostRecentTable.id,
          name: trimmedName,
        });
      }
    },
    [tables, updateTableNameMutation, persistFormState],
  );

  const handleCancelAdd = useCallback(() => {
    setIsAddingTable(false);
    form.reset({ name: "" });
    persistFormState(false);
  }, [form, persistFormState]);

  const handleTableClick = useCallback(
    async (tableId: string) => {
      if (tableId.startsWith("temp-")) return;

      // 🚨 Cancel any pending table data queries to prevent race conditions
      try {
        await utils.data.getInfiniteTableData.cancel();
      } catch (error) {
        console.warn("Failed to cancel pending queries:", error);
      }

      const lastViewedViewId = getLastViewedView(tableId);

      if (lastViewedViewId) {
        setLastViewedTable(baseId, tableId);
        router.push(`/${baseId}/${tableId}/${lastViewedViewId}`);
      } else {
        utils.table.getTableDefaultView
          .fetch({ tableId })
          .then((data) => {
            if (data) {
              setLastViewedTable(baseId, tableId);
              setLastViewedView(tableId, data.view.id);
              router.push(`/${baseId}/${tableId}/${data.view.id}`);
            }
          })
          .catch((error) => {
            console.error("Failed to get table default view:", error);
            setLastViewedTable(baseId, tableId);
            router.push(`/${baseId}/${tableId}`);
          });
      }
    },
    [
      router,
      baseId,
      utils.table.getTableDefaultView,
      utils.data.getInfiniteTableData,
    ],
  );

  const handleTableRightClick = useCallback(
    (e: React.MouseEvent, tableId: string, tableName: string) => {
      e.preventDefault();
      e.stopPropagation();
      handleShowContextMenu(e, tableId, tableName);
    },
    [handleShowContextMenu],
  );

  // New handler for double-click on table name
  const handleTableDoubleClick = useCallback(
    (e: React.MouseEvent, tableId: string, tableName: string) => {
      if (tableId.startsWith("temp-")) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      setRenameForm({
        tableId,
        tableName,
        position: { x: rect.left, y: rect.bottom + 4 },
      });
    },
    [],
  );

  // New handler for ChevronDown click
  const handleChevronClick = useCallback(
    (e: React.MouseEvent, tableId: string, tableName: string) => {
      e.preventDefault();
      e.stopPropagation();
      handleShowContextMenu(e, tableId, tableName);
    },
    [handleShowContextMenu],
  );

  // Handler for showing rename form from context menu
  const handleShowRenameForm = useCallback(() => {
    if (contextMenu) {
      setRenameForm({
        tableId: contextMenu.tableId,
        tableName: contextMenu.tableName,
        position: contextMenu.position,
      });
    }
  }, [contextMenu]);

  // Handler to close rename form
  const handleCloseRenameForm = useCallback(() => {
    setRenameForm(null);
  }, []);

  // Simple rename handler for the rename form
  const handleRenameTableFromForm = useCallback(
    async (tableName: string) => {
      if (!renameForm) return;

      updateTableNameMutation.mutate({
        tableId: renameForm.tableId,
        name: tableName,
      });
    },
    [renameForm, updateTableNameMutation],
  );

  // Effects
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = sessionStorage.getItem(`newTableName_${baseId}`);
      if (savedName && isAddingTable) {
        form.reset({ name: savedName });
      }
    }
  }, [baseId, isAddingTable, form]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        formRef.current &&
        !formRef.current.contains(event.target as Node) &&
        isAddingTable
      ) {
        handleCancelAdd();
      }
    };

    if (isAddingTable) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAddingTable, handleCancelAdd]);

  // Render helpers
  const buttonBaseClasses =
    "relative gap-1 rounded-none rounded-t-[3px] px-3 text-[13px] leading-[18px] font-normal";
  const inactiveTextColor = "text-[rgba(255,255,255,0.85)]";
  const separatorClasses = "h-[12px] w-px bg-[#ffffff26]";

  // Show skeleton loading state when data is loading
  const showSkeletonLoading = isLoading && tables.length === 0;

  // Create skeleton placeholders that match the dimensions of actual table tabs
  const renderSkeletonTabs = () => {
    return (
      <>
        {/* Active table skeleton - wider to simulate current table */}
        <div className="relative flex items-center">
          <div
            className={`${buttonBaseClasses} bg-white`}
            style={{ minHeight: "32px", padding: "12px 12px" }}
          >
            <Skeleton className="h-[13px] w-16 bg-gray-200" />
          </div>
        </div>
      </>
    );
  };

  // Render actual table tabs
  const renderActualTabs = () => {
    return tables.map((table) => {
      const isActive = table.id === currentTableId;
      const isTemp = table.id.startsWith("temp-");

      return (
        <div key={table.id} className="relative flex items-center">
          <Button
            key={table.id}
            variant="ghost"
            size="sm"
            className={`${buttonBaseClasses} cursor-pointer ${
              isActive
                ? "bg-white text-black hover:bg-white"
                : `${inactiveTextColor}`
            }`}
            style={{
              backgroundColor: isActive ? "white" : darkerColor,
            }}
            onMouseOver={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.1)";
              }
            }}
            onMouseOut={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = darkerColor;
              }
            }}
            onClick={() => !isTemp && handleTableClick(table.id)}
            onContextMenu={(e) =>
              !isTemp && handleTableRightClick(e, table.id, table.name)
            }
            onDoubleClick={(e) =>
              !isTemp &&
              isActive &&
              handleTableDoubleClick(e, table.id, table.name)
            }
            disabled={isTemp}
          >
            <span
              className={`truncate text-[13px] ${isActive ? "text-black" : "text-[rgba(255,255,255,0.85)]"}`}
            >
              {table.name}
            </span>
            {isActive && (
              <div
                className="z-10 cursor-pointer rounded"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleChevronClick(e, table.id, table.name);
                }}
              >
                <ChevronDown className="h-4 w-4" />
              </div>
            )}
          </Button>
        </div>
      );
    });
  };

  return (
    <div
      className="flex h-8 items-center justify-between gap-2.5 overflow-hidden border-gray-200"
      style={{ backgroundColor: baseColor }}
    >
      {/* Tables */}
      <div
        className="relative flex min-h-8 flex-1 items-center overflow-hidden"
        style={{ backgroundColor: darkerColor, borderTopRightRadius: "6px" }}
      >
        <div className="flex items-center pl-3">
          {showSkeletonLoading ? renderSkeletonTabs() : renderActualTabs()}
        </div>

        <div className={separatorClasses} />

        <Button
          variant="ghost"
          size="sm"
          className={`${buttonBaseClasses} ${inactiveTextColor} min-w-fit hover:text-[rgba(255,255,255,0.95)]`}
          style={{ backgroundColor: darkerColor }}
          onClick={handleAddTable}
          title="Add table"
          disabled={createTableMutation.isPending}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>

        {contextMenu && (
          <TableContextMenu
            tableId={contextMenu.tableId}
            position={contextMenu.position}
            onRenameAction={handleShowRenameForm}
            onDeleteAction={handleDeleteTable}
            onCloseAction={handleCloseContextMenu}
            canDelete={canDeleteTable}
          />
        )}

        {renameForm && (
          <TableRenameForm
            initialName={renameForm.tableName}
            position={renameForm.position}
            onUpdateAction={handleRenameTableFromForm}
            onCloseAction={handleCloseRenameForm}
          />
        )}

        {isAddingTable && (
          <div
            ref={formRef}
            className="fixed z-50 rounded-md border border-gray-200 bg-white shadow-lg"
            style={{
              left: "200px",
              top: "90px",
              width: "320px",
              padding: "12px",
            }}
          >
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleCreateTable)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  rules={{
                    required: "Please enter a non-empty table name",
                    validate: (value) =>
                      value.trim() !== "" ||
                      "Please enter a non-empty table name",
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <input
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            const value = e.target.value;
                            persistFormState(true, value);
                          }}
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
                    onClick={handleCancelAdd}
                    className="text-[13px]"
                    disabled={createTableMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      !form.watch("name")?.trim() ||
                      createTableMutation.isPending
                    }
                    className="h-8 w-16 bg-blue-600 text-[13px] font-normal text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {"Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </div>

      {/* Extensions and Tools */}
      <div
        className="flex items-center"
        style={{ backgroundColor: darkerColor, borderTopLeftRadius: "6px" }}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-3 text-[13px] leading-[18px] font-normal text-[rgba(255,255,255,0.85)] hover:bg-transparent hover:text-[rgba(255,255,255,0.95)]"
        >
          Extensions
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-3 text-[13px] leading-[18px] font-normal text-[rgba(255,255,255,0.85)] hover:bg-transparent hover:text-[rgba(255,255,255,0.95)]"
        >
          Tools
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
