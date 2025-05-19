import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Color palette for the base
const BASE_COLORS = ["#0d7f78", "#8c3f78", "#9a455a", "#3b66a3", "#3b66a3"];
type BaseColor = (typeof BASE_COLORS)[number];

export function getColorFromBaseId(baseId: string): BaseColor {
  // Use the baseId to deterministically select a color
  // This hash function works on both client and server
  const hashCode = baseId.split("").reduce((acc, char) => {
    return (acc << 5) - acc + char.charCodeAt(0);
  }, 0);

  // Use the absolute value of hash to select a color
  const colorIndex = Math.abs(hashCode) % BASE_COLORS.length;
  return BASE_COLORS[colorIndex]!;
}
