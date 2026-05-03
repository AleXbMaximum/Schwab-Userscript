import type {
  OHLCVBar,
  YahooDividendEvent,
  YahooSplitEvent,
} from "shared/types/chartData";
import type {
  YahooChartParams,
  YahooChartResult,
  YahooChartMeta,
} from "./chartTypes";
import { gmGet } from "./httpUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

type LegacyChartResult = { bars: OHLCVBar[]; currentPrice: number | null };

export function fetchYahooChart(symbol: string): Promise<LegacyChartResult>;
export function fetchYahooChart(
  params: YahooChartParams,
): Promise<YahooChartResult>;

export async function fetchYahooChart(
  symbolOrParams: string | YahooChartParams,
): Promise<LegacyChartResult | YahooChartResult> {
  const isLegacy = typeof symbolOrParams === "string";
  const params: YahooChartParams = isLegacy
    ? { symbol: symbolOrParams, interval: "1d", range: "4mo" }
    : symbolOrParams;

  const empty: YahooChartResult = {
    bars: [],
    currentPrice: null,
    meta: null,
    dividends: [],
    splits: [],
  };

  const span = log.span("fetchYahooChart", {
    symbol: params.symbol,
    interval: params.interval,
    range: params.range,
  });

  try {
    const url = buildChartUrl(params);
    const text = await gmGet(url);
    const data = JSON.parse(text) as any;
    const result = data?.chart?.result?.[0];
    if (!result) {
      span.end("empty", { barCount: 0 }, "debug");
      return isLegacy ? { bars: [], currentPrice: null } : empty;
    }

    const bars = parseBars(result, params.interval);
    const currentPrice: number | null =
      result.meta?.regularMarketPrice ??
      (bars.length > 0 ? bars[bars.length - 1].close : null);

    span.end("ok", { barCount: bars.length, currentPrice }, "debug");

    if (isLegacy) {
      return { bars, currentPrice };
    }

    return {
      bars,
      currentPrice,
      meta: parseMeta(result.meta),
      dividends: parseDividends(result.events?.dividends),
      splits: parseSplits(result.events?.splits),
    };
  } catch (err) {
    span.end(
      "error",
      { error: (err as Error)?.message ?? String(err) },
      "warn",
    );
    return isLegacy ? { bars: [], currentPrice: null } : empty;
  }
}

function buildChartUrl(params: YahooChartParams): string {
  const symbol = encodeURIComponent(params.symbol);
  const base = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}`;
  const parts: string[] = [];

  if (params.period1 != null) {
    parts.push(`period1=${Math.floor(params.period1)}`);
    parts.push(`period2=${Math.floor(params.period2 ?? Date.now() / 1000)}`);
  } else if (params.range) {
    parts.push(`range=${params.range}`);
  } else {
    parts.push("range=4mo");
  }

  parts.push(`interval=${params.interval ?? "1d"}`);

  parts.push(`includePrePost=${params.includePrePost ? "true" : "false"}`);

  if (params.events?.length) {
    parts.push(`events=${params.events.join("%7C")}`);
  }

  parts.push("lang=en-US", "region=US");

  return `${base}?${parts.join("&")}`;
}

const INTRADAY_INTERVALS = new Set([
  "1m",
  "2m",
  "5m",
  "15m",
  "30m",
  "60m",
  "90m",
  "1h",
]);

function parseBars(result: any, interval?: string): OHLCVBar[] {
  const timestamps: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const opens: number[] = q.open ?? [];
  const highs: number[] = q.high ?? [];
  const lows: number[] = q.low ?? [];
  const closes: number[] = q.close ?? [];
  const volumes: number[] = q.volume ?? [];

  const granularity = interval ?? result.meta?.dataGranularity ?? "1d";
  const isIntraday = INTRADAY_INTERVALS.has(granularity);

  return timestamps
    .map((ts, i) => ({
      date: isIntraday
        ? new Date(ts * 1000).toISOString()
        : new Date(ts * 1000).toISOString().slice(0, 10),
      open: opens[i] ?? 0,
      high: highs[i] ?? 0,
      low: lows[i] ?? 0,
      close: closes[i] ?? 0,
      volume: volumes[i] ?? 0,
    }))
    .filter((b) => b.close > 0);
}

function parseMeta(meta: any): YahooChartMeta | null {
  if (!meta) return null;
  return {
    currency: meta.currency ?? "USD",
    symbol: meta.symbol ?? "",
    exchangeName: meta.fullExchangeName ?? meta.exchangeName ?? "",
    regularMarketPrice: meta.regularMarketPrice ?? null,
    chartPreviousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    dataGranularity: meta.dataGranularity ?? "",
    validRanges: Array.isArray(meta.validRanges) ? meta.validRanges : [],
  };
}

function parseDividends(divObj: any): YahooDividendEvent[] {
  if (!divObj || typeof divObj !== "object") return [];
  return Object.values(divObj).map((d: any) => ({
    date: d.date ?? 0,
    amount: d.amount ?? 0,
  }));
}

function parseSplits(splitObj: any): YahooSplitEvent[] {
  if (!splitObj || typeof splitObj !== "object") return [];
  return Object.values(splitObj).map((s: any) => ({
    date: s.date ?? 0,
    numerator: s.numerator ?? 0,
    denominator: s.denominator ?? 0,
    splitRatio: s.splitRatio ?? "",
  }));
}
