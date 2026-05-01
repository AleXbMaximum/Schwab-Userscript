import { ui_createElement } from "../../../components/core/createElement";
import { DS_COMPONENTS, DS_COLORS } from "../../../components/core/theme";
import {
  BETA_BENCHMARKS,
  type TickerBetaBundle,
  type BetaResult,
} from "../../../../backend/computation/beta/types";
import { formatCurrencyLocale as fmtCurrencyLocale } from "shared/utils/formatters";
import { isShareMasked, shareScaleValue, SHARE_MASKED_TEXT } from "shared/utils/globalShareMode";

// ── Style presets ────────────────────────────────────────────────────────────────
export const thStyle = DS_COMPONENTS.tableHeader;
const tdStyle = DS_COMPONENTS.tableCell;
export const tableStyle = DS_COMPONENTS.table;
export const cellBase =
  tdStyle +
  " font-variant-numeric: tabular-nums; padding: 4px 6px; font-size: 12px; text-align: right;";

export const BENCHMARK_LABELS: Record<string, string> = {
  $SPX: "SPX",
  $COMPX: "NDX",
  $DJI: "DJI",
};
export const HORIZONS = ["ultraShort", "week", "short", "medium", "long"] as const;
export const HORIZON_LABELS: Record<string, string> = {
  ultraShort: "1D",
  week: "1W",
  short: "1M",
  medium: "6M",
  long: "2Y",
};

// ── Public types ─────────────────────────────────────────────────────────────────

export type WeightedBetaRow = {
  ultraShort: number | null;
  week: number | null;
  short: number | null;
  medium: number | null;
  long: number | null;
};

export type BetaPanelPayload = {
  allBenchmarkBetas: Map<string, Map<string, TickerBetaBundle>>;
  portfolioWeightedBeta: Record<string, WeightedBetaRow>;
  targetPortfolioWeightedBeta?: Record<string, WeightedBetaRow>;
  byUnderlying?: Record<string, { deltaNotionalDol?: number | null }>;
  targetByUnderlying?: Record<string, { deltaNotionalDol: number | null }>;
  accountValue?: number;
  rebalanceTargets?: Record<string, unknown>;
  currentBenchmark?: string;
  extraTickers?: string[];
  betaCalcStatus?: { isFetching: boolean; error: unknown | null };
  onRecalculate?: () => void;
  onAddTicker?: (symbol: string) => void;
  onRemoveTicker?: (symbol: string) => void;
};

export type PanelResult = HTMLElement & {
  cleanup?: () => void;
  update?: (payload: BetaPanelPayload) => void;
};

// ── Internal types ───────────────────────────────────────────────────────────────

export type BenchmarkEntry = {
  beta: Record<string, number | null>;
  deltaBeta: Record<string, number | null>;
  corr: number | null;
  rSquared: number | null;
};

export type TableEntry = {
  symbol: string;
  deltaDol: number | null;
  benchmarks: Record<string, BenchmarkEntry>;
};

export type SortKey =
  | {
      kind: "common";
      field: "symbol" | "deltaDol";
    }
  | {
      kind: "benchmark";
      benchmark: string;
      field: "beta" | "deltaBeta" | "corr" | "rSquared";
      horizon?: string;
    };

export type RightMode = "beta" | "exposure" | "corrR2";

export type ExposureMode = "current" | "target";

// ── Data transform ───────────────────────────────────────────────────────────────

