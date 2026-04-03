import type { HoldingsTableColumnId } from "../../../../shared/holdingsTableColumns";
import { toFiniteNumberOrNull as asNumberOrNull } from "../../../../backend/core/network/schwab/parsing/numberParsers";
import { formatNum, formatPct } from "shared/utils/formatters";

export const SUMMARY_ONLY_COLUMNS = new Set<HoldingsTableColumnId>([
  "carryToStress",
]);

export const OPTION_ONLY_COLUMNS = new Set<HoldingsTableColumnId>([
  "gammaSharesPerDol",
  "absGammaSharesPerDol",
  "thetaPerDay",
  "vegaPerVolPoint",
  "absVegaPerVolPoint",
  "rhoPer1pctRate",
  "gammaDensityNearTerm",
  "gammaDensityWeighted",
  "vegaConcentrationPct",
  "carryPerVega",
  "carryPerGamma",
  "vegaOnMargin",
  "gammaOnMargin",
  "thetaOnMargin",
  "thetaPerMargin",
  "vegaPerMargin",
]);

export const SUMMARY_SUPPRESS_COLUMNS = new Set<HoldingsTableColumnId>([
  "marginUsageRatioPct",
  "marginReqReason",
  "marginToUnderlyingNotional",
]);

export const DASH = "-";

export const formatIntOrDash = (val: unknown): string => {
  const n = asNumberOrNull(val);
  if (n == null || n === 0) return DASH;
  return Math.round(n).toLocaleString();
};

export const formatNumOrDash = (
  val: unknown,
  opts: { decimals?: number; showSign?: boolean } = {},
): string => {
  return (
    formatNum(val, {
      decimals: opts.decimals ?? 2,
      showSign: opts.showSign ?? false,
    }) || DASH
  );
};

export const formatGreek = (val: unknown): string => {
  const n = asNumberOrNull(val);
  if (n == null || Math.abs(n) >= 900) return DASH;
  return formatNumOrDash(n, { decimals: 4, showSign: true });
};

export const formatPctOrDash = (
  val: unknown,
  opts: { decimals?: number; showSign?: boolean } = {},
): string => {
  if (val == null) return DASH;
  const n = typeof val === "number" ? val : parseFloat(String(val));
  if (!Number.isFinite(n) || n === 0) return DASH;
  return formatPct(n, {
    decimals: opts.decimals ?? 2,
    showSign: opts.showSign ?? false,
  });
};
