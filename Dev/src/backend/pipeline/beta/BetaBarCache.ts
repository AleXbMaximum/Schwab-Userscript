import type { OHLCVBar } from "shared/types/chartData";
import type { ChartDataService } from "backend/core/network/chart/ChartDataService";
import type { ChartInterval } from "../../../shared/types/chartData";
import { logService } from "../../../shared/log/core/LogService";
import { runConcurrentQueue } from "../../../shared/utils/async/concurrency";
import {
  DEFAULT_BENCHMARK,
  type RollingConfig,
  type RollingMode,
  type StockFetchProgress,
} from "./betaHorizons";

const log = logService.namespace("compute");

const MARKET_CACHE_TTL = 4 * 60 * 60 * 1000;
const PERIOD_SAFETY_BUFFER_SECONDS = 3600;

/**
 * Caches OHLCV bar fetches used by the beta pipeline. Two caches:
 *   - `marketBars` is shared across recompute cycles (TTL 4h).
 *   - `stockBars` is session-scoped and cleared between cycles.
 */
export class BetaBarCache {
  private marketBars = new Map<
    string,
    { bars: OHLCVBar[]; fetchedAt: number }
  >();
  private stockBars = new Map<
    string,
    { bars: OHLCVBar[]; fetchedAt: number }
  >();

  constructor(private chartService: ChartDataService) {}

  /** Pass-through fetch (no caching). */
  async fetchBars(
    symbol: string,
    lookbackDays: number,
    interval: string,
  ): Promise<OHLCVBar[]> {
    const now = Math.floor(Date.now() / 1000);
    const period1 = now - lookbackDays * 86400 + PERIOD_SAFETY_BUFFER_SECONDS;
    const result = await this.chartService.fetch({
      symbol,
      interval: interval as ChartInterval,
      window: { kind: "period", period1, period2: now },
      includePrePost: false,
    });
    return result.bars;
  }

  /** Cached benchmark-bar fetch (4h TTL). Empty fetches are not cached. */
  async fetchMarketBars(
    lookbackDays: number,
    interval: string,
    marketSymbol = DEFAULT_BENCHMARK,
  ): Promise<OHLCVBar[]> {
    const cacheKey = `${marketSymbol}_${lookbackDays}_${interval}`;
    const cached = this.marketBars.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < MARKET_CACHE_TTL) {
      return cached.bars;
    }
    const bars = await this.fetchBars(marketSymbol, lookbackDays, interval);
    if (bars.length > 0) {
      this.marketBars.set(cacheKey, { bars, fetchedAt: Date.now() });
    }
    return bars;
  }

  /** Stock-bar cache shared across models within one recompute cycle. */
  async fetchStockBars(
    symbol: string,
    lookbackDays: number,
    interval: string,
  ): Promise<OHLCVBar[]> {
    const cacheKey = `${symbol}_${lookbackDays}_${interval}`;
    const cached = this.stockBars.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < MARKET_CACHE_TTL) {
      return cached.bars;
    }
    const bars = await this.fetchBars(symbol, lookbackDays, interval);
    this.stockBars.set(cacheKey, { bars, fetchedAt: Date.now() });
    return bars;
  }

  async fetchRollingStockBarsForAll(
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

  /** Drop both caches. */
  clear(): void {
    this.marketBars.clear();
    this.stockBars.clear();
  }

  /** Drop only the per-cycle stock cache. */
  clearStockBars(): void {
    this.stockBars.clear();
  }
}
