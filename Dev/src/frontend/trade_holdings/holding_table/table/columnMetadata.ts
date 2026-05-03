import type { HoldingsTableColumnId } from "../../../../shared/types/holdingsTableColumns";
import { HOLDINGS_TABLE_COLUMNS } from "../../../../shared/types/holdingsTableColumns";

const BASE_COLUMNS = HOLDINGS_TABLE_COLUMNS;
export const BASE_COL_LABELS = BASE_COLUMNS.map((c) => c.label);
export const BASE_INDEX_BY_ID = new Map<HoldingsTableColumnId, number>(
  BASE_COLUMNS.map((c, idx) => [c.id, idx]),
);

export const NUMERIC_FLASH_COLUMNS = new Set<HoldingsTableColumnId>([
  "price",
  "bid",
  "ask",
  "bidSize",
  "askSize",
  "last",
  "lastSize",
  "open",
  "priceChngPct",
  "priceChngDol",
  "dayChngPct",
  "dayChngDol",
  "gainLossDol",
  "gainLossPct",
  "marketValue",
  "volume",
  "delta",
  "gamma",
  "theta",
  "vega",
  "rho",
  "openInterest",

  "mid",
  "spreadDol",
  "spreadPct",
  "quoteImbalance",
  "dayRangeDol",
  "dayRangePct",
  "deltaShares",
  "gammaSharesPerDol",
  "absGammaSharesPerDol",
  "thetaPerDay",
  "vegaPerVolPoint",
  "absVegaPerVolPoint",
  "rhoPer1pctRate",
  "marginUsageRatioPct",
  "deltaSharesPerMargin",
  "deltaNotionalPerMargin",
  "thetaPerMargin",
  "vegaPerMargin",
  "thetaOnMargin",
  "vegaOnMargin",
  "gammaOnMargin",
  "carryPerVega",
  "carryPerGamma",
  "carryToStress",
  "marginToUnderlyingNotional",
  "deltaNotionalDol",
  "deltaNotionalConcentrationPct",
  "betaNotionalDol",
  "betaNotionalConcentrationPct",
  "vegaConcentrationPct",
  "gammaDensityNearTerm",
  "gammaDensityWeighted",
  "pnlUp1PctDol",
  "pnlDn1PctDol",
  "convexityDol",
  "dte",
  "strike",
  "overnightPrice",
  "overnightChgDol",
  "overnightChgPct",
  "afterHoursPrice",
]);

export const SIGN_COLOR_COLUMNS = new Set<HoldingsTableColumnId>([
  "priceChngPct",
  "priceChngDol",
  "dayChngPct",
  "dayChngDol",
  "gainLossDol",
  "gainLossPct",

  "pnlUp1PctDol",
  "pnlDn1PctDol",
  "deltaNotionalDol",
  "betaNotionalDol",
  "convexityDol",

  "overnightChgDol",
  "overnightChgPct",
  "postMarketChg",
  "postMarketChgPct",
]);

export const INVERT_FOR_SHORT_COLUMNS = new Set<HoldingsTableColumnId>([
  "priceChngPct",
  "priceChngDol",
]);

/**
 * Columns whose color should be inverted on **summary** rows when the underlying
 * is net-short. Summary `dayChngPct` and `gainLossPercent` are computed percentages
 * whose denominator turns negative for short positions, flipping the sign
 * relative to actual profitability.
 */
export const INVERT_FOR_SHORT_SUMMARY_COLUMNS = new Set<HoldingsTableColumnId>([
  "dayChngPct",
  "gainLossPct",
]);

export const DERIVED_HEADER_COLUMNS = new Set<HoldingsTableColumnId>([
  "mid",
  "spreadDol",
  "spreadPct",
  "quoteImbalance",
  "dayRangeDol",
  "dayRangePct",

  "deltaShares",
  "gammaSharesPerDol",
  "absGammaSharesPerDol",
  "thetaPerDay",
  "vegaPerVolPoint",
  "absVegaPerVolPoint",
  "rhoPer1pctRate",

  "marginUsageRatioPct",
  "deltaSharesPerMargin",
  "deltaNotionalPerMargin",
  "thetaPerMargin",
  "vegaPerMargin",
  "thetaOnMargin",
  "vegaOnMargin",
  "gammaOnMargin",
  "carryPerVega",
  "carryPerGamma",
  "carryToStress",
  "marginReqReason",
  "marginToUnderlyingNotional",
  "deltaNotionalDol",
  "deltaNotionalConcentrationPct",
  "betaNotionalDol",
  "betaNotionalConcentrationPct",
  "vegaConcentrationPct",
  "gammaDensityNearTerm",
  "gammaDensityWeighted",

  "pnlUp1PctDol",
  "pnlDn1PctDol",
  "convexityDol",

  "underlying",
  "expDate",
  "dte",
  "strike",
  "callPut",
  "rowType",
  "priceLow52W",
  "priceHigh52W",
  "overnightPrice",
  "overnightChgDol",
  "overnightChgPct",
  "afterHoursPrice",
  "postMarketChg",
  "postMarketChgPct",
  "warnings",
]);
