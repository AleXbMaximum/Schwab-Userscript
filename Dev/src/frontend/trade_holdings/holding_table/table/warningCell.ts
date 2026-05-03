import type{ HoldingsRow } from "shared/types/holdings";
import type{ WarningCell } from "shared/types/derived";
import {
  getHoldingsKey,
  getUnderlyingKey,
} from "../../../../shared/utils/domain/holdingsKeys";
import type { TableUpdateContext } from "../types";

export const getWarningCell = (
  row: HoldingsRow,
  parentEquitySymbol: string | null,
  ctx: TableUpdateContext | undefined,
): WarningCell | null => {
  const warnings = ctx?.warnings ?? null;
  if (!warnings) return null;

  const pk = getHoldingsKey(row);
  const posCell = (warnings as any).byHoldingsKey?.[pk] ?? null;
  if (posCell && posCell.level && posCell.level !== "none") return posCell;

  const uk = getUnderlyingKey(row, parentEquitySymbol);
  const underCell = uk ? ((warnings as any).byUnderlying?.[uk] ?? null) : null;
  return underCell ?? posCell;
};
