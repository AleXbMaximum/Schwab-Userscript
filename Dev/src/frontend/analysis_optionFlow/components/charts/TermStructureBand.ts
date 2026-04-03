import {
  CHART_COLORS,
  baseChartOptions,
  TIME_X_AXIS,
  yAxis,
  niceLinearScale,
} from "frontend/charts/ChartTheme";
import { createLegacyChartPanel, type ChartPanelResult } from "frontend/charts/chartPanel";
import type { TermBandSeries } from "../../types";
import { groupExpiriesByOpeningId, type FlowChartData } from "../chartData";
import { FLOW_CHART_PROFILES } from "../chartProfiles";

const PROFILE = FLOW_CHART_PROFILES.termStructure;

interface DTEBucket {
  label: string;
  minDTE: number;
  maxDTE: number;
}

interface FixedSlot {
  key: string;
  label: string;
}

const BUCKETS: DTEBucket[] = [
  { label: "0-7d", minDTE: 0, maxDTE: 7 },
  { label: "7-30d", minDTE: 7, maxDTE: 30 },
  { label: "30-60d", minDTE: 30, maxDTE: 60 },
  { label: "60d+", minDTE: 60, maxDTE: 999 },
];

const FIXED_SLOTS: FixedSlot[] = [
  { key: "0dte", label: "0DTE" },
  { key: "this_week", label: "This Week" },
  { key: "next_week", label: "Next Week" },
  { key: "month_end", label: "Month End" },
  { key: "quarter_end", label: "Quarter End" },
  { key: "year_end", label: "Year End" },
  { key: "leap", label: "LEAP" },
];

function bucketIndexForDte(dte: number): number {
  for (let i = 0; i < BUCKETS.length; i++) {
    const bucket = BUCKETS[i];
    if (dte >= bucket.minDTE && dte < bucket.maxDTE) return i;
  }
  return -1;
}

function bucketAveragesByDte(
  expiries: FlowChartData["expiry"],
): (number | null)[] {
  const sums = Array.from({ length: BUCKETS.length }, () => 0);
  const counts = Array.from({ length: BUCKETS.length }, () => 0);

  for (const expiry of expiries) {
    if (expiry.atmIV == null) continue;
    const idx = bucketIndexForDte(expiry.dte);
    if (idx < 0) continue;
    sums[idx] += expiry.atmIV;
    counts[idx] += 1;
  }

  return sums.map((sum, idx) => (counts[idx] > 0 ? sum / counts[idx] : null));
}

function hasFixedSlots(expiryRows: FlowChartData["expiry"]): boolean {
  return expiryRows.some((row) => {
    const slot = row.selectionSlot;
    return typeof slot === "string" && slot.length > 0;
  });
}

function slotAveragesByKey(
  expiries: FlowChartData["expiry"],
): (number | null)[] {
  const sums = Array.from({ length: FIXED_SLOTS.length }, () => 0);
  const counts = Array.from({ length: FIXED_SLOTS.length }, () => 0);
  const slotIndex = new Map<string, number>();
  for (let i = 0; i < FIXED_SLOTS.length; i++) {
    slotIndex.set(FIXED_SLOTS[i].key, i);
  }

  for (const expiry of expiries) {
    if (expiry.atmIV == null) continue;
    const slot =
      typeof expiry.selectionSlot === "string" ? expiry.selectionSlot : "";
    const idx = slotIndex.get(slot);
    if (idx == null) continue;
    sums[idx] += expiry.atmIV;
    counts[idx] += 1;
  }
  return sums.map((sum, idx) => (counts[idx] > 0 ? sum / counts[idx] : null));
}

function extractSeries(
  metaRows: FlowChartData["meta"],
  expiryRows: FlowChartData["expiry"],
): TermBandSeries[] {
  const grouped = groupExpiriesByOpeningId(expiryRows);
  if (hasFixedSlots(expiryRows)) {
    const pointsBySlot = FIXED_SLOTS.map(
      () => [] as { time: string; atmIV: number | null }[],
    );
    for (const meta of metaRows) {
      const averages = slotAveragesByKey(grouped.get(meta.openingId) ?? []);
      for (let i = 0; i < FIXED_SLOTS.length; i++) {
        pointsBySlot[i].push({ time: meta.marketTimeCt, atmIV: averages[i] });
      }
    }
    return FIXED_SLOTS.map((slot, idx) => {
      return { label: slot.label, points: pointsBySlot[idx] };
    });
  }

  const pointsByBucket = BUCKETS.map(
    () => [] as { time: string; atmIV: number | null }[],
  );
  for (const meta of metaRows) {
    const averages = bucketAveragesByDte(grouped.get(meta.openingId) ?? []);
    for (let i = 0; i < BUCKETS.length; i++) {
      pointsByBucket[i].push({ time: meta.marketTimeCt, atmIV: averages[i] });
    }
  }
  return BUCKETS.map((bucket, idx) => {
    return { label: bucket.label, points: pointsByBucket[idx] };
  });
}

const colors = CHART_COLORS.categorical;

function buildConfig(data: FlowChartData) {
  const series = extractSeries(data.meta, data.expiry);
  const labels = data.meta.map((m) => m.marketTimeCt);

  return {
    type: "line" as const,
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.points.map((p) => p.atmIV),
        borderColor: colors[i % colors.length],
        backgroundColor: "transparent",
        borderWidth: 1.5,
        pointRadius: 1,
        tension: 0.3,
        spanGaps: true,
      })),
    },
    options: {
      ...baseChartOptions(),
      scales: {
        x: TIME_X_AXIS,
        y: {
          ...yAxis("ATM IV"),
          ...niceLinearScale(
            series.flatMap((s) => s.points.map((p) => p.atmIV)),
          ),
          ticks: {
            ...niceLinearScale(
              series.flatMap((s) => s.points.map((p) => p.atmIV)),
            ).ticks,
          },
        },
      },
    },
  };
}

export function renderTermStructureBand(
  metaRows: FlowChartData["meta"],
  expiryRows: FlowChartData["expiry"],
): ChartPanelResult<FlowChartData> {
  return createLegacyChartPanel<FlowChartData>(
    { title: PROFILE.title, canvasLayout: PROFILE.canvas, buildConfig },
    { meta: metaRows, expiry: expiryRows },
  );
}
