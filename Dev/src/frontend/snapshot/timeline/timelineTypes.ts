import type { AccountHistoryPoint } from "../../../backend/core/db/account/accountHistoryTypes";

// ── Pure type definitions ────────────────────────────────────────────────────

export type GapMode = "compressed" | "stitched";
export type SessionType = "pre" | "regular" | "post" | "overnight";

export type TimeSegment = {
  startTs: number;
  endTs: number;
  startPx: number;
  endPx: number;
  isGap: boolean;
  sessionType: SessionType;
};

export type TimeAxisMapping = {
  segments: TimeSegment[];
  toX: (ts: number) => number;
  fromX: (x: number) => number;
};

export type SnapshotMetricKey =
  | "marketValue"
  | "accountValue"
  | "dayChangeDollar"
  | "dayChangePercent"
  | "gainLossDollar"
  | "gainLossPercent"
  | "absDeltaNotionalDol"
  | "beta"
  | "thetaPerDay"
  | "vegaPerVolPoint"
  | "dayBuyPower"
  | "marginEquity"
  | "equityPercent"
  | "optionRequirement";

export type SnapshotMetricKind = "currency" | "percent" | "beta";

export type SnapshotMetricDef = {
  key: SnapshotMetricKey;
  label: string;
  pick: (point: AccountHistoryPoint) => number;
  color: string;
  baseline: number | null;
  forceBaseline?: boolean;
  kind: SnapshotMetricKind;
};

export type TimeRange = {
  label: string;
  durationMs: number;
  anchor?: "todaySession" | "marketOpen" | "weekToDate" | "monthToDate" | "yearToDate";
};

export type ResolvedTimeRangeWindow = {
  startTs: number;
  endTs: number;
  durationMs: number;
};

export type ChartRenderMode = "line" | "candle";

export type SnapshotRuntimePrefs = {
  metric?: SnapshotMetricKey;
  timeRangeLabel?: string;
  skipNightSession: boolean;
  smaPeriod?: number;
  sma2Period?: number;
  overlayIndices?: string[];
  overlayBetaOffset?: boolean;
  chartMode?: ChartRenderMode;
};

/** Pre-computed day-change % series for an index overlay on the timeline chart. */
export type IndexOverlayLine = {
  symbol: string;
  /** Bar timestamps in ms */
  timestamps: number[];
  /** Day change ratio values: (price[i]/previousClose - 1) */
  dayChangePct: number[];
  color: string;
};

