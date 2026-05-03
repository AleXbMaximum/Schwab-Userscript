export type OHLCVBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type YahooDividendEvent = {
  date: number;
  amount: number;
};

export type YahooSplitEvent = {
  date: number;
  numerator: number;
  denominator: number;
  splitRatio: string;
};

/** Bar interval the unified chart service understands. */
export type ChartInterval =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "1d"
  | "1wk"
  | "1mo";

/** How the time window is specified. */
export type ChartTimeWindow =
  | { kind: "range"; range: string }
  | { kind: "period"; period1: number; period2?: number };

export type ChartDataRequest = {
  symbol: string;
  interval: ChartInterval;
  window: ChartTimeWindow;
  /** Include pre/post market data. Default: false. */
  includePrePost?: boolean;
  /** Include corporate events (dividends, splits). Default: false. */
  includeEvents?: boolean;
  /** Force a specific source, bypassing fallback logic. */
  forceSource?: "schwab" | "yahoo";
};

/** Which data source actually provided the bars. */
export type ChartDataSource = "schwab" | "yahoo" | "none";

/** Normalized metadata common to both sources. */
export type ChartDataMeta = {
  source: ChartDataSource;
  previousClose: number | null;
  currentPrice: number | null;
  change: number | null;
  changePercent: number | null;
  /** Yahoo-only fields */
  currency?: string;
  exchangeName?: string;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
};

export type ChartDataResult = {
  bars: OHLCVBar[];
  meta: ChartDataMeta;
  dividends: YahooDividendEvent[];
  splits: YahooSplitEvent[];
  fetchedAt: string;
};
