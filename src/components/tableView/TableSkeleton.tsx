export function TableSkeleton() {
  const CELL_CONFIG = {
    defaultWidth: 180,
    rowNumberWidth: 66,
    height: 32,
  };

  const baseCellStyle = {
    height: CELL_CONFIG.height,
    lineHeight: `${CELL_CONFIG.height}px`,
    padding: "0 4px",
    boxSizing: "border-box" as const,
  };

  const getCellWidth = (isRowNumber = false) => ({
    width: isRowNumber ? CELL_CONFIG.rowNumberWidth : CELL_CONFIG.defaultWidth,
    minWidth: isRowNumber
      ? CELL_CONFIG.rowNumberWidth
      : CELL_CONFIG.defaultWidth,
    maxWidth: isRowNumber
      ? CELL_CONFIG.rowNumberWidth
      : CELL_CONFIG.defaultWidth,
  });

  // Mock 4 columns (1 row number + 3 data columns)
  const columnCount = 4;
  const totalColumnWidth =
    CELL_CONFIG.rowNumberWidth + (columnCount - 1) * CELL_CONFIG.defaultWidth;

  // Fixed widths for skeleton bars to prevent hydration errors
  const skeletonWidths = [
    "60%",
    "45%",
    "75%",
    "50%",
    "65%",
    "40%",
    "70%",
    "55%",
    "80%",
    "35%",
    "60%",
    "50%",
    "65%",
    "45%",
    "70%",
    "55%",
    "40%",
    "75%",
    "60%",
  ];

  return (
    <div className="relative animate-pulse flex-1 overflow-hidden bg-gray-50">
      <div className="h-full overflow-auto">
        <div
          style={{
            width: totalColumnWidth,
            minHeight: "100%",
          }}
        >
          {/* Header Skeleton */}
          <div
            className="sticky top-0 z-10 bg-gray-100 shadow-sm"
            style={{
              borderBottom: "1px solid #cccccc",
            }}
          >
            <div className="flex">
              {Array.from({ length: columnCount }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center text-left font-normal"
                  style={{
                    ...baseCellStyle,
                    ...getCellWidth(index === 0),
                    borderRight: "1px solid #cccccc",
                  }}
                >
                  <div className="w-full text-[13px]">
                    {index === 0 ? (
                      // Row number header (empty)
                      <div className="h-4 w-4"></div>
                    ) : (
                      // Column header skeleton
                      <div className="h-4 w-20 animate-pulse rounded bg-gray-300"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Table Body Skeleton */}
          <div>
            {Array.from({ length: 19 }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="w-full hover:bg-gray-100"
                style={{
                  height: `${CELL_CONFIG.height}px`,
                  width: totalColumnWidth,
                  borderBottom: "1px solid #cccccc",
                }}
              >
                <div className="flex">
                  {Array.from({ length: columnCount }).map((_, cellIndex) => (
                    <div
                      key={cellIndex}
                      className="relative flex items-center"
                      style={{
                        ...baseCellStyle,
                        ...getCellWidth(cellIndex === 0),
                        borderRight: "1px solid #cccccc",
                      }}
                    >
                      {cellIndex === 0 ? (
                        // Row number skeleton
                        <div className="h-4 w-6 animate-pulse rounded bg-gray-200"></div>
                      ) : (
                        // Cell content skeleton with fixed width
                        <div
                          className="h-4 animate-pulse rounded bg-gray-200"
                          style={{
                            width:
                              skeletonWidths[rowIndex % skeletonWidths.length],
                          }}
                        ></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
