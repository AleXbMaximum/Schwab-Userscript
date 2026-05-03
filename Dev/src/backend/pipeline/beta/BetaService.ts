import type { OHLCVBar } from "shared/types/chartData";
import type {
  TickerBetaBundle,
  BetaResult,
  RollingBetaPoint,
  ThreeFactorBetaResult,
  ThreeFactorBundle,
} from "../../computation/beta/types";
import {
  alignFourBarsByDate,
  computeThreeFactorBeta,
} from "../../computation/beta/threeFactor";
import { computeLogReturns } from "../../computation/beta/singleFactor";
import type { ChartDataService } from "backend/core/network/chart/ChartDataService";
import { computeWorkerPool } from "../../computation/workers/ComputeWorkerPool";
import { logService } from "../../../shared/log/core/LogService";
import { runConcurrentQueue } from "../../../shared/utils/async/concurrency";
import {
  DEFAULT_BENCHMARK,
  HORIZONS,
  computeAcrossHorizons,
  type HorizonKey,
  type RollingConfig,
  type RollingMode,
  type RollingProgressStage,
  type RollingProgressEvent,
  type RollingComputationOptions,
  type AllBenchmarkBetaData,
  type StockFetchProgress,
} from "./betaHorizons";
import { BetaBarCache } from "./BetaBarCache";
import {
  computeRollingForTicker as computeRollingForTickerImpl,
  computeRollingForAll as computeRollingForAllImpl,
} from "./rollingBeta";

export type {
  RollingMode,
  RollingProgressStage,
  RollingProgressEvent,
  RollingComputationOptions,
  AllBenchmarkBetaData,
};

const log = logService.namespace("compute");

export type UnifiedBetaResult = {
  singleFactor: AllBenchmarkBetaData;
  threeFactor: Map<string, ThreeFactorBundle>;
};

// ── BetaService ─────────────────────────────────────────────────────────────

export class BetaService {
  // Fetch-dedup caches only (not result caches — BetaManager owns result state).
  private barCache: BetaBarCache;

  /**
   * Lightweight session cache for on-demand single-ticker computations
   * (e.g. overlay beta in accountTimeline). Keyed by "symbol|benchmark".
   * BetaManager owns the authoritative pipeline cache; this only serves
   * ad-hoc callers of computeForTicker().
   */
  private adHocBetaCache = new Map<string, TickerBetaBundle>();

  constructor(chartService: ChartDataService) {
    this.barCache = new BetaBarCache(chartService);
  }

  private fetchBars = (
    symbol: string,
    lookbackDays: number,
    interval: string,
  ) => this.barCache.fetchBars(symbol, lookbackDays, interval);

  private fetchMarketBars = (
    lookbackDays: number,
    interval: string,
    marketSymbol = DEFAULT_BENCHMARK,
  ) => this.barCache.fetchMarketBars(lookbackDays, interval, marketSymbol);

  private fetchStockBars = (
    symbol: string,
    lookbackDays: number,
    interval: string,
  ) => this.barCache.fetchStockBars(symbol, lookbackDays, interval);

  private fetchRollingStockBarsForAll = (
    symbols: string[],
    cfg: RollingConfig,
    concurrency: number,
    mode: RollingMode,
    onSymbolFetched?: (progress: StockFetchProgress) => void,
  ) =>
    this.barCache.fetchRollingStockBarsForAll(
      symbols,
      cfg,
      concurrency,
      mode,
      onSymbolFetched,
    );

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

    this.barCache.clearStockBars();

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
    this.barCache.clear();
    this.adHocBetaCache.clear();
  }

  // ── Rolling beta (delegated to ./rollingBeta.ts) ────────────────────────

  computeRollingForTicker(
    symbol: string,
    mode: RollingMode,
    marketSymbol = DEFAULT_BENCHMARK,
  ): Promise<RollingBetaPoint[]> {
    return computeRollingForTickerImpl(
      this.barCache,
      symbol,
      mode,
      marketSymbol,
    );
  }

  computeRollingForAll(
    symbols: string[],
    mode: RollingMode,
    optionsOrConcurrency: number | RollingComputationOptions = 3,
  ): Promise<Map<string, RollingBetaPoint[]>> {
    return computeRollingForAllImpl(
      this.barCache,
      symbols,
      mode,
      optionsOrConcurrency,
    );
  }
}
