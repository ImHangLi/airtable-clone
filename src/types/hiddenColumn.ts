export function isColumnVisible(
  columnId: string,
  hiddenColumns: string[] = [],
): boolean {
  return !hiddenColumns.includes(columnId);
}

export function toggleHiddenColumn(
  columnId: string,
  hiddenColumns: string[] = [],
): string[] {
  const isCurrentlyHidden = hiddenColumns.includes(columnId);

  if (isCurrentlyHidden) {
    return hiddenColumns.filter((id) => id !== columnId);
  } else {
    return [...hiddenColumns, columnId];
  }
}

export function showAllColumns(): string[] {
  return [];
}

export function getVisibleColumns<T extends { id: string }>(
  allColumns: T[],
  hiddenColumns: string[] = [],
): T[] {
  return allColumns.filter((column) => !hiddenColumns.includes(column.id));
}
