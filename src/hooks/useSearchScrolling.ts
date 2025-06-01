import { useCallback, useEffect, useRef } from "react";
import type { SearchMatch } from "./useTableSearch";
import type { TableRow } from "./useTableData";
import type { Virtualizer } from "@tanstack/react-virtual";

interface UseSearchScrollingOptions {
  currentTargetMatch: SearchMatch | null;
  tableRows: TableRow[];
  parentRef: React.RefObject<HTMLDivElement>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  rowHeight: number;
}

export function useSearchScrolling({
  currentTargetMatch,
  tableRows,
  parentRef,
  rowVirtualizer,
  rowHeight,
}: UseSearchScrollingOptions) {
  const lastTargetMatchRef = useRef<SearchMatch | null>(null);

  const scrollToMatch = useCallback(
    (match: SearchMatch) => {
      if (!parentRef.current || !tableRows.length) return;

      // Find the row index in the table data
      const rowIndex = tableRows.findIndex((row) => row.id === match.rowId);
      if (rowIndex === -1) return;

      const container = parentRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerHeight = containerRect.height;

      // Get the current virtual items to check if the row is already visible
      const virtualItems = rowVirtualizer.getVirtualItems();
      const isRowVisible = virtualItems.some((item) => item.index === rowIndex);

      if (!isRowVisible) {
        // Row is not visible, scroll to it
        const targetScrollTop =
          rowIndex * rowHeight - containerHeight / 2 + rowHeight / 2;

        // Clamp the scroll position to valid bounds
        const maxScrollTop = rowVirtualizer.getTotalSize() - containerHeight;
        const clampedScrollTop = Math.max(
          0,
          Math.min(targetScrollTop, maxScrollTop),
        );

        container.scrollTo({
          top: clampedScrollTop,
          behavior: "smooth",
        });
      } else {
        // Row is visible, just ensure the specific cell is visible
        const rowElement = container.querySelector(
          `[data-cell-id="${match.rowId}-${match.columnId}"]`,
        );
        if (rowElement) {
          const cellRect = rowElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          // Check if cell is horizontally out of view
          const cellLeft = cellRect.left - containerRect.left;
          const cellRight = cellRect.right - containerRect.left;
          const containerWidth = containerRect.width;

          if (cellLeft < 0 || cellRight > containerWidth) {
            // Scroll horizontally to center the cell
            const targetScrollLeft =
              container.scrollLeft +
              cellLeft -
              containerWidth / 2 +
              cellRect.width / 2;
            container.scrollTo({
              left: Math.max(0, targetScrollLeft),
              behavior: "smooth",
            });
          }

          // Check if cell is vertically out of view
          const cellTop = cellRect.top - containerRect.top;
          const cellBottom = cellRect.bottom - containerRect.top;

          if (cellTop < 0 || cellBottom > containerHeight) {
            // Scroll vertically to center the cell
            const targetScrollTop =
              container.scrollTop +
              cellTop -
              containerHeight / 2 +
              cellRect.height / 2;
            const maxScrollTop =
              rowVirtualizer.getTotalSize() - containerHeight;
            const clampedScrollTop = Math.max(
              0,
              Math.min(targetScrollTop, maxScrollTop),
            );

            container.scrollTo({
              top: clampedScrollTop,
              behavior: "smooth",
            });
          }
        }
      }
    },
    [parentRef, tableRows, rowVirtualizer, rowHeight],
  );

  // Auto-scroll when target match changes
  useEffect(() => {
    if (
      currentTargetMatch &&
      currentTargetMatch !== lastTargetMatchRef.current
    ) {
      // Small delay to allow for DOM updates
      const timeoutId = setTimeout(() => {
        scrollToMatch(currentTargetMatch);
      }, 100);

      lastTargetMatchRef.current = currentTargetMatch;

      return () => clearTimeout(timeoutId);
    }
  }, [currentTargetMatch, scrollToMatch]);

  return { scrollToMatch };
}
