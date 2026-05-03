import type{ HoldingsResponse } from "shared/types/holdings";
import { pctPointsToRatio } from "./numberParsers";
import { normalizeNumbersDeepInPlace } from "shared/utils/format/numberNormalizer";

function flattenParsedValuesDeepInPlace(obj: unknown): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const v = obj[i];
      if (isParsedValueWrapper(v)) {
        obj[i] = (v as any).parsedValue;
      } else {
        flattenParsedValuesDeepInPlace(v);
      }
    }
    return;
  }
  const record = obj as Record<string, unknown>;
  for (const k in record) {
    if (!Object.prototype.hasOwnProperty.call(record, k)) continue;
    const v = record[k];
    if (isParsedValueWrapper(v)) {
      record[k] = (v as any).parsedValue;
    } else {
      flattenParsedValuesDeepInPlace(v);
    }
  }
}

function isParsedValueWrapper(v: unknown): boolean {
  return (
    v != null &&
    typeof v === "object" &&
    "parsedValue" in (v as any) &&
    typeof (v as any).parsedValue === "number"
  );
}

const TOTAL_PERCENT_KEYS = [
  "dayChangePercent",
  "gainLossPercent",
  "percentageOfAccount",
  "pctOfAcct",
  "pctOfAccount",
  "totalDayChangePercent",
] as const;

function normalizeNumberCellPercentInPlace(cell: any): void {
  if (!cell || typeof cell !== "object") return;
  const ratio = pctPointsToRatio((cell as any).val);
  if (ratio == null) return;
  (cell as any).val = ratio;
}

function normalizeTotalsPercentFieldsInPlace(totals: any): void {
  if (!totals || typeof totals !== "object") return;
  for (const k of TOTAL_PERCENT_KEYS) {
    const ratio = pctPointsToRatio((totals as any)[k]);
    if (ratio == null) continue;
    (totals as any)[k] = ratio;
  }
}

function normalizeRowPercentFieldsInPlace(row: any): void {
  if (!row || typeof row !== "object") return;

  normalizeNumberCellPercentInPlace((row as any).priceChngPrc);
  normalizeNumberCellPercentInPlace((row as any).dayChngPerc);
  normalizeNumberCellPercentInPlace((row as any).pctOfAcct);

  const gl = (row as any).gainLoss;
  if (gl && typeof gl === "object") {
    const ratio = pctPointsToRatio((gl as any).gainLossPct);
    if (ratio != null) (gl as any).gainLossPct = ratio;
  }

  normalizeNumberCellPercentInPlace((row as any).dividendYield);
  normalizeNumberCellPercentInPlace((row as any).divYield);

  if (Array.isArray((row as any).childRows)) {
    for (const child of (row as any).childRows)
      normalizeRowPercentFieldsInPlace(child);
  }
}

function shouldNormalizeHoldingsPercentPoints(
  holdings: HoldingsResponse | null | undefined,
): boolean {
  if (!holdings) return false;

  // Schwab sometimes ships percent points instead of ratios for the same fields.
  const hasEvidence = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && Math.abs(v) > 1;

  for (const acct of (holdings as any).accounts ?? []) {
    const acctTotals = (acct as any).totals;
    if (acctTotals && hasEvidence((acctTotals as any).dayChangePercent))
      return true;
    if (acctTotals && hasEvidence((acctTotals as any).gainLossPercent))
      return true;
    if (acctTotals && hasEvidence((acctTotals as any).percentageOfAccount))
      return true;
    for (const group of (acct as any).groupedPositions ?? []) {
      const totals = (group as any).totals;
      if (totals && hasEvidence((totals as any).percentageOfAccount))
        return true;
      for (const row of (group as any).holdingsRows ?? []) {
        const p = (row as any).pctOfAcct;
        if (p && typeof p === "object" && hasEvidence((p as any).val))
          return true;
        const glPct = (row as any)?.gainLoss?.gainLossPct;
        if (hasEvidence(glPct)) return true;
        const prc = (row as any)?.priceChngPrc?.val;
        if (hasEvidence(prc)) return true;
        const day = (row as any)?.dayChngPerc?.val;
        if (hasEvidence(day)) return true;
      }
    }
  }

  return false;
}

export function parseHoldingsResponse(payload: unknown): HoldingsResponse {
  const holdings = payload as HoldingsResponse;

  flattenParsedValuesDeepInPlace(holdings);

  const shouldNormalizePct = shouldNormalizeHoldingsPercentPoints(holdings);

  if (shouldNormalizePct) {
    normalizeTotalsPercentFieldsInPlace((holdings as any).accountTotals);

    for (const acct of (holdings as any).accounts ?? []) {
      normalizeTotalsPercentFieldsInPlace((acct as any).totals);
      for (const group of (acct as any).groupedPositions ?? []) {
        normalizeTotalsPercentFieldsInPlace((group as any).totals);
        for (const row of (group as any).holdingsRows ?? []) {
          normalizeRowPercentFieldsInPlace(row);
        }
      }
    }
  }

  normalizeNumbersDeepInPlace(holdings, 6);

  return holdings;
}
