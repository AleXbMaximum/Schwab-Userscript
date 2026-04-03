import { ui_createElement } from "frontend/components/core/createElement";
import { createPillGroup } from "frontend/components/core/pillGroup";
import { baseChartOptions, niceLinearScale } from "frontend/charts/ChartTheme";
import { createLegacyChartPanel, type ChartPanelResult } from "frontend/charts/chartPanel";
import { createZeroLinePlugin } from "frontend/charts/plugins/zeroLinePlugin";
import { OPTIONS_SEMANTIC_COLORS } from "frontend/charts/ChartTheme";
import type { OptionCapture } from "backend/core/db/capture/optionMonitorTypes";
import { FLOW_CHART_PROFILES } from "../chartProfiles";

type LookforwardWindow = 5 | 10 | 20;

const PROFILE = FLOW_CHART_PROFILES.impliedVsRealized;

// ── Helpers ─────────────────────────────────────────────────────────────────

interface DailySnap {
  date: string;
  impliedMovePct: number | null;
  price: number | null;
}

interface CalibrationPoint {
  date: string;
  impliedPct: number;
  realizedPct: number;
  ratio: number; // realized / implied
}

function toDailySeries(history: OptionCapture[]): DailySnap[] {
  const byDate = new Map<string, OptionCapture>();
  for (const snap of history) {
    const date = snap.capturedAt.substring(0, 10);
    const existing = byDate.get(date);
    if (!existing || existing.capturedAt < snap.capturedAt) {
      byDate.set(date, snap);
    }
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, snap]) => ({
      date,
      impliedMovePct: snap.impliedMovePct,
      price: snap.underlyingPrice,
    }));
}

function computeCalibration(
  daily: DailySnap[],
  lookforward: number,
): CalibrationPoint[] {
  const points: CalibrationPoint[] = [];
  // For each date, compare impliedMovePct with actual realized move over lookforward days
  for (let i = 0; i < daily.length - lookforward; i++) {
    const snap = daily[i];
    const futureSnap = daily[i + lookforward];
    if (
      snap.impliedMovePct == null ||
      snap.price == null ||
      futureSnap.price == null ||
      snap.price === 0
    ) {
      continue;
    }
    const realizedPct =
      Math.abs((futureSnap.price - snap.price) / snap.price) * 100;
    const impliedPct = Math.abs(snap.impliedMovePct);
    if (impliedPct === 0) continue;

    points.push({
      date: snap.date,
      impliedPct,
      realizedPct,
      ratio: realizedPct / impliedPct,
    });
  }
  return points;
}

// ── Chart config builder ────────────────────────────────────────────────────

function buildConfig(
  history: OptionCapture[],
  lookforward: LookforwardWindow,
) {
  const daily = toDailySeries(history);
  const calibration = computeCalibration(daily, lookforward);

  const labels = calibration.map((p) => {
    const m = parseInt(p.date.substring(5, 7), 10);
    const day = p.date.substring(8, 10);
    return `${m}/${day}`;
  });

  const impliedData = calibration.map((p) => p.impliedPct);
  const realizedData = calibration.map((p) => p.realizedPct);
  const allValues = [...impliedData, ...realizedData];

  return {
    type: "bar" as const,
    data: {
      labels,
      datasets: [
        {
          label: `Implied Move (${lookforward}d)`,
          data: impliedData,
          backgroundColor: "rgba(0, 122, 255, 0.5)",
          borderColor: OPTIONS_SEMANTIC_COLORS.spot,
          borderWidth: 1,
          borderRadius: 2,
        },
        {
          label: "Realized Move",
          data: realizedData,
          backgroundColor: calibration.map((p) =>
            p.realizedPct > p.impliedPct
              ? OPTIONS_SEMANTIC_COLORS.fillNegative
              : OPTIONS_SEMANTIC_COLORS.fillPositive,
          ),
          borderColor: calibration.map((p) =>
            p.realizedPct > p.impliedPct
              ? OPTIONS_SEMANTIC_COLORS.bearish
              : OPTIONS_SEMANTIC_COLORS.bullish,
          ),
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    },
    options: {
      ...baseChartOptions(),
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 10 },
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 12,
          },
        },
        y: {
          ...niceLinearScale(allValues),
          grid: { color: "rgba(0,0,0,0.06)" },
          title: { display: true, text: "Move %", font: { size: 10 } },
        },
      },
    },
    plugins: [createZeroLinePlugin()],
  };
}

// ── Public render ───────────────────────────────────────────────────────────

export function renderImpliedVsRealized(
  monitorHistory: OptionCapture[],
): ChartPanelResult<OptionCapture[]> {
  let currentWindow: LookforwardWindow = 5;

  const headerRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;",
  });
  headerRow.appendChild(ui_createElement("div", { styleString: "flex: 1;" }));

  let panelRef: ChartPanelResult<OptionCapture[]> | null = null;

  const pills = createPillGroup<LookforwardWindow>(
    [
      { label: "5d", value: 5 },
      { label: "10d", value: 10 },
      { label: "20d", value: 20 },
    ],
    5,
    (value) => {
      currentWindow = value;
      if (panelRef?.update) panelRef.update(currentData);
    },
  );
  headerRow.appendChild(pills.element);

  let currentData = monitorHistory;

  const panel = createLegacyChartPanel<OptionCapture[]>(
    {
      title: PROFILE.title,
      headerContent: headerRow,
      destroyOnUpdate: true,
      canvasLayout: PROFILE.canvas,
      buildConfig: (data) => buildConfig(data, currentWindow),
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
