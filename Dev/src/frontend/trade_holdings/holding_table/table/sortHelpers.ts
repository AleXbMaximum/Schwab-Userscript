import type { HoldingsTableColumnId } from "../../../../shared/holdingsTableColumns";
import type { RowRenderData } from "../types";

const parseDisplayForSort = (
  val: string | undefined,
): string | number | null => {
  if (!val || val === "-" || val === "\u2014") return null;

  const cleaned = val.replace(/[$%,()±\s]/g, "");
  const num = parseFloat(cleaned);
  if (Number.isFinite(num)) return num;
  return val;
};

export const sortTickerBlocks = (
  tickers: any[],
  sortState: { colId: HoldingsTableColumnId | null; asc: boolean },
  summaryMap: Map<string, RowRenderData>,
): any[] => {
  const colId = sortState.colId;
  if (!colId) return tickers;

  return [...tickers].sort((a, b) => {
    const rowA = summaryMap.get(a.underlyingKey);
    const rowB = summaryMap.get(b.underlyingKey);
    const va = parseDisplayForSort(rowA?.values.get(colId));
    const vb = parseDisplayForSort(rowB?.values.get(colId));

    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;

    if (typeof va === "string" && typeof vb === "string") {
      return sortState.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    }

    const na = typeof va === "number" ? va : 0;
    const nb = typeof vb === "number" ? vb : 0;
    return sortState.asc ? na - nb : nb - na;
  });
};
