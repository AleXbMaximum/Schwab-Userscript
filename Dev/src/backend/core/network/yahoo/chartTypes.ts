import type {
  OHLCVBar,
  YahooDividendEvent,
  YahooSplitEvent,
} from "shared/types/chartData";

/** Parameters for the upgraded Yahoo v8 chart fetch */
export type YahooChartParams = {
  symbol: string;
  /** Unix timestamp in seconds. When set, `range` is ignored. */
  period1?: number;
  /** Unix timestamp in seconds. Defaults to now when period1 is set. */
  period2?: number;
  /** Bar interval, e.g. '1d', '5m', '1wk', '1mo'. Default: '1d'. */
  interval?: string;
  /** Convenience range, e.g. '1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','ytd','max'. */
  range?: string;
  /** Include pre/post market data. Default: false. */
  includePrePost?: boolean;
  /** Corporate events to include. */
  events?: ("div" | "split" | "earn")[];
};

export type YahooChartMeta = {
  currency: string;
  symbol: string;
  exchangeName: string;
  regularMarketPrice: number | null;
  chartPreviousClose: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  dataGranularity: string;
  validRanges: string[];
};

export type YahooChartResult = {
  bars: OHLCVBar[];
  currentPrice: number | null;
  meta: YahooChartMeta | null;
  dividends: YahooDividendEvent[];
  splits: YahooSplitEvent[];
};
