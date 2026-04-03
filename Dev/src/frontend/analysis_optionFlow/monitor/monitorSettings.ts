/**
 * Monitor settings — types, defaults, persistence.
 */

import type { OpeningSelectionMode } from "backend/computation/options/monitor/etl/ExpiryMetricsETL";
import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { KVStore } from "backend/core/db/core/KVStore";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type MonitorUniverseMode = OpeningSelectionMode;
export type MonitorFixedSlot =
  | "0dte"
  | "this_week"
  | "next_week"
  | "month_end"
  | "quarter_end"
  | "year_end"
  | "leap";

export const FIXED_SLOTS: readonly MonitorFixedSlot[] = [
  "0dte",
  "this_week",
  "next_week",
  "month_end",
  "quarter_end",
  "year_end",
  "leap",
];

export type MonitorSelectedExpiry = {
  requestDate: string;
  isoDate: string;
  expiryLabel: string;
  dte: number;
  slot: MonitorFixedSlot | null;
  rank: number | null;
};

export function describeUniverseMode(mode: MonitorUniverseMode): string {
  if (mode === "top_n") return "Top N expiries";
  if (mode === "fixed_slots") return "Fixed key slots";
  return "All expiries";
}

export type MonitorSettings = {
  symbols: string[];
  intervalMinutes: number;
  concurrency: number;
  enabled: boolean;
  universeMode: MonitorUniverseMode;
  defaultTopN: number;
  topNBySymbol: Record<string, number>;
};

export const DEFAULT_MONITOR_TOP_N = 10;
const MIN_MONITOR_TOP_N = 1;
const MAX_MONITOR_TOP_N = 30;

export const DEFAULT_MONITOR_SETTINGS: MonitorSettings = {
  symbols: [
    "SPY",
    "QQQ",
    "IWM",
    "NVDA",
    "TSLA",
    "AAPL",
    "AMZN",
    "AMD",
    "META",
    "MSFT",
    "GOOG",
    "GLD",
    "SLV",
    "XLF",
    "XLE",
    "SMH",
    "TLT",
    "HYG",
  ],
  intervalMinutes: 10,
  concurrency: 4,
  enabled: true,
  universeMode: "all",
  defaultTopN: DEFAULT_MONITOR_TOP_N,
  topNBySymbol: {},
};

export const MONITOR_SYMBOLS = DEFAULT_MONITOR_SETTINGS.symbols;

function normalizeMonitorSymbolList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0)
    return [...DEFAULT_MONITOR_SETTINGS.symbols];
  const symbols = value
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim().toUpperCase());
  return symbols.length > 0 ? symbols : [...DEFAULT_MONITOR_SETTINGS.symbols];
}

export function normalizeTopNValue(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const rounded = Math.trunc(value);
  return Math.max(MIN_MONITOR_TOP_N, Math.min(MAX_MONITOR_TOP_N, rounded));
}

export function normalizeTopNBySymbol(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const symbol = key.trim().toUpperCase();
    if (!symbol) continue;
    out[symbol] = normalizeTopNValue(value, DEFAULT_MONITOR_TOP_N);
  }
  return out;
}

function parseMonitorSettings(parsed: any): MonitorSettings {
  if (!parsed || typeof parsed !== "object")
    return cloneMonitorSettings(DEFAULT_MONITOR_SETTINGS);
  const symbols = normalizeMonitorSymbolList(parsed.symbols);
  const defaultTopN = DEFAULT_MONITOR_TOP_N;
  const topNBySymbolRaw = normalizeTopNBySymbol(parsed.topNBySymbol);
  const topNBySymbol: Record<string, number> = {};
  for (const sym of symbols) {
    if (topNBySymbolRaw[sym] != null) {
      topNBySymbol[sym] = topNBySymbolRaw[sym];
    }
  }
  return {
    symbols,
    intervalMinutes:
      typeof parsed.intervalMinutes === "number" &&
      parsed.intervalMinutes >= 1 &&
      parsed.intervalMinutes <= 60
        ? parsed.intervalMinutes
        : DEFAULT_MONITOR_SETTINGS.intervalMinutes,
    concurrency:
      typeof parsed.concurrency === "number" &&
      parsed.concurrency >= 1 &&
      parsed.concurrency <= 10
        ? parsed.concurrency
        : DEFAULT_MONITOR_SETTINGS.concurrency,
    enabled:
      typeof parsed.enabled === "boolean"
        ? parsed.enabled
        : DEFAULT_MONITOR_SETTINGS.enabled,
    universeMode:
      parsed.universeMode === "top_n" || parsed.universeMode === "fixed_slots"
        ? parsed.universeMode
        : DEFAULT_MONITOR_SETTINGS.universeMode,
    defaultTopN,
    topNBySymbol,
  };
}

export function cloneMonitorSettings(
  settings: MonitorSettings,
): MonitorSettings {
  return {
    ...settings,
    symbols: [...settings.symbols],
    topNBySymbol: { ...settings.topNBySymbol },
  };
}

export async function loadMonitorSettings(): Promise<MonitorSettings> {
  try {
    const db = await openAlexQuantDB();
    const kv = new KVStore(db);
    const raw = await kv.get("monitor.settings");
    return parseMonitorSettings(raw);
  } catch {
    return cloneMonitorSettings(DEFAULT_MONITOR_SETTINGS);
  }
}

export function saveMonitorSettings(settings: MonitorSettings): void {
  void (async () => {
    try {
      const db = await openAlexQuantDB();
      const kv = new KVStore(db);
      await kv.set("monitor.settings", settings);
    } catch {}
  })();
}
