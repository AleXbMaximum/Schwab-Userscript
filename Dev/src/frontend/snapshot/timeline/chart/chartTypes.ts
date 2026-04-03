import type { AccountHistoryPoint } from "../../../../backend/core/db/account/accountHistoryTypes";
import type { SnapshotMetricDef, IndexOverlayLine, ChartRenderMode } from "../timelineTypes";
import type { CandleBucket } from "../data/candleAggregation";

/** State for a single SMA overlay slot. */
export type SmaSlotState = {
  period: number;
  values: (number | null)[];
  color: string;
};

/** Result of rendering the base chart (everything except hover tooltip). */
export type SnapshotChartBaseState = {
  /** Pixel data snapshot of the base chart for fast hover restore. */
  imageData: ImageData;
  /** Pre-computed metric values aligned with `points`. */
  values: number[];
  /** Coordinate mappers. */
  toX: (ts: number) => number;
  toY: (value: number) => number;
  /** Chart geometry in CSS pixels. */
  pad: typeof SNAPSHOT_CHART_PAD;
  chartW: number;
  chartH: number;
  /** The metric definition used for this render. */
  metric: SnapshotMetricDef;
  /** Range duration used for time label formatting. */
  rangeDurationMs: number;
  /** Time window used for this render. */
  windowStartTs: number;
  windowEndTs: number;
  /** Downsampled points (if LTTB was applied). */
  renderPoints: AccountHistoryPoint[];
  /** Map from render-point index → original-point index (null if no downsampling). */
  originalIndexMap: number[] | null;
  /** SMA overlay slots (up to 2). */
  smaSlots: SmaSlotState[];
  /** Midpoint timestamps of candle buckets, aligned with SMA value arrays. */
  smaBucketTs: number[];
  /** Index overlay lines drawn on the chart. */
  overlayLines: IndexOverlayLine[];
  /** Chart rendering mode used for this render. */
  chartMode: ChartRenderMode;
  /** Candle buckets (always computed for SMA; drawn only when chartMode === "candle"). */
  candleBuckets: CandleBucket[];
  /** Candle body width in CSS px (only when chartMode === "candle"). */
  candleWidthPx: number | null;
};

export const SNAPSHOT_CHART_PAD = {
  top: 10,
  right: 50,
  bottom: 26,
  left: 12,
} as const;
