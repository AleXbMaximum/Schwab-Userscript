import type{ HoldingsResponse, HoldingsRow } from "../../../shared/types/holdings";
import type{ HoldingsKey } from "../../../shared/types/derived";
import type { HoldingsIndexEntry } from "./HoldingsIndexBuilder";
import { getHoldingsKey } from "../../../shared/utils/domain/holdingsKeys";
import { MARKET_DATA_FIELDS } from "./FieldMergePolicy";

export function normalizeHoldings(
  newHoldings: HoldingsResponse,
  oldHoldings: HoldingsResponse | null,
  buildHoldingsIndex: (h: HoldingsResponse) => Map<string, HoldingsIndexEntry>,
): HoldingsResponse {
  if (!oldHoldings) return newHoldings;

  const oldIndex = buildHoldingsIndex(oldHoldings);
  const oldRowMap = new Map<HoldingsKey, HoldingsRow>();
  for (const [k, entry] of oldIndex.entries()) {
    oldRowMap.set(k, entry.row);
  }

  const accounts = newHoldings?.accounts ?? [];
  for (const account of accounts) {
    const groups = account?.groupedPositions ?? [];
    for (const group of groups) {
      const rows = group?.holdingsRows ?? [];
      for (const row of rows) {
        normalizeRow(row, oldRowMap);
        if (row?.childRows) {
          for (const child of row.childRows) {
            normalizeRow(child, oldRowMap);
          }
        }
      }
    }
  }

  return newHoldings;
}

function normalizeRow(
  row: HoldingsRow,
  oldRowMap: Map<HoldingsKey, HoldingsRow>,
): void {
  const pk = getHoldingsKey(row);
  if (!pk) return;
  const oldRow = oldRowMap.get(pk);
  if (!oldRow) return;

  backfillSentinelFields(
    row as unknown as Record<string, unknown>,
    oldRow as unknown as Record<string, unknown>,
  );
  carryForwardMarketData(row, oldRow);
}

function carryForwardMarketData(row: HoldingsRow, oldRow: HoldingsRow): void {
  for (const field of MARKET_DATA_FIELDS) {
    const oldVal = (oldRow as any)[field];
    const newVal = (row as any)[field];

    if (oldVal != null && typeof oldVal === "object" && oldVal.val != null) {
      if (newVal == null || typeof newVal !== "object" || newVal.val == null) {
        (row as any)[field] = { ...oldVal };
      }
    }
  }
}

function backfillSentinelFields(
  current: Record<string, unknown>,
  previous: Record<string, unknown> | undefined,
): void {
  for (const key of Object.keys(current)) {
    const cur = current[key];
    const prev = previous ? (previous as any)[key] : undefined;

    if (!cur || typeof cur !== "object") continue;

    if (Object.prototype.hasOwnProperty.call(cur, "val")) {
      const curVal = (cur as any).val;
      if (typeof curVal === "number" && curVal === -999) {
        const prevVal =
          prev && typeof prev === "object" ? (prev as any).val : undefined;
        if (typeof prevVal === "number" && prevVal !== -999) {
          (cur as any).val = prevVal;
        }
      }
      continue;
    }

    backfillSentinelFields(
      cur as Record<string, unknown>,
      prev as Record<string, unknown> | undefined,
    );
  }
}
