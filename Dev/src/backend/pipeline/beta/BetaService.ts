import type { OHLCVBar } from "shared/utils/chartDataTypes";
import type {
  TickerBetaBundle,
  BetaResult,
  RollingBetaPoint,
  RollingBetaOptions,
  ThreeFactorBetaResult,
  ThreeFactorBundle,
} from "../../computation/beta/types";
import {
  alignFourBarsByDate,
  computeThreeFactorBeta,
} from "../../computation/beta/threeFactor";
import { computeLogReturns } from "../../computation/beta/singleFactor";
import type { ChartDataService } from "backend/core/network/chart/ChartDataService";
import type { ChartInterval } from "../../../shared/utils/chartDataTypes";
import { computeWorkerPool } from "../../computation/workers/ComputeWorkerPool";
import { logService } from "../../../shared/log/core/LogService";
import { runConcurrentQueue } from "../../../shared/utils/concurrency";

const log = logService.namespace("compute");

const DEFAULT_BENCHMARK = "$SPX";

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

export type UnifiedBetaResult = {
  singleFactor: AllBenchmarkBetaData;
  threeFactor: Map<string, ThreeFactorBundle>;
};

// ── Internal config types ───────────────────────────────────────────────────

type HorizonConfig = {
  key: "ultraShort" | "week" | "short" | "medium" | "long";
  label: string;
  days: number;
  interval: string;
};

type HorizonKey = HorizonConfig["key"];

const HORIZONS: HorizonConfig[] = [
  { key: "ultraShort", label: "1D", days: 5, interval: "5m" },
  { key: "week", label: "1W", days: 12, interval: "5m" },
  { key: "short", label: "1M", days: 35, interval: "15m" },
  { key: "medium", label: "6M", days: 200, interval: "1h" },
  { key: "long", label: "2Y", days: 760, interval: "1d" },
];

type RollingConfig = {
  lookbackDays: number;
  interval: string;
  windowBars: number;
  rolling: RollingBetaOptions;
};

type StockFetchProgress = {
  symbol: string;
  bars: number;
  error?: string;
};

// ── Shared horizon loop helper ──────────────────────────────────────────────

