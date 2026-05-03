// GEX-specific matrix selection and value formatting.

import { formatCompactDollar } from "shared/utils/format/formatters";
import type { GexHeatmapData } from "../../types";

export type GexType = "net" | "call" | "put";

export function selectGexMatrix(
  data: GexHeatmapData,
  type: GexType,
): number[][] {
  switch (type) {
    case "call":
      return data.callMatrix;
    case "put":
      return data.putMatrix;
    default:
      return data.netMatrix;
  }
}

export function formatCompactValue(value: number): string {
  return formatCompactDollar(value, { sign: true, dollar: false });
}

export function formatScaleValue(value: number): string {
  if (!isFinite(value)) return "--";
  const absValue = Math.abs(value);
  if (absValue >= 1_000) return formatCompactValue(value);
  if (absValue >= 100) return `${value >= 0 ? "+" : ""}${value.toFixed(0)}`;
  if (absValue >= 10) return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}
