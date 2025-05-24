import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Color palette for the base
const BASE_COLORS = [
  "#0d7f78",
  "#8c3f78",
  "#9a455a",
  "#3b66a3",
  "#535965",
  "#a26811",
  "#117da3",
];

const DARKER_COLORS = [
  "#0d726c",
  "#7e386b",
  "#893e51",
  "#355c92",
  "#4a505b",
  "#915e10",
  "#117092",
];
type BaseColor = (typeof BASE_COLORS)[number];
type DarkerColor = (typeof DARKER_COLORS)[number];

const getColorIndexFromId = (id: string): number => {
  const hashCode = id
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hashCode % BASE_COLORS.length;
};

export function getColorFromBaseId(baseId: string): BaseColor {
  const colorIndex = getColorIndexFromId(baseId);
  return BASE_COLORS[colorIndex]!;
}

export function getDarkerColorFromBaseId(baseId: string): DarkerColor {
  const colorIndex = getColorIndexFromId(baseId);
  return DARKER_COLORS[colorIndex]!;
}