export function buildEntries(
  payload: BetaPanelPayload,
  mode: ExposureMode = "current",
): TableEntry[] {
  const byU =
    mode === "target"
      ? (payload.targetByUnderlying ?? payload.byUnderlying ?? {})
      : (payload.byUnderlying ?? {});
  const allSymbols = new Set<string>();
  for (const [, betaMap] of payload.allBenchmarkBetas) {
    for (const sym of betaMap.keys()) allSymbols.add(sym);
  }
  return [...allSymbols].map((symbol) => {
    const agg = byU[symbol];
    const deltaDol = agg?.deltaNotionalDol ?? null;
    const benchmarks: Record<string, BenchmarkEntry> = {};
    for (const bm of BETA_BENCHMARKS) {
      const bundle = payload.allBenchmarkBetas.get(bm)?.get(symbol);
      const beta: Record<string, number | null> = {};
      const deltaBeta: Record<string, number | null> = {};
      for (const h of HORIZONS) {
        const bVal = bundle?.[h]?.beta ?? null;
        beta[h] = bVal;
        deltaBeta[h] =
          deltaDol != null && bVal != null ? deltaDol * bVal : null;
      }
      const bestResult: BetaResult | null =
        bundle?.medium ?? bundle?.short ?? bundle?.long ?? null;
      benchmarks[bm] = {
        beta,
        deltaBeta,
        corr: bestResult?.correlation ?? null,
        rSquared: bestResult?.rSquared ?? null,
      };
    }
    return { symbol, deltaDol, benchmarks };
  });
}

// ── Color system ─────────────────────────────────────────────────────────────────

export function betaColor(beta: number | null): string {
  if (beta == null) return "var(--ios-text-secondary)";
  if (beta < 0) return "#4A90D9";
  if (beta < 0.5) return "#7CB5EC";
  if (beta < 0.8) return "var(--ios-text-secondary)";
  if (beta <= 1.2) return "var(--ios-text-primary)";
  if (beta <= 1.5) return "#D78100";
  if (beta <= 2.0) return "#E25C3E";
  return "#D73126";
}

export function betaBgColor(beta: number | null): string {
  if (beta == null) return "transparent";
  if (beta < 0) return "rgba(74,144,217,0.12)";
  if (beta < 0.5) return "rgba(124,181,236,0.10)";
  if (beta < 0.8) return "var(--ax-tone-muted-soft-bg)";
  if (beta <= 1.2) return "var(--ax-bg-glass-inset)";
  if (beta <= 1.5) return "rgba(215,129,0,0.10)";
  if (beta <= 2.0) return "rgba(226,92,62,0.12)";
  return "rgba(215,49,38,0.15)";
}

export function exposureColor(val: number | null): string {
  if (val == null) return "var(--ios-text-secondary)";
  return val >= 0 ? DS_COLORS.positive : DS_COLORS.negative;
}

export function qualityColor(rSq: number | null): string {
  if (rSq == null) return "var(--ios-text-secondary)";
  if (rSq >= 0.4) return "#20a945";
  if (rSq >= 0.15) return "#D78100";
  return "#D73126";
}

export function corrQualityColor(corr: number | null): string {
  if (corr == null) return "var(--ios-text-secondary)";
  const abs = Math.abs(corr);
  if (abs >= 0.6) return "#20a945";
  if (abs >= 0.3) return "#D78100";
  return "#D73126";
}

// ── Formatters ───────────────────────────────────────────────────────────────────

export function fmtBeta(val: number | null | undefined): string {
  return val == null ? "--" : val.toFixed(2);
}

export function fmtCorr(val: number | null | undefined): string {
  return val == null ? "--" : val.toFixed(2);
}

export function fmtR2(val: number | null | undefined): string {
  return val == null ? "--" : Math.round(val * 100) + "%";
}

export function fmtDeltaDol(val: number | null | undefined): string {
  if (val == null) return "--";
  if (isShareMasked()) return SHARE_MASKED_TEXT;
  return fmtCurrencyLocale(shareScaleValue(val) as number, 0);
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "--";
  try {
    const d = new Date(iso);
    return (
      d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) +
      " " +
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    );
  } catch {
    return iso;
  }
}

