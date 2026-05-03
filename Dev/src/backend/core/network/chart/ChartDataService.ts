import type {
  ChartDataRequest,
  ChartDataResult,
  ChartDataMeta,
  ChartDataSource,
  ChartInterval,
} from "shared/types/chartData";
import {
  fetchSchwabChart,
  type SchwabPeriod,
} from "../schwab/endpoints/symbol_quotes_history";
import { normalizeSchwabBars } from "../schwab/parsing/chartNormalizer";
import { fetchYahooChart } from "../yahoo/chart";
import type { YahooChartResult } from "../yahoo/chartTypes";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("chart");

const MIN_BARS_THRESHOLD = 2;

// Only `^` prefix skips Schwab (Yahoo-only index tickers like ^GSPC).
// `$` prefix symbols ($SPX, $DJI, $COMPX) are Schwab index tickers that Schwab CAN serve.
const YAHOO_ONLY_PREFIXES = ["^"];

/** Map Schwab index symbols to their Yahoo equivalents for fallback routing. */
const SCHWAB_TO_YAHOO_MAP: Record<string, string> = {
  $SPX: "^GSPC",
  $DJI: "^DJI",
  $COMPX: "^IXIC",
  $RUT: "^RUT",
};

// ── Schwab date normalization ────────────────────────────────────────────────

/**
 * US Eastern DST check: EDT runs from 2nd Sunday of March to 1st Sunday of November.
 */
function isEDT(year: number, month: number, day: number): boolean {
  if (month < 3 || month > 11) return false;
  if (month > 3 && month < 11) return true;
  if (month === 3) {
    // 2nd Sunday of March
    const firstDow = new Date(year, 2, 1).getDay(); // 0=Sun
    const secondSunday = firstDow === 0 ? 8 : 15 - firstDow;
    return day >= secondSunday;
  }
  // month === 11: 1st Sunday of November
  const firstDow = new Date(year, 10, 1).getDay();
  const firstSunday = firstDow === 0 ? 1 : 8 - firstDow;
  return day < firstSunday;
}

/**
 * Convert a Schwab ET datetime string (e.g. "2026-02-27T09:30:00") to UTC ISO.
 * Returns the string unchanged if it's date-only or already has a timezone suffix.
 */
function schwabETtoUTC(dateStr: string): string {
  const tIdx = dateStr.indexOf("T");
  if (tIdx < 0) return dateStr; // date-only
  if (
    dateStr.endsWith("Z") ||
    dateStr.includes("+") ||
    dateStr.includes("-", tIdx + 1)
  ) {
    return dateStr; // already has timezone
  }
  const y = parseInt(dateStr.slice(0, 4), 10);
  const m = parseInt(dateStr.slice(5, 7), 10);
  const d = parseInt(dateStr.slice(8, 10), 10);
  const offset = isEDT(y, m, d) ? "-04:00" : "-05:00";
  return new Date(dateStr + offset).toISOString();
}

// ── Schwab capability map ────────────────────────────────────────────────────

type SchwabCapability = {
  period: SchwabPeriod;
  impliedInterval: ChartInterval;
  maxDays: number;
};

/**
 * Ordered by coverage (smallest first) so findSchwabPeriod picks the
 * tightest match for the requested range.
 */
const SCHWAB_CAPABILITIES: SchwabCapability[] = [
  { period: "day", impliedInterval: "1m", maxDays: 1 },
  { period: "week", impliedInterval: "15m", maxDays: 7 },
  { period: "OneMonth", impliedInterval: "1h", maxDays: 30 },
  { period: "ThreeMonth", impliedInterval: "1d", maxDays: 90 },
  { period: "SixMonth", impliedInterval: "1d", maxDays: 180 },
  { period: "OneYear", impliedInterval: "1d", maxDays: 365 },
  { period: "ThreeYear", impliedInterval: "1d", maxDays: 1095 },
  { period: "FiveYear", impliedInterval: "1wk", maxDays: 1825 },
];

