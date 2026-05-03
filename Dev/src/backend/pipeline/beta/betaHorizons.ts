import { logService } from "../../../shared/log/core/LogService";
import type {
  TickerBetaBundle,
  RollingBetaOptions,
} from "../../computation/beta/types";

const log = logService.namespace("compute");

export const DEFAULT_BENCHMARK = "$SPX";

// ── Public types ────────────────────────────────────────────────────────────

export type RollingMode = "intraday" | "daily";
export type RollingProgressStage =
  | "start"
  | "market_fetch"
  | "stock_fetch"
  | "compute"
  | "complete"
  | "error";

export type RollingProgressEvent = {
  mode: RollingMode;
  stage: RollingProgressStage;
  message: string;
  completed: number;
  total: number;
  percent: number;
  elapsedMs: number;
  symbol?: string;
  bars?: number;
  points?: number;
  error?: string;
};

export type RollingComputationOptions = {
  concurrency?: number;
  marketSymbol?: string;
  onProgress?: (event: RollingProgressEvent) => void;
};

/** benchmark → symbol → bundle */
export type AllBenchmarkBetaData = Map<string, Map<string, TickerBetaBundle>>;

// ── Internal config types ───────────────────────────────────────────────────

export type HorizonConfig = {
  key: "ultraShort" | "week" | "short" | "medium" | "long";
  label: string;
  days: number;
  interval: string;
};

export type HorizonKey = HorizonConfig["key"];

export const HORIZONS: HorizonConfig[] = [
  { key: "ultraShort", label: "1D", days: 5, interval: "5m" },
  { key: "week", label: "1W", days: 12, interval: "5m" },
  { key: "short", label: "1M", days: 35, interval: "15m" },
  { key: "medium", label: "6M", days: 200, interval: "1h" },
  { key: "long", label: "2Y", days: 760, interval: "1d" },
];

export type RollingConfig = {
  lookbackDays: number;
  interval: string;
  windowBars: number;
  rolling: RollingBetaOptions;
};

export type StockFetchProgress = {
  symbol: string;
  bars: number;
  error?: string;
};

// ── Shared horizon loop helper ──────────────────────────────────────────────

/** Compute a per-horizon result across all horizons in parallel, catching errors per horizon. */
export async function computeAcrossHorizons<T>(
  symbol: string,
  computeOne: (horizon: HorizonConfig) => Promise<T | null>,
  logTag: string,
): Promise<Record<HorizonKey, T | null>> {
  const entries = await Promise.all(
    HORIZONS.map(async (horizon) => {
      try {
        return [horizon.key, await computeOne(horizon)] as const;
      } catch (err) {
        log.warn(logTag, {
          symbol,
          horizon: horizon.key,
          error: (err as Error)?.message,
        });
        return [horizon.key, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<HorizonKey, T | null>;
}