export function pickLatestComputedAt(
  allBetas: Map<string, Map<string, TickerBetaBundle>>,
): string | null {
  let latestTs = Number.NEGATIVE_INFINITY;
  let latestIso: string | null = null;
  for (const [, betaMap] of allBetas) {
    for (const bundle of betaMap.values()) {
      const iso = bundle?.computedAt;
      if (!iso) continue;
      const ts = Date.parse(iso);
      if (Number.isFinite(ts) && ts > latestTs) {
        latestTs = ts;
        latestIso = iso;
      }
    }
  }
  return latestIso;
}

// ── Sort ─────────────────────────────────────────────────────────────────────────

function getSortValue(entry: TableEntry, key: SortKey): number | string | null {
  if (key.kind === "common")
    return key.field === "symbol" ? entry.symbol : entry.deltaDol;
  const bm = entry.benchmarks[key.benchmark];
  if (!bm) return null;
  if (key.field === "corr") return bm.corr;
  if (key.field === "rSquared") return bm.rSquared;
  if (key.field === "beta" && key.horizon) return bm.beta[key.horizon] ?? null;
  if (key.field === "deltaBeta" && key.horizon)
    return bm.deltaBeta[key.horizon] ?? null;
  return null;
}

export function sortEntries(
  ents: TableEntry[],
  key: SortKey,
  asc: boolean,
): TableEntry[] {
  return [...ents].sort((a, b) => {
    const va = getSortValue(a, key);
    const vb = getSortValue(b, key);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string" && typeof vb === "string")
      return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return asc ? Number(va) - Number(vb) : Number(vb) - Number(va);
  });
}

// ── UI helpers ───────────────────────────────────────────────────────────────────

export function buildSegmentControl(
  options: { key: string; label: string }[],
  active: string,
  onChange: (key: string) => void,
): { el: HTMLElement; setActive: (key: string) => void } {
  const wrap = ui_createElement("div", {
    styleString:
      "display: inline-flex; border: 1px solid var(--ios-border); border-radius: 8px; overflow: hidden; background: var(--ax-bg-glass-inset);",
  });
  const buttons: Record<string, HTMLButtonElement> = {};
  const sync = (ak: string) => {
    for (const [k, btn] of Object.entries(buttons)) {
      const isActive = k === ak;
      btn.style.background = isActive ? "var(--ax-blue)" : "transparent";
      btn.style.color = isActive ? "#fff" : "var(--ax-fg-2)";
    }
  };
  for (const opt of options) {
    const btn = ui_createElement("button", {
      text: opt.label,
      styleString:
        "padding: 5px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--ios-text-secondary); font-family: inherit;",
    }) as HTMLButtonElement;
    btn.addEventListener("click", () => onChange(opt.key));
    buttons[opt.key] = btn;
    wrap.appendChild(btn);
  }
  sync(active);
  return { el: wrap, setActive: sync };
}

export function trendArrow(
  current: number | null,
  next: number | null,
): { text: string; color: string } | null {
  if (current == null || next == null) return null;
  const diff = current - next;
  if (Math.abs(diff) < 0.1)
    return { text: "\u2192", color: "var(--ios-text-secondary)" };
  return diff > 0
    ? { text: "\u2197", color: "#D78100" }
    : { text: "\u2198", color: "#4A90D9" };
}

export function qualityDotHtml(color: string): string {
  return `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${color};margin-left:3px;vertical-align:middle;"></span>`;
}

function computeMaxAbsExposure(
  ents: TableEntry[],
  benchmarks: readonly string[],
): number {
  let max = 0;
  for (const e of ents) {
    for (const benchmark of benchmarks) {
      for (const h of HORIZONS) {
        const val = e.benchmarks[benchmark]?.deltaBeta?.[h];
        if (val != null) max = Math.max(max, Math.abs(val));
      }
    }
  }
  return max;
}

export function getMaxAbsExposure(ents: TableEntry[], bm: string): number {
  return computeMaxAbsExposure(ents, [bm]);
}

export function getMaxAbsExposureAll(ents: TableEntry[]): number {
  return computeMaxAbsExposure(ents, BETA_BENCHMARKS);
}
