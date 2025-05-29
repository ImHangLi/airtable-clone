// Sorting configuration for table columns
export interface SortConfig {
  id: string;
  desc: boolean;
}

// Column highlighting configuration for visual feedback
export interface ColumnHighlight {
  columnId: string;
  type: "sort" | "search";
  color: string;
  priority?: number;
}
