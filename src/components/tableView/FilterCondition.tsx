import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { TableColumn } from "~/hooks/useTableData";
import type { FilterConfig } from "~/types/filtering";
import {
  getAvailableOperators,
  formatOperatorName,
  operatorRequiresValue,
} from "~/types/filtering";

interface FilterConditionProps {
  filter: FilterConfig;
  index: number;
  columns: TableColumn[];
  inputValue: string;
  onChangeColumn: (filterId: string, columnId: string) => void;
  onChangeOperator: (
    filterId: string,
    operator: FilterConfig["operator"],
  ) => void;
  onChangeLogicalOperator: (
    filterId: string,
    logicalOperator: "and" | "or",
  ) => void;
  onChangeValue: (filterId: string, value: string) => void;
  onRemove: (filterId: string) => void;
}

export function FilterCondition({
  filter,
  index,
  columns,
  inputValue,
  onChangeColumn,
  onChangeOperator,
  onChangeLogicalOperator,
  onChangeValue,
  onRemove,
}: FilterConditionProps) {
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [operatorSelectorOpen, setOperatorSelectorOpen] = useState(false);
  const [logicalOperatorOpen, setLogicalOperatorOpen] = useState(false);

  const column = columns.find((col) => col.id === filter.columnId);
  if (!column) return null;

  const availableOperators = getAvailableOperators(column.type);

  const handleColumnChange = (columnId: string) => {
    onChangeColumn(filter.id, columnId);
    setColumnSelectorOpen(false);
  };

  const handleOperatorChange = (operator: FilterConfig["operator"]) => {
    onChangeOperator(filter.id, operator);
    setOperatorSelectorOpen(false);
  };

  const handleLogicalOperatorChange = (logicalOperator: "and" | "or") => {
    onChangeLogicalOperator(filter.id, logicalOperator);
    setLogicalOperatorOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Logical Operator Section */}
      {index === 0 ? (
        <div className="flex h-8 w-1/4 items-center justify-center rounded-xs text-[13px] font-light">
          Where
        </div>
      ) : index === 1 ? (
        // Only the second filter gets a dropdown for logical operator
        <Popover
          open={logicalOperatorOpen}
          onOpenChange={setLogicalOperatorOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-[24.5%] justify-center gap-1 rounded-xs border border-gray-200 text-[13px] font-light hover:bg-gray-50"
            >
              {filter.logicalOperator ?? "and"}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[80px] p-1">
            <div className="space-y-1">
              <button
                onClick={() => handleLogicalOperatorChange("and")}
                className="flex h-7 w-full items-center rounded-sm px-2 text-[13px] font-light hover:bg-gray-100"
              >
                and
              </button>
              <button
                onClick={() => handleLogicalOperatorChange("or")}
                className="flex h-7 w-full items-center rounded-sm px-2 text-[13px] font-light hover:bg-gray-100"
              >
                or
              </button>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        // All other filters just show the logical operator as text
        <div className="flex h-8 w-1/4 items-center justify-center rounded-xs text-[13px] font-light">
          {filter.logicalOperator ?? "and"}
        </div>
      )}

      {/* Column Selector */}
      <Popover open={columnSelectorOpen} onOpenChange={setColumnSelectorOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-1/4 justify-between gap-2 rounded-xs border border-gray-200 text-[13px] font-light"
          >
            <div className="flex items-center gap-2">
              <span>{column.name}</span>
            </div>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[190px] p-1">
          <div className="space-y-1">
            {columns.map((col) => (
              <button
                key={col.id}
                onClick={() => handleColumnChange(col.id)}
                className="flex h-7 w-full items-center justify-between rounded-sm px-2 text-[13px] font-light hover:bg-gray-100"
              >
                <span>{col.name}</span>
                <span className="ml-2 text-[13px] font-light text-gray-400">
                  {col.type}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Operator Selector */}
      <Popover
        open={operatorSelectorOpen}
        onOpenChange={setOperatorSelectorOpen}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-1/4 justify-between gap-2 rounded-xs border border-gray-200 text-[13px] font-light"
          >
            {formatOperatorName(filter.operator)}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[190px] p-1">
          <div className="space-y-1">
            {availableOperators.map((op) => (
              <button
                key={op}
                onClick={() => handleOperatorChange(op)}
                className="flex h-7 w-full items-center rounded-sm px-2 text-[13px] font-light hover:bg-gray-100"
              >
                {formatOperatorName(op)}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Value Input - only show if operator requires a value */}
      {operatorRequiresValue(filter.operator) ? (
        <Input
          value={inputValue}
          onChange={(e) => onChangeValue(filter.id, e.target.value)}
          placeholder="Enter a value"
          type={column.type === "number" ? "number" : "text"}
          className="h-8 w-1/4 rounded-xs border border-gray-200 text-[13px] font-light"
        />
      ) : (
        // Empty placeholder to maintain layout when no input is needed
        <div className="w-1/4"></div>
      )}

      {/* Remove Filter Button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 rounded-xs border border-gray-200 p-0 text-gray-400 hover:bg-gray-50"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(filter.id);
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