/** Map range strings to approximate number of days. */
const RANGE_TO_DAYS: Record<string, number> = {
  "1d": 1,
  "5d": 5,
  "1wk": 7,
  "1mo": 30,
  "3mo": 90,
  "4mo": 120,
  "6mo": 180,
  "1y": 365,
  "2y": 730,
  "3y": 1095,
  "5y": 1825,
  "10y": 3650,
  ytd: 365,
  max: 10000,
};

// ── Service ──────────────────────────────────────────────────────────────────

type CacheEntry = { result: ChartDataResult; expiresAt: number };

const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min for failed/empty results

export class ChartDataService {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<ChartDataResult>>();
  private cacheTtlMs: number;

  constructor(cacheTtlMs = 60_000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  async fetch(request: ChartDataRequest): Promise<ChartDataResult> {
    const cacheKey = this.buildCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.result;
    }

    // Deduplicate concurrent requests for the same cache key
    const existing = this.inflight.get(cacheKey);
    if (existing) return existing;

    const promise = this.fetchInternal(request)
      .then((result) => {
        const ttl =
          result.bars.length > 0 ? this.cacheTtlMs : NEGATIVE_CACHE_TTL_MS;
        this.cache.set(cacheKey, {
          result,
          expiresAt: Date.now() + ttl,
        });
        return result;
      })
      .finally(() => {
        this.inflight.delete(cacheKey);
      });

    this.inflight.set(cacheKey, promise);
    return promise;
  }

