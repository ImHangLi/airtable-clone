export const CELL_CONFIG = {
  defaultWidth: 180,
  rowNumberWidth: 66,
  height: 32,
  padding: 4,
} as const;

export const baseCellStyle = {
  height: CELL_CONFIG.height,
  lineHeight: `${CELL_CONFIG.height}px`,
  padding: `0 ${CELL_CONFIG.padding}px`,
};

export const DROPDOWN_STYLE = {
  width: "240px",
  fontSize: "13px",
} as const;
