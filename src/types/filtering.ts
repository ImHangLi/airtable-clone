// Types for table filtering functionality

export interface FilterPreference {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: string;
  order: number;
  logicalOperator?: "and" | "or"; // Logical operator to combine with previous filter
}

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty";

export type LogicalOperator = "and" | "or";

// Helper function to get available operators for a column type
export function getAvailableOperators(
  columnType: "text" | "number",
): FilterOperator[] {
  if (columnType === "text") {
    return [
      "contains",
      "not_contains",
      "equals",
      "not_equals",
      "is_empty",
      "is_not_empty",
    ];
  } else {
    return [
      "equals",
      "not_equals",
      "greater_than",
      "less_than",
      "is_empty",
      "is_not_empty",
    ];
  }
}

// Helper function to format operator display names
export function formatOperatorName(operator: FilterOperator): string {
  const operatorNames: Record<FilterOperator, string> = {
    equals: "equal to",
    not_equals: "not equal to",
    contains: "contains",
    not_contains: "not contains",
    greater_than: "greater than",
    less_than: "less than",
    is_empty: "is empty",
    is_not_empty: "is not empty",
  };

  return operatorNames[operator];
}

// Helper function to check if operator requires a value input
export function operatorRequiresValue(operator: FilterOperator): boolean {
  return !["is_empty", "is_not_empty"].includes(operator);
}