  invalidate(symbol?: string): void {
    if (!symbol) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(symbol + ":")) {
        this.cache.delete(key);
      }
    }
  }

  // ── Core routing ─────────────────────────────────────────────────────────

  private async fetchInternal(req: ChartDataRequest): Promise<ChartDataResult> {
    if (req.forceSource === "yahoo") {
      return this.fetchFromYahoo(req);
    }

    const isYahooOnly = YAHOO_ONLY_PREFIXES.some((p) =>
      req.symbol.startsWith(p),
    );

    if (req.forceSource === "schwab") {
      if (isYahooOnly) {
        log.warn("chart.source.indexSkip", { symbol: req.symbol });
        return this.emptyResult("none");
      }
      const period = this.findSchwabPeriod(req);
      if (!period) {
        log.warn("chart.source.noPeriod", {
          symbol: req.symbol,
          interval: req.interval,
        });
        return this.emptyResult("none");
      }
      return this.fetchFromSchwab(req, period);
    }

    // Schwab-primary routing
    if (!isYahooOnly) {
      const period = this.findSchwabPeriod(req);
      if (period) {
        const schwabResult = await this.fetchFromSchwab(req, period);
        if (schwabResult.bars.length >= MIN_BARS_THRESHOLD) {
          return schwabResult;
        }
        log.debug("chart.source.insufficientBars", {
          symbol: req.symbol,
          period,
          barCount: schwabResult.bars.length,
          fallback: "yahoo",
        });
      }
    }

    return this.fetchFromYahoo(req);
  }

  // ── Source: Schwab ────────────────────────────────────────────────────────

  private async fetchFromSchwab(
    req: ChartDataRequest,
    period: SchwabPeriod,
  ): Promise<ChartDataResult> {
    const span = log.span("fetchFromSchwab", { symbol: req.symbol, period });
    try {
      const schwabResult = await fetchSchwabChart(req.symbol, {
        period,
        includeExtendedHours: req.includePrePost ?? false,
      });

      const bars = normalizeSchwabBars(schwabResult.bars);

      // Normalize Schwab dates to match Yahoo conventions:
      // - Daily/weekly: truncate to YYYY-MM-DD (Yahoo daily format)
      // - Intraday: convert ET to UTC ISO (Yahoo intraday format)
      const cap = SCHWAB_CAPABILITIES.find((c) => c.period === period);
      const isDaily =
        cap && (cap.impliedInterval === "1d" || cap.impliedInterval === "1wk");
      for (const bar of bars) {
        if (isDaily) {
          const tIdx = bar.date.indexOf("T");
          if (tIdx > 0) bar.date = bar.date.slice(0, tIdx);
        } else {
          bar.date = schwabETtoUTC(bar.date);
        }
      }

      const meta: ChartDataMeta = {
        source: "schwab",
        previousClose: schwabResult.meta?.previousClose ?? null,
        currentPrice: bars.length > 0 ? bars[bars.length - 1].close : null,
        change: schwabResult.meta?.change ?? null,
        changePercent: schwabResult.meta?.changePercent ?? null,
      };

      span.end("ok", { barCount: bars.length }, "debug");

      return {
        bars,
        meta,
        dividends: [],
        splits: [],
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      span.end("error", { error: (err as Error)?.message }, "warn");
      return this.emptyResult("none");
    }
  }

  // ── Source: Yahoo ─────────────────────────────────────────────────────────

  private async fetchFromYahoo(
    req: ChartDataRequest,
  ): Promise<ChartDataResult> {
    const yahooSymbol = SCHWAB_TO_YAHOO_MAP[req.symbol] ?? req.symbol;
    const span = log.span("fetchFromYahoo", {
      symbol: req.symbol,
      yahooSymbol,
      interval: req.interval,
    });
    try {
      const yahooResult = (await fetchYahooChart({
        symbol: yahooSymbol,
        interval: req.interval,
        ...(req.window.kind === "range"
          ? { range: req.window.range }
          : { period1: req.window.period1, period2: req.window.period2 }),
        includePrePost: req.includePrePost ?? false,
        events: req.includeEvents ? ["div", "split"] : undefined,
      })) as YahooChartResult;

      const meta: ChartDataMeta = {
        source: "yahoo",
        previousClose: yahooResult.meta?.chartPreviousClose ?? null,
        currentPrice: yahooResult.currentPrice,
        change: null,
        changePercent: null,
        currency: yahooResult.meta?.currency,
        exchangeName: yahooResult.meta?.exchangeName,
        fiftyTwoWeekHigh: yahooResult.meta?.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: yahooResult.meta?.fiftyTwoWeekLow,
      };

      span.end("ok", { barCount: yahooResult.bars.length }, "debug");

      return {
        bars: yahooResult.bars,
        meta,
        dividends: yahooResult.dividends,
        splits: yahooResult.splits,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      span.end("error", { error: (err as Error)?.message }, "warn");
      return this.emptyResult("none");
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Find the smallest Schwab period that matches the requested interval
   * and covers the requested time range.
   */
  private findSchwabPeriod(req: ChartDataRequest): SchwabPeriod | null {
    const rangeDays = this.windowToDays(req.window);
    for (const cap of SCHWAB_CAPABILITIES) {
      if (cap.impliedInterval === req.interval && cap.maxDays >= rangeDays) {
        return cap.period;
      }
    }
    return null;
  }

  private windowToDays(window: ChartDataRequest["window"]): number {
    if (window.kind === "range") {
      return RANGE_TO_DAYS[window.range] ?? 30;
    }
    const now = window.period2 ?? Math.floor(Date.now() / 1000);
    return Math.ceil((now - window.period1) / 86400);
  }

  private buildCacheKey(req: ChartDataRequest): string {
    const windowKey =
      req.window.kind === "range"
        ? req.window.range
        : `${req.window.period1}-${req.window.period2 ?? "now"}`;
    return `${req.symbol}:${req.interval}:${windowKey}:${req.includePrePost ? "ext" : "rth"}`;
  }

  private emptyResult(source: ChartDataSource): ChartDataResult {
    return {
      bars: [],
      meta: {
        source,
        previousClose: null,
        currentPrice: null,
        change: null,
        changePercent: null,
      },
      dividends: [],
      splits: [],
      fetchedAt: new Date().toISOString(),
    };
  }
}

/** Shared singleton instance for use across all consumers. */
export const chartDataService = new ChartDataService();