/** Compute a per-horizon result across all horizons in parallel, catching errors per horizon. */
async function computeAcrossHorizons<T>(
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

// ── BetaService ─────────────────────────────────────────────────────────────

export class BetaService {
  private chartService: ChartDataService;

  // Fetch-dedup caches only (not result caches — BetaManager owns result state).
  private marketBarsCache = new Map<
    string,
    { bars: OHLCVBar[]; fetchedAt: number }
  >();
  private stockBarsCache = new Map<
    string,
    { bars: OHLCVBar[]; fetchedAt: number }
  >();

  /**
   * Lightweight session cache for on-demand single-ticker computations
   * (e.g. overlay beta in accountTimeline). Keyed by "symbol|benchmark".
   * BetaManager owns the authoritative pipeline cache; this only serves
   * ad-hoc callers of computeForTicker().
   */
  private adHocBetaCache = new Map<string, TickerBetaBundle>();

  private static readonly MARKET_CACHE_TTL = 4 * 60 * 60 * 1000;
  private static readonly PERIOD_SAFETY_BUFFER_SECONDS = 3600;

  constructor(chartService: ChartDataService) {
    this.chartService = chartService;
  }

  // ── Ad-hoc cache access ─────────────────────────────────────────────────

  /** Read-through cache for on-demand single-ticker results. */
  getCached(
    symbol: string,
    benchmark: string,
  ): TickerBetaBundle | undefined {
    return this.adHocBetaCache.get(`${symbol}|${benchmark}`);
  }

  // ── Single-factor beta ──────────────────────────────────────────────────

  async computeForTicker(
    symbol: string,
    marketSymbol = DEFAULT_BENCHMARK,
  ): Promise<TickerBetaBundle> {
    const results = await computeAcrossHorizons<BetaResult>(
      symbol,
      async (h) => {
        const [stockBars, mBars] = await Promise.all([
          this.fetchBars(symbol, h.days, h.interval),
          this.fetchMarketBars(h.days, h.interval, marketSymbol),
        ]);
        return computeWorkerPool.computeBeta(stockBars, mBars, h.key);
      },
      "horizonFetchFailed",
    );

    const bundle: TickerBetaBundle = {
      symbol,
      benchmark: marketSymbol,
      ultraShort: results.ultraShort,
      week: results.week,
      short: results.short,
      medium: results.medium,
      long: results.long,
      computedAt: new Date().toISOString(),
    };

    this.adHocBetaCache.set(`${symbol}|${marketSymbol}`, bundle);

    log.debug("beta.compute.done", {
      symbol,
      marketSymbol,
      short: bundle.short?.beta,
      medium: bundle.medium?.beta,
      long: bundle.long?.beta,
    });
    return bundle;
  }

  async computeForAll(
    symbols: string[],
    concurrency = 3,
    marketSymbol = DEFAULT_BENCHMARK,
  ): Promise<Map<string, TickerBetaBundle>> {
    log.info("beta.computeAll.start", { count: symbols.length, marketSymbol });
    const results = await runConcurrentQueue(
      symbols,
      (sym) => this.computeForTicker(sym, marketSymbol),
      concurrency,
      (sym, err) =>
        log.error("beta.compute.fail", { symbol: sym, error: err.message }),
    );
    log.info("beta.computeAll.done", { computed: results.size });
    return results;
  }

  // ── Three-factor orthogonal model ───────────────────────────────────────

  async computeThreeFactorForTicker(
    symbol: string,
  ): Promise<ThreeFactorBundle> {
    const results = await computeAcrossHorizons<ThreeFactorBetaResult>(
      symbol,
      async (h) => {
        const [stockBars, spxBars, ndxBars, djiBars] = await Promise.all([
          this.fetchBars(symbol, h.days, h.interval),
          this.fetchMarketBars(h.days, h.interval, "$SPX"),
          this.fetchMarketBars(h.days, h.interval, "$COMPX"),
          this.fetchMarketBars(h.days, h.interval, "$DJI"),
        ]);
        const { stockCloses, spxCloses, ndxCloses, djiCloses } =
          alignFourBarsByDate(stockBars, spxBars, ndxBars, djiBars);
        return computeThreeFactorBeta(
          computeLogReturns(stockCloses),
          computeLogReturns(spxCloses),
          computeLogReturns(ndxCloses),
          computeLogReturns(djiCloses),
          h.key,
        );
      },
      "threeFactorHorizonFailed",
    );

    const bundle: ThreeFactorBundle = {
      symbol,
      ultraShort: results.ultraShort,
      week: results.week,
      short: results.short,
      medium: results.medium,
      long: results.long,
      computedAt: new Date().toISOString(),
    };

    log.debug("threeFactor.compute.done", {
      symbol,
      shortMkt: bundle.short?.betaMkt,
      shortR2: bundle.short?.rSquared,
    });
    return bundle;
  }

  async computeThreeFactorForAll(
    symbols: string[],
    concurrency = 3,
  ): Promise<Map<string, ThreeFactorBundle>> {
    log.info("threeFactor.computeAll.start", { count: symbols.length });
    const results = await runConcurrentQueue(
      symbols,
      (sym) => this.computeThreeFactorForTicker(sym),
      concurrency,
      (sym, err) =>
        log.error("threeFactor.compute.fail", { symbol: sym, error: err.message }),
    );
    log.info("threeFactor.computeAll.done", { computed: results.size });
    return results;
  }

  // ── Unified all-models computation ──────────────────────────────────────

  /**
   * Compute single-factor betas for ALL benchmarks AND three-factor betas
   * in a single pass per symbol.  Stock bars are fetched once per horizon
   * and reused across all models, reducing API calls by ~4×.
   */
  async computeAllModelsForAll(
    symbols: string[],
    benchmarks: readonly string[],
    concurrency = 3,
  ): Promise<UnifiedBetaResult> {
    log.info("beta.unified.start", {
      symbols: symbols.length,
      benchmarks: benchmarks.length,
    });
    const startMs = Date.now();

    // Pre-warm all benchmark bars (market bars are cached for 4h)
    for (const h of HORIZONS) {
      await Promise.all(
        benchmarks.map(async (bm) => {
          await this.fetchMarketBars(h.days, h.interval, bm);
        }),
      );
    }

    const singleFactor: AllBenchmarkBetaData = new Map();
    for (const bm of benchmarks) singleFactor.set(bm, new Map());
    const threeFactor = new Map<string, ThreeFactorBundle>();

    await runConcurrentQueue(
      symbols,
      async (sym) => {
        const { betaBundles, threeFactorBundle } =
          await this.computeAllModelsForTicker(sym, benchmarks);
        for (const [bm, bundle] of betaBundles) {
          singleFactor.get(bm)!.set(sym, bundle);
        }
        threeFactor.set(sym, threeFactorBundle);
        return null;
      },
      concurrency,
      (sym, err) =>
        log.error("beta.unified.tickerFail", { symbol: sym, error: err.message }),
    );

    this.stockBarsCache.clear();

    log.info("beta.unified.done", {
      symbols: symbols.length,
      singleFactor: [...singleFactor.values()].reduce((s, m) => s + m.size, 0),
      threeFactor: threeFactor.size,
      elapsedMs: Date.now() - startMs,
    });

    return { singleFactor, threeFactor };
  }

  private async computeAllModelsForTicker(
    symbol: string,
    benchmarks: readonly string[],
  ): Promise<{
    betaBundles: Map<string, TickerBetaBundle>;
    threeFactorBundle: ThreeFactorBundle;
  }> {
    const betaResults = new Map<
      string,
      Record<HorizonKey, BetaResult | null>
    >();
    for (const bm of benchmarks)
      betaResults.set(bm, {} as Record<HorizonKey, BetaResult | null>);
    const tfResults = {} as Record<HorizonKey, ThreeFactorBetaResult | null>;

    // Process all horizons in parallel (inflight dedup in ChartDataService prevents duplicate HTTP requests)
    await Promise.all(
      HORIZONS.map(async (h) => {
        try {
          // Fetch stock bars ONCE per horizon
          const stockBars = await this.fetchStockBars(symbol, h.days, h.interval);

          // Fetch all benchmark bars (cached)
          const bmBarsMap = new Map<string, OHLCVBar[]>();
          await Promise.all(
            benchmarks.map(async (bm) => {
              bmBarsMap.set(
                bm,
                await this.fetchMarketBars(h.days, h.interval, bm),
              );
            }),
          );

          // Single-factor beta for each benchmark
          for (const bm of benchmarks) {
            try {
              const mBars = bmBarsMap.get(bm)!;
              const result = await computeWorkerPool.computeBeta(
                stockBars,
                mBars,
                h.key,
              );
              betaResults.get(bm)![h.key] = result;
            } catch (err) {
              log.warn("beta.unified.singleFail", {
                symbol,
                benchmark: bm,
                horizon: h.key,
                error: (err as Error)?.message,
              });
              betaResults.get(bm)![h.key] = null;
            }
          }

          // Three-factor using SPX/NDX/DJI bars
          try {
            const spxBars =
              bmBarsMap.get("$SPX") ??
              (await this.fetchMarketBars(h.days, h.interval, "$SPX"));
            const ndxBars =
              bmBarsMap.get("$COMPX") ??
              (await this.fetchMarketBars(h.days, h.interval, "$COMPX"));
            const djiBars =
              bmBarsMap.get("$DJI") ??
              (await this.fetchMarketBars(h.days, h.interval, "$DJI"));

            if (
              spxBars.length === 0 ||
              ndxBars.length === 0 ||
              djiBars.length === 0
            ) {
              log.warn("threeFactor.missingBars", {
                symbol,
                horizon: h.key,
                stockBars: stockBars.length,
                spxBars: spxBars.length,
                ndxBars: ndxBars.length,
                djiBars: djiBars.length,
              });
            }

            const { stockCloses, spxCloses, ndxCloses, djiCloses } =
              alignFourBarsByDate(stockBars, spxBars, ndxBars, djiBars);

            if (stockCloses.length < 11) {
              log.warn("threeFactor.lowAlignment", {
                symbol,
                horizon: h.key,
                aligned: stockCloses.length,
                stockBars: stockBars.length,
                spxBars: spxBars.length,
                ndxBars: ndxBars.length,
                djiBars: djiBars.length,
              });
            }

            tfResults[h.key] = computeThreeFactorBeta(
              computeLogReturns(stockCloses),
              computeLogReturns(spxCloses),
              computeLogReturns(ndxCloses),
              computeLogReturns(djiCloses),
              h.key,
            );
          } catch (err) {
            log.warn("beta.unified.threeFactorFail", {
              symbol,
              horizon: h.key,
              error: (err as Error)?.message,
            });
            tfResults[h.key] = null;
          }
        } catch (err) {
          log.warn("beta.unified.horizonFail", {
            symbol,
            horizon: h.key,
            error: (err as Error)?.message,
          });
          for (const bm of benchmarks) betaResults.get(bm)![h.key] = null;
          tfResults[h.key] = null;
        }
      }),
    );

    // Bundle results
    const now = new Date().toISOString();
    const betaBundles = new Map<string, TickerBetaBundle>();
    for (const bm of benchmarks) {
      const r = betaResults.get(bm)!;
      const bundle: TickerBetaBundle = {
        symbol,
        benchmark: bm,
        ultraShort: r.ultraShort,
        week: r.week,
        short: r.short,
        medium: r.medium,
        long: r.long,
        computedAt: now,
      };
      betaBundles.set(bm, bundle);
    }

    const threeFactorBundle: ThreeFactorBundle = {
      symbol,
      ultraShort: tfResults.ultraShort,
      week: tfResults.week,
      short: tfResults.short,
      medium: tfResults.medium,
      long: tfResults.long,
      computedAt: now,
    };

    return { betaBundles, threeFactorBundle };
  }

  // ── Cache invalidation ──────────────────────────────────────────────────

  /** Invalidate fetch-dedup caches and ad-hoc result cache. */
  invalidate(): void {
    this.marketBarsCache.clear();
    this.stockBarsCache.clear();
    this.adHocBetaCache.clear();
  }

  // ── Rolling beta ────────────────────────────────────────────────────────

  private static readonly ROLLING_CONFIGS: Record<RollingMode, RollingConfig> =
    {
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

  async computeRollingForTicker(
    symbol: string,
    mode: RollingMode,
    marketSymbol = DEFAULT_BENCHMARK,
  ): Promise<RollingBetaPoint[]> {
    const cfg = BetaService.ROLLING_CONFIGS[mode];
    const [stockBars, marketBars] = await Promise.all([
      this.fetchBars(symbol, cfg.lookbackDays, cfg.interval),
      this.fetchMarketBars(cfg.lookbackDays, cfg.interval, marketSymbol),
    ]);
    return computeWorkerPool.computeRollingBeta(
      stockBars,
      marketBars,
      cfg.windowBars,
      cfg.rolling,
    );
  }

  async computeRollingForAll(
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
    const cfg = BetaService.ROLLING_CONFIGS[mode];
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
          ? Math.round(
              (Math.min(completedSteps, totalSteps) / totalSteps) * 100,
            )
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

    emitProgress(
      "start",
      `Starting rolling beta for ${symbols.length} symbols`,
    );

    // Step A: fetch market bars once.
    let marketBars: OHLCVBar[] = [];
    try {
      marketBars = await this.fetchMarketBars(
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
    const stockBarsBySymbol = await this.fetchRollingStockBarsForAll(
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
    emitProgress(
      "complete",
      `Completed rolling beta for ${results.size} symbols`,
    );
    log.info("beta.rolling.done", { computed: results.size, mode });
    return results;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async fetchBars(
    symbol: string,
    lookbackDays: number,
    interval: string,
  ): Promise<OHLCVBar[]> {
    const now = Math.floor(Date.now() / 1000);
    const period1 =
      now - lookbackDays * 86400 + BetaService.PERIOD_SAFETY_BUFFER_SECONDS;
    const result = await this.chartService.fetch({
      symbol,
      interval: interval as ChartInterval,
      window: { kind: "period", period1, period2: now },
      includePrePost: false,
    });
    return result.bars;
  }

  private async fetchMarketBars(
    lookbackDays: number,
    interval: string,
    marketSymbol = DEFAULT_BENCHMARK,
  ): Promise<OHLCVBar[]> {
    const cacheKey = `${marketSymbol}_${lookbackDays}_${interval}`;
    const cached = this.marketBarsCache.get(cacheKey);
    if (
      cached &&
      Date.now() - cached.fetchedAt < BetaService.MARKET_CACHE_TTL
    ) {
      return cached.bars;
    }
    const bars = await this.fetchBars(marketSymbol, lookbackDays, interval);
    // Only cache non-empty results to avoid persisting transient fetch failures
    if (bars.length > 0) {
      this.marketBarsCache.set(cacheKey, { bars, fetchedAt: Date.now() });
    }
    return bars;
  }

  /** Stock bar cache shared across models within one recalc cycle. */
  private async fetchStockBars(
    symbol: string,
    lookbackDays: number,
    interval: string,
  ): Promise<OHLCVBar[]> {
    const cacheKey = `${symbol}_${lookbackDays}_${interval}`;
    const cached = this.stockBarsCache.get(cacheKey);
    if (
      cached &&
      Date.now() - cached.fetchedAt < BetaService.MARKET_CACHE_TTL
    ) {
      return cached.bars;
    }
    const bars = await this.fetchBars(symbol, lookbackDays, interval);
    this.stockBarsCache.set(cacheKey, { bars, fetchedAt: Date.now() });
    return bars;
  }

  private async fetchRollingStockBarsForAll(
    symbols: string[],
    cfg: RollingConfig,
    concurrency: number,
    mode: RollingMode,
    onSymbolFetched?: (progress: StockFetchProgress) => void,
  ): Promise<Map<string, OHLCVBar[]>> {
    return runConcurrentQueue(
      symbols,
      async (sym) => {
        const bars = await this.fetchBars(sym, cfg.lookbackDays, cfg.interval);
        onSymbolFetched?.({ symbol: sym, bars: bars.length });
        return bars;
      },
      concurrency,
      (sym, err) => {
        log.warn("beta.rolling.fetchFail", {
          symbol: sym,
          mode,
          error: err.message,
        });
        onSymbolFetched?.({ symbol: sym, bars: 0, error: err.message });
      },
    );
  }
}
