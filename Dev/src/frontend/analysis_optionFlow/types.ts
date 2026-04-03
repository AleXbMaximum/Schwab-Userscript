import type {
  OptionCaptureMetaRow,
  OptionCaptureExpiryMetricsRow,
} from "backend/core/db/capture/optionMonitorTypes";

export type DashboardSymbol = string;

/** Market hours capture window bounds in minutes since midnight CT. */
export const CAPTURE_WINDOW_MIN = 480; // 08:00
export const CAPTURE_WINDOW_MAX = 930; // 15:30
/** Full day bounds. */
export const FULL_DAY_MIN = 0; // 00:00
export const FULL_DAY_MAX = 1435; // 23:55
export const TIME_STEP_MIN = 5; // 5-minute granularity

export interface DashboardState {
  symbol: DashboardSymbol;
  dateStart: string; // YYYY-MM-DD
  dateEnd: string; // YYYY-MM-DD
  timeStartMin: number; // minutes since midnight CT (default 480 = 08:00)
  timeEndMin: number; // minutes since midnight CT (default 930 = 15:30)
  loading: boolean;
  error: string | null;
  metaRows: OptionCaptureMetaRow[];
  expiryRows: OptionCaptureExpiryMetricsRow[];
}

export interface StatusBandPoint {
  time: string; // market_time_ct
  spot: number | null;
  atmIV: number | null;
  rr25: number | null;
  netGex: number;
}

export interface KeyLevelsPoint {
  time: string;
  spot: number | null;
  spotPct: number | null;
  callWallPrice: number | null;
  putWallPrice: number | null;
  gammaFlipPrice: number | null;
  maxPainPrice: number | null;
  callWallPct: number | null;
  putWallPct: number | null;
  gammaFlipPct: number | null;
  maxPainPct: number | null;
}

export interface FlowIncrementPoint {
  time: string;
  deltaCallVol: number | null;
  deltaPutVol: number | null;
  deltaPCRatio: number | null;
}

export interface GexHeatmapData {
  times: string[];
  strikes: number[];
  spots: number[]; // underlying price at each time
  netMatrix: number[][]; // [timeIdx][strikeIdx] = net GEX
  callMatrix: number[][]; // [timeIdx][strikeIdx] = call GEX
  putMatrix: number[][]; // [timeIdx][strikeIdx] = put GEX
}

export interface TermBandSeries {
  label: string; // e.g. "0-7d"
  points: { time: string; atmIV: number | null }[];
}

export interface OIHeatmapData {
  times: string[];
  strikes: number[];
  spots: number[];
  callOIMatrix: number[][]; // [timeIdx][strikeIdx] = call OI
  putOIMatrix: number[][]; // [timeIdx][strikeIdx] = put OI
}
