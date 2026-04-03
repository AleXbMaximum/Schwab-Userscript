// ── Shared value extraction helpers ─────────────────────────────────────────
// Extract typed numeric values from raw holdings row objects.
// These guard-and-extract functions are used by PortfolioAggregator,
// UnderlyingAggregator, and hierarchyRowBuilders to avoid duplication.

import { isFiniteNumber } from "../../../shared/utils/math/guards";

/** Extract the underlying/last price from a holdings row. */
export function extractPrice(row: any): number | null {
  const candidatePrice =
    row?.lastPrice?.val ?? row?.price?.price ?? row?.price?.val;
  return isFiniteNumber(candidatePrice) ? candidatePrice : null;
}

/** Extract the day-change dollar value from a holdings row. */
export function extractDayChange(row: any): number | null {
  const val = row?.dayChange?.val;
  return isFiniteNumber(val) ? val : null;
}

/** Extract the gain/loss dollar value from a holdings row. */
export function extractGainLoss(row: any): number | null {
  const val = row?.gainLoss?.gainLossDlr ?? row?.gainLoss?.val;
  return isFiniteNumber(val) ? val : null;
}

/** Extract the cost basis value from a holdings row. */
export function extractCostBasis(row: any): number | null {
  const val = row?.costBasis?.cstBasis ?? row?.costBasis?.val;
  return isFiniteNumber(val) ? val : null;
}

/** Extract the market value from a holdings row. */
export function extractMarketValue(row: any): number | null {
  const val = row?.marketValue?.val;
  return isFiniteNumber(val) ? val : null;
}

/** Extract the quantity from a holdings row. */
export function extractQty(row: any): number | null {
  const qty = row?.qty?.qty ?? row?.qty?.val;
  return typeof qty === "number" ? qty : null;
}
