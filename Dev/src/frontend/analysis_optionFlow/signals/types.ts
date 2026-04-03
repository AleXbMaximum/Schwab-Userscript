export type SignalSeverity = "bullish" | "bearish" | "neutral" | "alert";

/** Sparkline: time-series points with optional percentile zone highlight. */
export interface SparklineChartData {
  kind: "sparkline";
  /** Y values in chronological order. */
  points: number[];
  /** Index of the "current" value (usually last). */
  currentIdx: number;
  /** Optional percentile rank (0-100) for zone coloring. */
  percentile?: number;
}

/** Gauge: spot position on a linear range (e.g. spot vs gammaFlip). */
export interface GaugeChartData {
  kind: "gauge";
  /** Current position value. */
  value: number;
  /** Reference point (e.g. gammaFlip). */
  reference: number;
  /** Display range [min, max] for the gauge axis. */
  range: [number, number];
}

/** Bars: category bar chart (e.g. IV across expirations). */
export interface BarsChartData {
  kind: "bars";
  labels: string[];
  values: number[];
}

/** Multi-line sparkline: overlaid time series with labels. */
export interface MultiLineChartData {
  kind: "multiLine";
  series: { label: string; color: string; points: number[] }[];
}

export type SignalChartData =
  | SparklineChartData
  | GaugeChartData
  | BarsChartData
  | MultiLineChartData;

export interface SignalResult {
  id: string;
  label: string;
  /** Formatted primary display value */
  value: string;
  /** Interpretation / context line */
  detail: string;
  severity: SignalSeverity;
  /** Optional inline chart data rendered inside the card. */
  chartData?: SignalChartData;
}
