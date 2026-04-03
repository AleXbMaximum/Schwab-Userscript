import type{ DerivedState } from "../../../shared/types/derived";
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
  const result = new Map<string, number>();

  switch (mode) {
    case "deltaDollarPct": {
      const acctVal = Math.max(derived.portfolioAgg?.netMarketValue ?? 1, 1);
      for (const [key, row] of Object.entries(byU)) {
        const dn = row?.deltaNotionalDol ?? 0;
        result.set(key, isFiniteNum(dn) ? (dn / acctVal) * 100 : 0);
      }
      break;
    }
    case "betaPct": {
      const acctVal = Math.max(derived.portfolioAgg?.netMarketValue ?? 1, 1);
      for (const [key, row] of Object.entries(byU)) {
        const dn = row?.deltaNotionalDol ?? 0;
        const beta = betaData?.get(key)?.[betaHorizon]?.beta;
        const b = isFiniteNum(beta) ? beta : 1;
        const bn = isFiniteNum(dn) ? dn * b : 0;
        result.set(key, (bn / acctVal) * 100);
      }
      break;
    }
    case "shares": {
      for (const [key, row] of Object.entries(byU)) {
        const v = row?.totalDeltaShares ?? 0;
        result.set(key, isFiniteNum(v) ? v : 0);
      }
      break;
    }
    case "deltaDollar": {
      for (const [key, row] of Object.entries(byU)) {
        const v = row?.deltaNotionalDol ?? 0;
        result.set(key, isFiniteNum(v) ? v : 0);
      }
      break;
    }
    case "gamma": {
      for (const [key, row] of Object.entries(byU)) {
        const v = row?.totalGammaSharesPerDol ?? 0;
        result.set(key, isFiniteNum(v) ? v : 0);
      }
      break;
    }
    case "theta": {
      for (const [key, row] of Object.entries(byU)) {
        const v = row?.totalThetaPerDay ?? 0;
        result.set(key, isFiniteNum(v) ? v : 0);
      }
      break;
    }
    case "vega": {
      for (const [key, row] of Object.entries(byU)) {
        const v = row?.totalVegaPerVolPoint ?? 0;
        result.set(key, isFiniteNum(v) ? v : 0);
      }
      break;
    }
  }

  return result;
}

// ── Linked target computation ──

export type LinkedTargetValues = Record<RebalanceAnchorMode, number>;

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
  const price =
    isFiniteNum(underlyingPrice) && underlyingPrice > 0 ? underlyingPrice : 0;
  const b = isFiniteNum(beta) && Math.abs(beta) > 0.01 ? beta : 1;
  const acctVal = Math.max(accountValue, 1);

  let shares = 0;
  let deltaDollar = 0;
  let deltaDollarPct = 0;
  let betaPct = 0;

  switch (entry.anchor) {
    case "shares":
      shares = entry.value;
      deltaDollar = price > 0 ? shares * price : 0;
      deltaDollarPct = (deltaDollar / acctVal) * 100;
      betaPct = ((deltaDollar * b) / acctVal) * 100;
      break;

    case "deltaDollar":
      deltaDollar = entry.value;
      shares = price > 0 ? deltaDollar / price : 0;
      deltaDollarPct = (deltaDollar / acctVal) * 100;
      betaPct = ((deltaDollar * b) / acctVal) * 100;
      break;

    case "deltaDollarPct":
      deltaDollarPct = entry.value;
      deltaDollar = (deltaDollarPct / 100) * acctVal;
      shares = price > 0 ? deltaDollar / price : 0;
      betaPct = ((deltaDollar * b) / acctVal) * 100;
      break;

    case "betaPct":
      betaPct = entry.value;
      deltaDollar = Math.abs(b) > 0.01 ? ((betaPct / 100) * acctVal) / b : 0;
      shares = price > 0 ? deltaDollar / price : 0;
      deltaDollarPct = (deltaDollar / acctVal) * 100;
      break;
  }

  return { shares, deltaDollar, deltaDollarPct, betaPct };
}
