import { ui_createElement } from "frontend/components/core/builders/createElement";
import { createPillGroup } from "frontend/components/core/builders/pillGroup";
import { baseChartOptions, niceLinearScale, CHART_COLORS } from "frontend/charts/ChartTheme";
import { createLegacyChartPanel, type ChartPanelResult } from "frontend/charts/chartPanel";
import { createZeroLinePlugin } from "frontend/charts/plugins/zeroLinePlugin";
import { OPTIONS_SEMANTIC_COLORS } from "frontend/charts/ChartTheme";
import type { OptionCapture } from "backend/core/db/capture/optionMonitorTypes";
import { FLOW_CHART_PROFILES } from "../chartProfiles";

type VRPWindow = 10 | 20 | 30;

const PROFILE = FLOW_CHART_PROFILES.vrpChart;
const ANNUALIZE = Math.sqrt(252);

// ── Helpers ─────────────────────────────────────────────────────────────────

interface DailySnap {
  date: string;
  atmIV: number | null;
  price: number | null;
}

interface VRPPoint {
  date: string;
  iv: number | null;
  rv: number | null;
  vrp: number | null;
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
      atmIV: snap.atmIV,
      price: snap.underlyingPrice,
    }));
}

/**
 * Compute rolling realized volatility from daily log returns.
 * Returns annualized RV as percentage (to match IV which is already in % form).
 */
function computeVRP(daily: DailySnap[], window: number): VRPPoint[] {
  // Compute daily log returns
  const logReturns: (number | null)[] = [null];
  for (let i = 1; i < daily.length; i++) {
    const prev = daily[i - 1].price;
    const curr = daily[i].price;
    if (prev != null && curr != null && prev > 0) {
      logReturns.push(Math.log(curr / prev));
    } else {
      logReturns.push(null);
    }
  }

  const points: VRPPoint[] = [];
  for (let i = 0; i < daily.length; i++) {
    if (i < window) {
      points.push({
        date: daily[i].date,
        iv: daily[i].atmIV,
        rv: null,
        vrp: null,
      });
      continue;
    }

    // Rolling std dev of log returns over the window
    const windowReturns: number[] = [];
    for (let j = i - window + 1; j <= i; j++) {
      const lr = logReturns[j];
      if (lr != null) windowReturns.push(lr);
    }

    let rv: number | null = null;
    if (windowReturns.length >= window * 0.6) {
      const mean =
        windowReturns.reduce((s, v) => s + v, 0) / windowReturns.length;
      const variance =
        windowReturns.reduce((s, v) => s + (v - mean) ** 2, 0) /
        (windowReturns.length - 1);
      // Annualize and convert to percentage
      rv = Math.sqrt(variance) * ANNUALIZE * 100;
    }

    const iv = daily[i].atmIV;
    const vrp = iv != null && rv != null ? iv - rv : null;

    points.push({ date: daily[i].date, iv, rv, vrp });
  }

  return points;
}

// ── Chart config builder ────────────────────────────────────────────────────

function buildConfig(history: OptionCapture[], window: VRPWindow) {
  const daily = toDailySeries(history);
  const vrpData = computeVRP(daily, window);

  const labels = vrpData.map((p) => {
    const m = parseInt(p.date.substring(5, 7), 10);
    const day = p.date.substring(8, 10);
    return `${m}/${day}`;
  });

  const ivValues = vrpData.map((p) => p.iv);
  const rvValues = vrpData.map((p) => p.rv);
  const vrpValues = vrpData.map((p) => p.vrp);
  const allValues = [...ivValues, ...rvValues].filter(
    (v): v is number => v != null,
  );

  return {
    type: "line" as const,
    data: {
      labels,
      datasets: [
        {
          label: "ATM IV",
          data: ivValues,
          borderColor: OPTIONS_SEMANTIC_COLORS.spot,
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 1,
          tension: 0.3,
          order: 1,
        },
        {
          label: `RV-${window}d`,
          data: rvValues,
          borderColor: CHART_COLORS.warning,
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 1,
          tension: 0.3,
          order: 2,
        },
        {
          label: "VRP",
          data: vrpValues,
          borderColor: "transparent",
          backgroundColor: vrpValues.map((v) =>
            v == null
              ? "transparent"
              : v >= 0
                ? "rgba(32, 169, 69, 0.15)"
                : "rgba(215, 49, 38, 0.15)",
          ),
          borderWidth: 0,
          pointRadius: 0,
          fill: "origin",
          tension: 0.3,
          order: 3,
          yAxisID: "yVRP",
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
          title: { display: true, text: "Volatility %", font: { size: 10 } },
        },
        yVRP: {
          display: false,
          ...niceLinearScale(vrpValues),
        },
      },
    },
    plugins: [createZeroLinePlugin("yVRP")],
  };
}

// ── Public render ───────────────────────────────────────────────────────────

export function renderVRPChart(
  monitorHistory: OptionCapture[],
): ChartPanelResult<OptionCapture[]> {
  let currentWindow: VRPWindow = 20;

  const headerRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;",
  });
  headerRow.appendChild(ui_createElement("div", { styleString: "flex: 1;" }));

  let panelRef: ChartPanelResult<OptionCapture[]> | null = null;

  const pills = createPillGroup<VRPWindow>(
    [
      { label: "10d", value: 10 },
      { label: "20d", value: 20 },
      { label: "30d", value: 30 },
    ],
    20,
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
