import type{ DerivedState } from "../../../../shared/types/derived";
import type{ QuoteItem } from "../../../../shared/types/holdings";
import type{
  RebalanceAnchorMode,
  RebalanceModeId,
  RebalanceProfile,
  RebalanceTargets,
  TargetAllocations,
} from "../../../../shared/types/core";
import type { LinkedTargetValues } from "../../../../backend/computation/rebalance/RebalanceCalculator";
import {
  extractModeCurrentValues,
  computeLinkedTargets,
} from "../../../../backend/computation/rebalance/RebalanceCalculator";
import { DS_COLORS, DS_COMPONENTS } from "../../../components/core/theme";
import type { BetaHorizon } from "../../../../backend/computation/beta/types";

// ── Types ──

export type Payload = {
  derived: DerivedState;
  quoteBySymbol?: Record<string, QuoteItem>;
  targetAllocations?: TargetAllocations;
  rebalanceTargets?: RebalanceTargets;
  rebalanceProfiles?: RebalanceProfile[];
  betaData?: Map<string, any>;
  etfUnderlyingKeys?: Set<string>;
  extraBetaTickers?: string[];
  onUpdateTargetAllocations?: (next: TargetAllocations) => void;
  onUpdateRebalanceTargets?: (next: RebalanceTargets) => void;
  onUpdateRebalanceProfiles?: (next: RebalanceProfile[]) => void;
  onAddTicker?: (symbol: string) => void;
  onRemoveTicker?: (symbol: string) => void;
  onRecalculate?: () => void;
  showTradeSuggestions?: boolean;
};

export type SortKey =
  | "underlying"
  | "_beta"
  | RebalanceModeId
  | `tgt:${RebalanceAnchorMode}`
  | `dev:${RebalanceAnchorMode}`;

// ── Constants ──

export const BETA_HORIZONS: { key: BetaHorizon; label: string }[] = [
  { key: "ultraShort", label: "1D" },
  { key: "week", label: "1W" },
  { key: "short", label: "1M" },
  { key: "medium", label: "6M" },
  { key: "long", label: "2Y" },
];

export const CURRENT_MODES: RebalanceModeId[] = [
  "shares",
  "deltaDollar",
  "deltaDollarPct",
  "betaPct",
  "gamma",
  "theta",
  "vega",
];
export const TARGET_MODES: RebalanceAnchorMode[] = [
  "shares",
  "deltaDollar",
  "deltaDollarPct",
  "betaPct",
];
export const DEVIATION_MODES: RebalanceAnchorMode[] = [
  "shares",
  "deltaDollar",
  "deltaDollarPct",
  "betaPct",
];
export const METRIC_GROUPS: RebalanceAnchorMode[] = [
  "shares",
  "deltaDollar",
  "deltaDollarPct",
  "betaPct",
];
export const GREEK_MODES: RebalanceModeId[] = ["gamma", "theta", "vega"];
/** Modes that are multiplied in "magnified" share mode (absolute-value modes only). */
export const MAGNIFIED_MODES = new Set<RebalanceModeId>([
  "shares",
  "deltaDollar",
  "theta",
  "vega",
]);
export const PRIVACY_HIDDEN_METRICS = new Set<RebalanceAnchorMode>([
  "shares",
  "deltaDollar",
]);
export const PRIVACY_HIDDEN_GREEKS = new Set<RebalanceModeId>([
  "theta",
  "vega",
]);
export const TARGET_MODE_SET = new Set<RebalanceAnchorMode>(TARGET_MODES);
export const MODE_WEIGHT: Partial<Record<RebalanceModeId, number>> = {
  shares: 1.0,
  deltaDollar: 0.97,
  deltaDollarPct: 0.95,
  betaPct: 0.75,
};
export const MAX_SUGGESTION_ROWS = 10;
export const MIN_SCORE = 0.015;
export const MAX_REBALANCE_PROFILES = 60;

// ── Shared styles ──

export const thStyle = DS_COMPONENTS.tableHeader;
export const tdStyle =
  DS_COMPONENTS.tableCell + " font-variant-numeric: tabular-nums;";
export const tableStyle = DS_COMPONENTS.table;
export const cellInputStyle =
  "padding:1px 3px; font-size:var(--ax-fs-md); border:1px solid var(--ax-border); border-radius:3px;" +
  " font-family:var(--ax-font-body); background:var(--ax-bg-input); color:var(--ax-fg);" +
  " outline:none; width:60px; text-align:right;";
