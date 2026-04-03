import type{ HoldingsRow } from "../../../../shared/types/holdings";

export type VirtualRowType = "group" | "data";

export interface VirtualRow {
  type: VirtualRowType;
  key: string;
  data?: HoldingsRow | null;
  name?: string;
  totals?: any;
  isChild?: boolean;
  isSummary?: boolean;
  parentSymbol?: string | null;
  underlyingKey?: string | null;
}

export function generateCellKey(rowKey: string, columnId: string): string {
  return `${rowKey}|${columnId}`;
}
