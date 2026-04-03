import { CHART_COLORS } from "frontend/charts/ChartTheme";
import type { SnapshotMetricDef, TimeRange } from "./timelineTypes";

export const ONE_HOUR_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const DAY_CHANGE_STITCH_MAX_DURATION_MS = 3 * ONE_DAY_MS;

export function asFiniteNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

export const INDEX_OVERLAY_OPTIONS = [
  { symbol: "$SPX", label: "SPX", color: "rgba(0,122,255,0.8)" },
  { symbol: "$COMPX", label: "COMPX", color: "rgba(175,82,222,0.8)" },
  { symbol: "$RUT", label: "RUT", color: "rgba(255,149,0,0.8)" },
  { symbol: "$DJI", label: "DJI", color: "rgba(88,86,214,0.8)" },
  { symbol: "NVDA", label: "NVDA", color: "rgba(0,199,190,0.82)" },
] as const;

export const SNAPSHOT_METRICS: SnapshotMetricDef[] = [
  {
    key: "dayChangeDollar",
    label: "Day $",
    pick: (point) => asFiniteNumber(point.dayChangeDollar),
    color: CHART_COLORS.categorical[0],
    baseline: 0,
    forceBaseline: false,
    kind: "currency",
  },
  {
    key: "dayChangePercent",
    label: "Day %",
    pick: (point) => asFiniteNumber(point.dayChangePercent),
    color: CHART_COLORS.categorical[1],
    baseline: 0,
    forceBaseline: false,
    kind: "percent",
  },
  {
    key: "gainLossDollar",
    label: "Total $",
    pick: (point) => asFiniteNumber(point.gainLossDollar),
    color: CHART_COLORS.categorical[2],
    baseline: 0,
    forceBaseline: false,
    kind: "currency",
  },
  {
    key: "gainLossPercent",
    label: "Total %",
    pick: (point) => asFiniteNumber(point.gainLossPercent),
    color: CHART_COLORS.categorical[3],
    baseline: 0,
    forceBaseline: false,
    kind: "percent",
  },
  {
    key: "marketValue",
    label: "MktVal",
    pick: (point) => asFiniteNumber(point.marketValue),
    color: CHART_COLORS.categorical[4],
    baseline: null,
    kind: "currency",
  },
  {
    key: "accountValue",
    label: "AccVal",
    pick: (point) => asFiniteNumber(point.accountValue),
    color: CHART_COLORS.categorical[5],
    baseline: null,
    kind: "currency",
  },
  {
    key: "absDeltaNotionalDol",
    label: "Δ$",
    pick: (point) => asFiniteNumber(point.absDeltaNotionalDol),
    color: CHART_COLORS.categorical[6],
    baseline: null,
    kind: "currency",
  },
  {
    key: "thetaPerDay",
    label: "θ/d",
    pick: (point) => asFiniteNumber(point.thetaPerDay),
    color: CHART_COLORS.categorical[7],
    baseline: 0,
    forceBaseline: false,
    kind: "currency",
  },
  {
    key: "vegaPerVolPoint",
    label: "ν/v",
    pick: (point) => asFiniteNumber(point.vegaPerVolPoint),
    color: CHART_COLORS.categorical[0],
    baseline: 0,
    forceBaseline: false,
    kind: "currency",
  },
  {
    key: "beta",
    label: "β",
    pick: (point) => asFiniteNumber(point.beta),
    color: CHART_COLORS.categorical[1],
    baseline: 0,
    forceBaseline: false,
    kind: "beta",
  },
  {
    key: "dayBuyPower",
    label: "BuyPwr",
    pick: (point) => asFiniteNumber(point.dayBuyPower),
    color: CHART_COLORS.categorical[2],
    baseline: null,
    kind: "currency",
  },
  {
    key: "marginEquity",
    label: "MgnEq",
    pick: (point) => asFiniteNumber(point.marginEquity),
    color: CHART_COLORS.categorical[3],
    baseline: null,
    kind: "currency",
  },
  {
    key: "equityPercent",
    label: "Eq %",
    pick: (point) => asFiniteNumber(point.equityPercent),
    color: CHART_COLORS.categorical[4],
    baseline: null,
    kind: "percent",
  },
  {
    key: "optionRequirement",
    label: "OptRq",
    pick: (point) => asFiniteNumber(point.optionRequirement),
    color: CHART_COLORS.categorical[5],
    baseline: null,
    kind: "currency",
  },
];

export const TIME_RANGES: TimeRange[] = [
  { label: "1h", durationMs: 60 * 60 * 1000 },
  { label: "6.5h", durationMs: 6.5 * 60 * 60 * 1000 },
  { label: "24h", durationMs: 24 * 60 * 60 * 1000 },
  {
    label: "Today",
    durationMs: ONE_DAY_MS,
    anchor: "todaySession",
  },
  {
    label: "Open",
    durationMs: ONE_DAY_MS,
    anchor: "marketOpen",
  },
  { label: "3d", durationMs: 3 * 24 * 60 * 60 * 1000 },
  { label: "7d", durationMs: 7 * 24 * 60 * 60 * 1000 },
  { label: "30d", durationMs: 30 * 24 * 60 * 60 * 1000 },
  { label: "90d", durationMs: 90 * 24 * 60 * 60 * 1000 },
  { label: "1y", durationMs: 365 * 24 * 60 * 60 * 1000 },
  {
    label: "WTD",
    durationMs: 7 * ONE_DAY_MS,
    anchor: "weekToDate",
  },
  {
    label: "MTD",
    durationMs: 31 * ONE_DAY_MS,
    anchor: "monthToDate",
  },
  {
    label: "YTD",
    durationMs: 366 * ONE_DAY_MS,
    anchor: "yearToDate",
  },
];
