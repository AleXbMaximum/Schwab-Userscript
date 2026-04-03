import { ui_createElement } from "frontend/components/core/createElement";
import { createPillGroup } from "frontend/components/core/pillGroup";
import { baseChartOptions, TIME_X_AXIS, yAxis } from "frontend/charts/ChartTheme";
import { createLegacyChartPanel, type ChartPanelResult } from "frontend/charts/chartPanel";
import { createZeroLinePlugin } from "frontend/charts/plugins/zeroLinePlugin";
import { OPTIONS_SEMANTIC_COLORS } from "frontend/charts/ChartTheme";
import type { FlowIncrementPoint } from "../../types";
import {
  alignDualAxisAtZero,
  buildCaptureFrames,
  type FlowChartData,
} from "../chartData";
import { FLOW_CHART_PROFILES } from "../chartProfiles";

type FlowMode = "callput" | "net";
const PROFILE = FLOW_CHART_PROFILES.flowIncrement;

function extractPoints(data: FlowChartData): FlowIncrementPoint[] {
  const frames = buildCaptureFrames(data.meta, data.expiry);
  const points: FlowIncrementPoint[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const nearest = frame.nearestExpiry;

    if (i === 0 || !nearest) {
      points.push({
        time: frame.meta.marketTimeCt,
        deltaCallVol: null,
        deltaPutVol: null,
        deltaPCRatio: null,
      });
      continue;
    }

    const prevNearest = frames[i - 1].nearestExpiry;

    points.push({
      time: frame.meta.marketTimeCt,
      deltaCallVol: prevNearest
        ? nearest.totalCallVolume - prevNearest.totalCallVolume
        : null,
      deltaPutVol: prevNearest
        ? nearest.totalPutVolume - prevNearest.totalPutVolume
        : null,
      deltaPCRatio:
        prevNearest?.pcRatioVolume != null && nearest.pcRatioVolume != null
          ? nearest.pcRatioVolume - prevNearest.pcRatioVolume
          : null,
    });
  }

  return points;
}

function buildFlowConfig(data: FlowChartData, mode: FlowMode) {
  const points = extractPoints(data);
  const labels = points.map((p) => p.time);

  const pcLineDataset = {
    label: "Delta P/C",
    data: points.map((p) => p.deltaPCRatio),
    type: "line" as const,
    borderColor: OPTIONS_SEMANTIC_COLORS.spot,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    pointRadius: 2,
    yAxisID: "yPC",
    order: 1,
    tension: 0.3,
  };

  const yPC: any = {
    type: "linear" as const,
    position: "right" as const,
    grid: { display: false },
    title: { display: true, text: "Delta P/C", font: { size: 10 } },
  };

  const pcValues = points.map((p) => p.deltaPCRatio);

  if (mode === "net") {
    const netData = points.map((p) => {
      if (p.deltaCallVol == null && p.deltaPutVol == null) return null;
      return (p.deltaCallVol ?? 0) - Math.abs(p.deltaPutVol ?? 0);
    });

    const aligned = alignDualAxisAtZero(netData, pcValues);
    const yScale: any = yAxis("Net Volume Delta");
    if (aligned) {
      yScale.min = aligned.aMin;
      yScale.max = aligned.aMax;
      yPC.min = aligned.bMin;
      yPC.max = aligned.bMax;
    }

    return {
      type: "bar" as const,
      data: {
        labels,
        datasets: [
          {
            label: "Net Flow",
            data: netData,
            backgroundColor: netData.map((v) =>
              v == null
                ? "transparent"
                : v >= 0
                  ? OPTIONS_SEMANTIC_COLORS.fillPositive
                  : OPTIONS_SEMANTIC_COLORS.fillNegative,
            ),
            borderColor: netData.map((v) =>
              v == null
                ? "transparent"
                : v >= 0
                  ? OPTIONS_SEMANTIC_COLORS.bullish
                  : OPTIONS_SEMANTIC_COLORS.bearish,
            ),
            borderWidth: 1,
            borderRadius: 2,
            order: 2,
          },
          pcLineDataset,
        ],
      },
      options: {
        ...baseChartOptions(),
        scales: { x: TIME_X_AXIS, y: yScale, yPC },
      },
      plugins: [createZeroLinePlugin()],
    };
  }

  const callData = points.map((p) => p.deltaCallVol);
  const putData = points.map((p) =>
    p.deltaPutVol != null ? -Math.abs(p.deltaPutVol) : null,
  );
  const allVolData = [...callData, ...putData];

  const aligned = alignDualAxisAtZero(allVolData, pcValues);
  const yScale: any = { stacked: true, ...yAxis("Volume Delta") };
  if (aligned) {
    yScale.min = aligned.aMin;
    yScale.max = aligned.aMax;
    yPC.min = aligned.bMin;
    yPC.max = aligned.bMax;
  }

  return {
    type: "bar" as const,
    data: {
      labels,
      datasets: [
        {
          label: "Delta Call Vol",
          data: callData,
          backgroundColor: OPTIONS_SEMANTIC_COLORS.fillPositive,
          borderColor: OPTIONS_SEMANTIC_COLORS.bullish,
          borderWidth: 1,
          borderRadius: 2,
          stack: "vol",
          order: 2,
        },
        {
          label: "Delta Put Vol",
          data: putData,
          backgroundColor: OPTIONS_SEMANTIC_COLORS.fillNegative,
          borderColor: OPTIONS_SEMANTIC_COLORS.bearish,
          borderWidth: 1,
          borderRadius: 2,
          stack: "vol",
          order: 2,
        },
        pcLineDataset,
      ],
    },
    options: {
      ...baseChartOptions(),
      scales: {
        x: { stacked: true, ...TIME_X_AXIS },
        y: yScale,
        yPC,
      },
    },
    plugins: [createZeroLinePlugin()],
  };
}

export function renderFlowIncrement(
  metaRows: FlowChartData["meta"],
  expiryRows: FlowChartData["expiry"],
): ChartPanelResult<FlowChartData> {
  let currentMode: FlowMode = "net";

  const headerRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;",
  });
  headerRow.appendChild(ui_createElement("div", { styleString: "flex: 1;" }));

  let panelRef: ChartPanelResult<FlowChartData> | null = null;

  const pills = createPillGroup<FlowMode>(
    [
      { label: "Call&Put", value: "callput" },
      { label: "Net", value: "net" },
    ],
    "net",
    (value) => {
      currentMode = value;
      if (panelRef?.update) panelRef.update(currentData);
    },
  );
  headerRow.appendChild(pills.element);

  let currentData: FlowChartData = { meta: metaRows, expiry: expiryRows };

  const panel = createLegacyChartPanel<FlowChartData>(
    {
      title: PROFILE.title,
      headerContent: headerRow,
      destroyOnUpdate: true,
      canvasLayout: PROFILE.canvas,
      buildConfig: (data) => buildFlowConfig(data, currentMode),
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