export const emptyStateStyle =
  "padding:10px; font-size:12px; color:var(--ios-text-secondary); border-radius:8px;" +
  " border:1px dashed var(--ax-border); text-align:center;";

// ── Utility functions ──

/** Positive dev = overweight (red), negative = underweight (green). */
export function deviationColor(dev: number): string {
  if (Math.abs(dev) < 1e-9) return DS_COLORS.textSecondary;
  return dev > 0 ? DS_COLORS.negative : DS_COLORS.positive;
}

export function formatTargetInputValue(value: number, isPct: boolean): string {
  const factor = isPct ? 10 : 100;
  return String(Math.round(value * factor) / factor);
}

export function normalizeSymbolKey(value: string): string {
  return value.toUpperCase().trim();
}

export function resolveQuoteLastPrice(
  symbol: string,
  payload: Payload,
): number | null {
  // 1) Try quoteBySymbol (live quote data)
  const quoteMap = payload.quoteBySymbol;
  if (quoteMap) {
    const normalized = normalizeSymbolKey(symbol);
    const quoteItem =
      quoteMap[symbol] ?? (normalized ? quoteMap[normalized] : undefined);
    const raw =
      quoteItem?.quote?.lastPrice ?? quoteItem?.regularQuote?.lastPrice;
    const price = Number(raw);
    if (Number.isFinite(price) && price > 0) return price;
  }
  // 2) Fallback to derived holdings underlying price
  const normalized = normalizeSymbolKey(symbol);
  const byU = payload.derived?.byUnderlying;
  if (byU) {
    const agg = byU[symbol] ?? (normalized ? byU[normalized] : undefined);
    const up = agg?.underlyingPrice;
    if (typeof up === "number" && Number.isFinite(up) && up > 0) return up;
  }
  return null;
}

export function cloneTargets(raw?: RebalanceTargets): RebalanceTargets {
  const next: RebalanceTargets = {};
  if (!raw) return next;
  for (const [key, entry] of Object.entries(raw)) {
    if (
      entry &&
      TARGET_MODE_SET.has(entry.anchor) &&
      Number.isFinite(entry.value)
    ) {
      next[key] = { anchor: entry.anchor, value: entry.value };
    }
  }
  return next;
}

function formatLocalDateTime(ts: number): string {
  const d = new Date(ts);
  const pad2 = (v: number): string => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Resolve linked targets for all underlyings that have targets. */
export function resolveAllLinkedTargets(
  targets: RebalanceTargets | undefined,
  payload: Payload,
  horizon: BetaHorizon = "short",
): Map<string, LinkedTargetValues> {
  const result = new Map<string, LinkedTargetValues>();
  if (!targets) return result;

  const acctVal = payload.derived.portfolioAgg?.netMarketValue ?? 1;

  for (const [key, entry] of Object.entries(targets)) {
    const price = resolveQuoteLastPrice(key, payload) ?? 0;
    const betaRaw = payload.betaData?.get(key)?.[horizon]?.beta;
    const beta =
      typeof betaRaw === "number" && Number.isFinite(betaRaw) ? betaRaw : 1;

    result.set(key, computeLinkedTargets(entry, price, beta, acctVal));
  }
  return result;
}

export function buildAutoProfileName(
  targets: RebalanceTargets,
  payload: Payload,
  ts: number,
  horizon: BetaHorizon = "short",
): string {
  const linked = resolveAllLinkedTargets(targets, payload, horizon);
  const deltaCurMap = extractModeCurrentValues(
    "deltaDollarPct",
    payload.derived,
    payload.betaData,
    horizon,
  );
  const betaCurMap = extractModeCurrentValues(
    "betaPct",
    payload.derived,
    payload.betaData,
    horizon,
  );

  let deltaTotal = 0;
  let betaTotal = 0;
  const seenKeys = new Set<string>();

  for (const [key, lt] of linked) {
    seenKeys.add(key);
    deltaTotal += lt.deltaDollarPct;
    betaTotal += lt.betaPct;
  }
  deltaCurMap.forEach((v, key) => {
    if (!seenKeys.has(key)) deltaTotal += v;
  });
  betaCurMap.forEach((v, key) => {
    if (!seenKeys.has(key)) betaTotal += v;
  });

  return `${formatLocalDateTime(ts)} delta ${deltaTotal.toFixed(1)}% beta ${betaTotal.toFixed(1)}%`;
}
