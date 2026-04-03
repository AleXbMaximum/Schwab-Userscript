import { ui_createElement } from "frontend/components/core/createElement";
import { createPillGroup } from "frontend/components/core/pillGroup";
import { baseChartOptions, TIME_X_AXIS, yAxis, niceLinearScale } from "frontend/charts/ChartTheme";
import { createLegacyChartPanel, type ChartPanelResult } from "frontend/charts/chartPanel";
import { OPTIONS_SEMANTIC_COLORS } from "frontend/charts/ChartTheme";
import type { KeyLevelsPoint } from "../../types";
import {
  buildCaptureFrames,
  firstFinitePositive,
  type FlowChartData,
} from "../chartData";
import { FLOW_CHART_PROFILES } from "../chartProfiles";

type KeyLevelsMode = "pct" | "dollar";
const PROFILE = FLOW_CHART_PROFILES.keyLevels;

function extractPoints(data: FlowChartData): KeyLevelsPoint[] {
  const frames = buildCaptureFrames(data.meta, data.expiry);
  const baseSpot = firstFinitePositive(
    frames.map((frame) => frame.meta.underlyingPrice),
  );

  return frames.map(({ meta, nearestExpiry }) => {
    const spot = meta.underlyingPrice;

    const pctLevel = (level: number | null) =>
      level != null && baseSpot != null && baseSpot > 0
        ? (level / baseSpot) * 100
        : null;

    const callWallPrice = nearestExpiry?.callWallOIStrike ?? null;
    const putWallPrice = nearestExpiry?.putWallGexStrike ?? null;
    const gammaFlipPrice = nearestExpiry?.gammaFlip ?? null;
    const maxPainPrice = nearestExpiry?.maxPain ?? null;

    return {
      time: meta.marketTimeCt,
      spot,
      spotPct: pctLevel(spot),
      callWallPrice,
      putWallPrice,
      gammaFlipPrice,
      maxPainPrice,
      callWallPct: pctLevel(callWallPrice),
      putWallPct: pctLevel(putWallPrice),
      gammaFlipPct: pctLevel(gammaFlipPrice),
      maxPainPct: pctLevel(maxPainPrice),
    };
  });
}

function buildConfig(data: FlowChartData, mode: KeyLevelsMode) {
  const points = extractPoints(data);
  const labels = points.map((p) => p.time);
  const isPct = mode === "pct";

  const callData = points.map((p) => (isPct ? p.callWallPct : p.callWallPrice));
  const putData = points.map((p) => (isPct ? p.putWallPct : p.putWallPrice));
  const gammaData = points.map((p) =>
    isPct ? p.gammaFlipPct : p.gammaFlipPrice,
  );
  const painData = points.map((p) => (isPct ? p.maxPainPct : p.maxPainPrice));

  const datasets: any[] = [
    {
      label: "Call Wall",
      data: callData,
      borderColor: OPTIONS_SEMANTIC_COLORS.callWall,
      borderWidth: 1.5,
      pointRadius: 2,
      tension: 0.3,
    },
    {
      label: "Put Wall",
      data: putData,
      borderColor: OPTIONS_SEMANTIC_COLORS.putWall,
      borderWidth: 1.5,
      pointRadius: 2,
      tension: 0.3,
    },
    {
      label: "Gamma Flip",
      data: gammaData,
      borderColor: OPTIONS_SEMANTIC_COLORS.gammaFlip,
      borderWidth: 1.5,
      pointRadius: 2,
      borderDash: [4, 2],
      tension: 0.3,
    },
    {
      label: "Max Pain",
      data: painData,
      borderColor: OPTIONS_SEMANTIC_COLORS.maxPain,
      borderWidth: 1.5,
      pointRadius: 2,
      borderDash: [2, 2],
      tension: 0.3,
    },
    {
      label: "Spot",
      data: points.map((p) => (isPct ? p.spotPct : p.spot)),
      borderColor: OPTIONS_SEMANTIC_COLORS.spot,
      backgroundColor: "transparent",
      borderWidth: 1.5,
      pointRadius: 2,
      tension: 0.3,
      order: 1,
    },
  ];

  const allValues = [
    ...callData,
    ...putData,
    ...gammaData,
    ...painData,
    ...points.map((p) => (isPct ? p.spotPct : p.spot)),
  ];

  return {
    type: "line" as const,
    data: { labels, datasets },
    options: {
      ...baseChartOptions(),
      scales: {
        x: TIME_X_AXIS,
        y: {
          ...yAxis(isPct ? "% of First Spot" : "Price"),
          ...niceLinearScale(allValues),
          ticks: {
            ...niceLinearScale(allValues).ticks,
          },
        },
      },
    },
  };
}

export function renderKeyLevelsChart(
  metaRows: FlowChartData["meta"],
  expiryRows: FlowChartData["expiry"],
): ChartPanelResult<FlowChartData> {
  let currentMode: KeyLevelsMode = "dollar";

  const headerRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;",
  });
  headerRow.appendChild(
    ui_createElement("div", {
      text: "Source expiry: nearest (min DTE) per snapshot. Gamma/GEX basis: MID. % mode uses first valid spot as 100.",
      styleString:
        "flex: 1; font-size: 10px; color: var(--ios-text-secondary);",
    }),
  );

  let panelRef: ChartPanelResult<FlowChartData> | null = null;
  let currentData: FlowChartData = { meta: metaRows, expiry: expiryRows };

  const pills = createPillGroup<KeyLevelsMode>(
    [
      { label: "$", value: "dollar" },
      { label: "%", value: "pct" },
    ],
    "dollar",
    (value) => {
      currentMode = value;
      if (panelRef?.update) panelRef.update(currentData);
    },
  );
  headerRow.appendChild(pills.element);

  const panel = createLegacyChartPanel<FlowChartData>(
    {
      title: PROFILE.title,
      headerContent: headerRow,
      destroyOnUpdate: true,
      canvasLayout: PROFILE.canvas,
      buildConfig: (data) => buildConfig(data, currentMode),
    },
    currentData,
  );

  panelRef = panel;

  const originalUpdate = panel.update;
  panel.update = (data) => {
    currentData = data;
    originalUpdate?.(data);
  };

  return panel;
}
