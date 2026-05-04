import type{ DerivedState, UnderlyingAggRow } from "../../../shared/types/derived";
import type{ RebalanceAnchorMode, RebalanceModeId, RebalanceTargetEntry } from "../../../shared/types/core";
import type { BetaHorizon } from "../beta/types";

// ── Multi-mode rebalance types ──

export type RebalanceModeConfig = {
  isPct: boolean;
  unit: string;
  label: string;
  shortLabel: string;
  formatValue: (v: number) => string;
};

// ── Mode configuration ──

function fmtNum(v: number, decimals: number): string {
  return Number.isFinite(v) ? v.toFixed(decimals) : "—";
}

export const REBALANCE_MODES: Record<RebalanceModeId, RebalanceModeConfig> = {
  deltaDollarPct: {
    isPct: true,
    unit: "%",
    label: "Delta $%",
    shortLabel: "Δ$%",
    formatValue: (v) => fmtNum(v, 1) + "%",
  },
  betaPct: {
    isPct: true,
    unit: "%",
    label: "Beta %",
    shortLabel: "β%",
    formatValue: (v) => fmtNum(v, 1) + "%",
  },
  shares: {
    isPct: false,
    unit: "sh",
    label: "Delta Shares",
    shortLabel: "ΔSh",
    formatValue: (v) => fmtNum(v, 0),
  },
  deltaDollar: {
    isPct: false,
    unit: "$",
    label: "Delta $",
    shortLabel: "ΔSh$",
    formatValue: (v) => "$" + fmtNum(v, 0),
  },
  gamma: {
    isPct: false,
    unit: "Γ",
    label: "Gamma",
    shortLabel: "Γ",
    formatValue: (v) => fmtNum(v, 4),
  },
  theta: {
    isPct: false,
    unit: "$/d",
    label: "Theta",
    shortLabel: "Θ",
    formatValue: (v) => "$" + fmtNum(v, 1),
  },
  vega: {
    isPct: false,
    unit: "$/v",
    label: "Vega",
    shortLabel: "V",
    formatValue: (v) => "$" + fmtNum(v, 1),
  },
};

// ── Helpers ──

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function finiteOr0(v: unknown): number {
  return isFiniteNum(v) ? v : 0;
}

// ── Mode value extraction ──

type ExtractCtx = {
  acctVal: number;
  betaData?: Map<string, any>;
  betaHorizon: BetaHorizon;
};

type ModeExtractor = (
  row: UnderlyingAggRow | undefined,
  key: string,
  ctx: ExtractCtx,
) => number;

const fieldExtractor =
  (field: keyof UnderlyingAggRow): ModeExtractor =>
  (row) =>
    finiteOr0(row?.[field]);

const MODE_EXTRACTORS: Record<RebalanceModeId, ModeExtractor> = {
  deltaDollarPct: (row, _key, ctx) => {
    const dn = row?.deltaNotionalDol ?? 0;
    return isFiniteNum(dn) ? (dn / ctx.acctVal) * 100 : 0;
  },
  betaPct: (row, key, ctx) => {
    const dn = row?.deltaNotionalDol ?? 0;
    const beta = ctx.betaData?.get(key)?.[ctx.betaHorizon]?.beta;
    const b = isFiniteNum(beta) ? beta : 1;
    const bn = isFiniteNum(dn) ? dn * b : 0;
    return (bn / ctx.acctVal) * 100;
  },
  shares: fieldExtractor("totalDeltaShares"),
  deltaDollar: fieldExtractor("deltaNotionalDol"),
  gamma: fieldExtractor("totalGammaSharesPerDol"),
  theta: fieldExtractor("totalThetaPerDay"),
  vega: fieldExtractor("totalVegaPerVolPoint"),
};

/**
 * Extract current per-underlying values for a given rebalance mode.
 * For percentage modes, values are 0-100 representing concentration %.
 * For absolute modes, values are the raw metric.
 */
export function extractModeCurrentValues(
  mode: RebalanceModeId,
  derived: DerivedState,
  betaData?: Map<string, any>,
  betaHorizon: BetaHorizon = "short",
): Map<string, number> {
  const byU = derived.byUnderlying ?? {};
  const ctx: ExtractCtx = {
    acctVal: Math.max(derived.portfolioAgg?.netMarketValue ?? 1, 1),
    betaData,
    betaHorizon,
  };
  const extract = MODE_EXTRACTORS[mode];
  const result = new Map<string, number>();
  for (const [key, row] of Object.entries(byU)) {
    result.set(key, extract(row, key, ctx));
  }
  return result;
}

// ── Linked target computation ──

export type LinkedTargetValues = Record<RebalanceAnchorMode, number>;

type LinkedCtx = {
  price: number;
  beta: number;
  acctVal: number;
};

function deriveFromDeltaDollar(
  deltaDollar: number,
  ctx: LinkedCtx,
): LinkedTargetValues {
  const shares = ctx.price > 0 ? deltaDollar / ctx.price : 0;
  const deltaDollarPct = (deltaDollar / ctx.acctVal) * 100;
  const betaPct = ((deltaDollar * ctx.beta) / ctx.acctVal) * 100;
  return { shares, deltaDollar, deltaDollarPct, betaPct };
}

const LINKED_TARGET_BUILDERS: Record<
  RebalanceAnchorMode,
  (entry: RebalanceTargetEntry, ctx: LinkedCtx) => LinkedTargetValues
> = {
  shares: (entry, ctx) => {
    const shares = entry.value;
    const deltaDollar = ctx.price > 0 ? shares * ctx.price : 0;
    return {
      ...deriveFromDeltaDollar(deltaDollar, ctx),
      shares,
    };
  },
  deltaDollar: (entry, ctx) => deriveFromDeltaDollar(entry.value, ctx),
  deltaDollarPct: (entry, ctx) => {
    const deltaDollar = (entry.value / 100) * ctx.acctVal;
    return {
      ...deriveFromDeltaDollar(deltaDollar, ctx),
      deltaDollarPct: entry.value,
    };
  },
  betaPct: (entry, ctx) => {
    const deltaDollar =
      Math.abs(ctx.beta) > 0.01 ? ((entry.value / 100) * ctx.acctVal) / ctx.beta : 0;
    return {
      ...deriveFromDeltaDollar(deltaDollar, ctx),
      betaPct: entry.value,
    };
  },
};

/**
 * Given a user-set anchor target for one exposure mode, derive all four
 * linked target values (shares, deltaDollar, deltaDollarPct, betaPct).
 *
 * Percentages are relative to account value (netMarketValue):
 *   deltaDollarPct = deltaDollar / accountValue × 100
 *   betaPct = (deltaDollar × beta) / accountValue × 100
 */
export function computeLinkedTargets(
  entry: RebalanceTargetEntry,
  underlyingPrice: number,
  beta: number,
  accountValue: number,
): LinkedTargetValues {
  const ctx: LinkedCtx = {
    price: isFiniteNum(underlyingPrice) && underlyingPrice > 0 ? underlyingPrice : 0,
    beta: isFiniteNum(beta) && Math.abs(beta) > 0.01 ? beta : 1,
    acctVal: Math.max(accountValue, 1),
  };
  return LINKED_TARGET_BUILDERS[entry.anchor](entry, ctx);
}
