import type { OHLCVBar } from "shared/types/chartData";
import type { RollingBetaPoint } from "../../computation/beta/types";
import { computeWorkerPool } from "../../computation/workers/ComputeWorkerPool";
import { logService } from "../../../shared/log/core/LogService";
import {
  DEFAULT_BENCHMARK,
  type RollingConfig,
  type RollingMode,
  type RollingProgressEvent,
  type RollingProgressStage,
  type RollingComputationOptions,
  type StockFetchProgress,
} from "./betaHorizons";
import type { BetaBarCache } from "./BetaBarCache";

const log = logService.namespace("compute");

export const ROLLING_CONFIGS: Record<RollingMode, RollingConfig> = {
  intraday: {
    lookbackDays: 60,
    interval: "5m",
    windowBars: 78,
    rolling: { minWindowPoints: 50, smoothingWindow: 78, samplingStep: 78 },
  },
  daily: {
    lookbackDays: 730,
    interval: "1h",
    windowBars: 65,
    rolling: { minWindowPoints: 50, smoothingWindow: 35, samplingStep: 35 },
  },
};

export async function computeRollingForTicker(
  barCache: BetaBarCache,
  symbol: string,
  mode: RollingMode,
  marketSymbol = DEFAULT_BENCHMARK,
): Promise<RollingBetaPoint[]> {
  const cfg = ROLLING_CONFIGS[mode];
  const [stockBars, marketBars] = await Promise.all([
    barCache.fetchBars(symbol, cfg.lookbackDays, cfg.interval),
    barCache.fetchMarketBars(cfg.lookbackDays, cfg.interval, marketSymbol),
  ]);
  return computeWorkerPool.computeRollingBeta(
    stockBars,
    marketBars,
    cfg.windowBars,
    cfg.rolling,
  );
}

export async function computeRollingForAll(
  barCache: BetaBarCache,
  symbols: string[],
  mode: RollingMode,
  optionsOrConcurrency: number | RollingComputationOptions = 3,
): Promise<Map<string, RollingBetaPoint[]>> {
  const opts: RollingComputationOptions =
    typeof optionsOrConcurrency === "number"
      ? { concurrency: optionsOrConcurrency }
      : (optionsOrConcurrency ?? {});
  const concurrency = opts.concurrency ?? 3;
  const marketSymbol = opts.marketSymbol ?? DEFAULT_BENCHMARK;
  const onProgress = opts.onProgress;
  log.info("beta.rolling.start", { count: symbols.length, mode, marketSymbol });
  const cfg = ROLLING_CONFIGS[mode];
  const results = new Map<string, RollingBetaPoint[]>();
  const startedAt = Date.now();
  const totalSteps = Math.max(1, symbols.length * 2 + 1);
  let completedSteps = 0;
  let stockFetchDone = 0;
  let computeDone = 0;

  const emitProgress = (
    stage: RollingProgressStage,
    message: string,
    extra?: Partial<
      Pick<RollingProgressEvent, "symbol" | "bars" | "points" | "error">
    >,
  ) => {
    if (!onProgress) return;
    const percent =
      totalSteps > 0
        ? Math.round((Math.min(completedSteps, totalSteps) / totalSteps) * 100)
        : 0;
    onProgress({
      mode,
      stage,
      message,
      completed: Math.min(completedSteps, totalSteps),
      total: totalSteps,
      percent,
      elapsedMs: Date.now() - startedAt,
      symbol: extra?.symbol,
      bars: extra?.bars,
      points: extra?.points,
      error: extra?.error,
    });
  };

  emitProgress("start", `Starting rolling beta for ${symbols.length} symbols`);

  // Step A: fetch market bars once.
  let marketBars: OHLCVBar[] = [];
  try {
    marketBars = await barCache.fetchMarketBars(
      cfg.lookbackDays,
      cfg.interval,
      marketSymbol,
    );
    completedSteps += 1;
    emitProgress(
      "market_fetch",
      `Fetched ${marketSymbol} bars (${marketBars.length})`,
      { bars: marketBars.length },
    );
  } catch (err) {
    emitProgress("error", `Failed to fetch ${marketSymbol} bars`, {
      error: (err as Error)?.message ?? "unknown error",
    });
    throw err;
  }

  // Step B: fetch all ticker bars.
  const stockBarsBySymbol = await barCache.fetchRollingStockBarsForAll(
    symbols,
    cfg,
    concurrency,
    mode,
    (progress: StockFetchProgress) => {
      stockFetchDone += 1;
      completedSteps = 1 + stockFetchDone + computeDone;
      const base = `Fetched ticker bars ${stockFetchDone}/${symbols.length}`;
      emitProgress(
        "stock_fetch",
        progress.error ? `${base} (with errors)` : base,
        {
          symbol: progress.symbol,
          bars: progress.bars,
          error: progress.error,
        },
      );
    },
  );

  // Step C: compute rolling beta per ticker.
  for (const sym of symbols) {
    try {
      const stockBars = stockBarsBySymbol.get(sym) ?? [];
      const points = await computeWorkerPool.computeRollingBeta(
        stockBars,
        marketBars,
        cfg.windowBars,
        cfg.rolling,
      );
      results.set(sym, points);
      computeDone += 1;
      completedSteps = 1 + stockFetchDone + computeDone;
      emitProgress(
        "compute",
        `Computed rolling beta ${computeDone}/${symbols.length}`,
        { symbol: sym, points: points.length },
      );
    } catch (err) {
      log.warn("beta.rolling.fail", {
        symbol: sym,
        mode,
        error: (err as Error)?.message,
      });
      results.set(sym, []);
      computeDone += 1;
      completedSteps = 1 + stockFetchDone + computeDone;
      emitProgress(
        "compute",
        `Computed rolling beta ${computeDone}/${symbols.length} (with errors)`,
        {
          symbol: sym,
          points: 0,
          error: (err as Error)?.message ?? "unknown error",
        },
      );
    }
  }

  completedSteps = totalSteps;
  emitProgress("complete", `Completed rolling beta for ${results.size} symbols`);
  log.info("beta.rolling.done", { computed: results.size, mode });
  return results;
}
