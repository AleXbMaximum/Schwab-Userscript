import { baseChartOptions, TIME_X_AXIS, niceLinearScale } from "frontend/charts/ChartTheme";
import { createLegacyChartPanel, type ChartPanelResult } from "frontend/charts/chartPanel";
import { OPTIONS_SEMANTIC_COLORS } from "frontend/charts/ChartTheme";
import type { StatusBandPoint } from "../../types";
import { buildCaptureFrames, type FlowChartData } from "../chartData";
import { FLOW_CHART_PROFILES } from "../chartProfiles";

const PROFILE = FLOW_CHART_PROFILES.statusBand;

function extractPoints(data: FlowChartData): StatusBandPoint[] {
  const frames = buildCaptureFrames(data.meta, data.expiry);
  return frames.map(({ meta, nearestExpiry }) => ({
    time: meta.marketTimeCt,
    spot: meta.underlyingPrice,
    atmIV: nearestExpiry?.atmIV ?? null,
    rr25: nearestExpiry?.rr25 ?? null,
    netGex: nearestExpiry?.totalNetGex ?? 0,
  }));
}

function buildConfig(data: FlowChartData) {
  const points = extractPoints(data);
  const labels = points.map((p) => p.time);

  return {
    type: "line" as const,
    data: {
      labels,
      datasets: [
        {
          label: "Spot",
          data: points.map((p) => p.spot),
          borderColor: OPTIONS_SEMANTIC_COLORS.spot,
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 2,
          yAxisID: "ySpot",
          tension: 0.3,
        },
        {
          label: "ATM IV",
          data: points.map((p) => p.atmIV),
          borderColor: "#D78100",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 1,
          borderDash: [4, 2],
          yAxisID: "yIV",
          tension: 0.3,
        },
        {
          label: "RR25",
          data: points.map((p) => p.rr25),
          borderColor: OPTIONS_SEMANTIC_COLORS.gammaFlip,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 1,
          borderDash: [2, 2],
          yAxisID: "yRR",
          tension: 0.3,
        },
        {
          label: "Net GEX",
          data: points.map((p) => p.netGex),
          borderColor: OPTIONS_SEMANTIC_COLORS.bullish,
          backgroundColor: "rgba(32, 169, 69, 0.1)",
          borderWidth: 1,
          pointRadius: 0,
          fill: true,
          yAxisID: "yGEX",
          tension: 0.3,
        },
      ],
    },
    options: {
      ...baseChartOptions(),
      scales: {
        x: TIME_X_AXIS,
        ySpot: {
          type: "linear" as const,
          position: "left" as const,
          title: { display: true, text: "Spot", font: { size: 10 } },
          grid: { color: "rgba(0,0,0,0.06)" },
          ...niceLinearScale(points.map((p) => p.spot)),
          ticks: { ...niceLinearScale(points.map((p) => p.spot)).ticks },
        },
        yIV: {
          type: "linear" as const,
          position: "right" as const,
          title: { display: true, text: "ATM IV", font: { size: 10 } },
          grid: { display: false },
          ...niceLinearScale(points.map((p) => p.atmIV)),
          ticks: { ...niceLinearScale(points.map((p) => p.atmIV)).ticks },
        },
        yRR: {
          type: "linear" as const,
          position: "right" as const,
          title: { display: false },
          grid: { display: false },
          display: false,
          ...niceLinearScale(points.map((p) => p.rr25)),
          ticks: { ...niceLinearScale(points.map((p) => p.rr25)).ticks },
        },
        yGEX: {
          type: "linear" as const,
          position: "right" as const,
          title: { display: false },
          grid: { display: false },
          display: false,
          ...niceLinearScale(points.map((p) => p.netGex)),
          ticks: { ...niceLinearScale(points.map((p) => p.netGex)).ticks },
        },
      },
    },
  };
}

export function renderStatusBand(
  metaRows: FlowChartData["meta"],
  expiryRows: FlowChartData["expiry"],
): ChartPanelResult<FlowChartData> {
  return createLegacyChartPanel<FlowChartData>(
    { title: PROFILE.title, canvasLayout: PROFILE.canvas, buildConfig },
    { meta: metaRows, expiry: expiryRows },
  );
}
