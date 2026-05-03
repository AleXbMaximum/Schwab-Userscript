import type { HoldingsTableColumnId } from "../../../../shared/types/holdingsTableColumns";
import {
  isShareMasked,
  shareScaleValue,
  SHARE_MASKED_TEXT,
} from "shared/utils/domain/globalShareMode";
import { formatCurrency } from "./cellFormatters";
import { getVal } from "../utils/valueAccess";
import {
  DASH,
  OPTION_ONLY_COLUMNS,
  SUMMARY_ONLY_COLUMNS,
  SUMMARY_SUPPRESS_COLUMNS,
} from "./shared";

export const DISPLAY_SYMBOL_ALIASES: Record<string, string> = {
  "Futures Positions Market Value": "FMktV",
  "Futures Cash": "FCash",
};

/** Extracts the margin-requirement display string from a holdings row. */
export function computeMarginReqDisplay(
  d: any,
  derivedAny: any,
  isSummaryRow: boolean,
): string {
  const masked = isShareMasked();
  if (isSummaryRow) {
    const aggMargin =
      derivedAny?.totalMarginReqDol ?? derivedAny?.marginReqDol;
    if (aggMargin == null) return DASH;
    if (masked) return SHARE_MASKED_TEXT;
    return formatCurrency(shareScaleValue(aggMargin), { decimals: 2 });
  }
  if (derivedAny?.marginReqDol != null) {
    if (masked) return SHARE_MASKED_TEXT;
    return formatCurrency(shareScaleValue(derivedAny.marginReqDol), {
      decimals: 2,
    });
  }
  const rawMarginVal =
    getVal(d, "marginReq.val") ?? getVal(d, "marginRequirement.val");
  if (rawMarginVal != null && typeof rawMarginVal === "number") {
    if (masked) return SHARE_MASKED_TEXT;
    return formatCurrency(shareScaleValue(rawMarginVal), { decimals: 2 });
  }
  return DASH;
}

export type SummaryGreekTotals = {
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  marketValue: number | null;
  costBasis: number | null;
};

/**
 * Extracts pre-aggregated summary-row totals from derived metrics.
 * Returns nulls for non-summary rows.
 */
export function extractSummaryTotals(
  derivedAny: any,
  isSummaryRow: boolean,
): SummaryGreekTotals {
  if (!isSummaryRow) {
    return {
      delta: null,
      gamma: null,
      theta: null,
      vega: null,
      rho: null,
      marketValue: null,
      costBasis: null,
    };
  }
  return {
    delta: derivedAny?.totalDeltaShares ?? derivedAny?.deltaShares,
    gamma:
      derivedAny?.totalGammaByUnderlying ?? derivedAny?.totalGammaSharesPerDol,
    theta: derivedAny?.totalThetaByUnderlying ?? derivedAny?.totalThetaPerDay,
    vega: derivedAny?.totalVegaByUnderlying ?? derivedAny?.totalVegaPerVolPoint,
    rho: derivedAny?.totalRhoByUnderlying ?? derivedAny?.totalRhoPer1pctRate,
    marketValue: derivedAny?.totalMarketValue,
    costBasis: derivedAny?.totalCostBasis,
  };
}

/** Build the per-column gating helpers used by the row formatter. */
export function makeColumnGates(
  isSummaryRow: boolean,
  isOptionRow: boolean,
): {
  summaryOnly: (colId: HoldingsTableColumnId, value: string) => string;
  suppressOnSummary: (colId: HoldingsTableColumnId, value: string) => string;
  optionOnly: (colId: HoldingsTableColumnId, value: string) => string;
} {
  return {
    summaryOnly: (colId, value) =>
      !isSummaryRow && SUMMARY_ONLY_COLUMNS.has(colId) ? DASH : value,
    suppressOnSummary: (colId, value) =>
      isSummaryRow && SUMMARY_SUPPRESS_COLUMNS.has(colId) ? DASH : value,
    optionOnly: (colId, value) =>
      !isSummaryRow && !isOptionRow && OPTION_ONLY_COLUMNS.has(colId)
        ? DASH
        : value,
  };
}

/** Build the share-mode formatting helpers (pv, sv). */
export function makeShareModeHelpers(): {
  pv: (formatted: string) => string;
  sv: typeof shareScaleValue;
} {
  const masked = isShareMasked();
  return {
    pv: (formatted: string) => (masked ? SHARE_MASKED_TEXT : formatted),
    sv: shareScaleValue,
  };
}
