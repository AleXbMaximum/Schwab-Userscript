import { ui_createElement } from "frontend/components/core/builders/createElement";
import { createPillGroup } from "frontend/components/core/builders/pillGroup";
import { baseChartOptions, niceLinearScale, CHART_COLORS } from "frontend/charts/ChartTheme";
import { createLegacyChartPanel, type ChartPanelResult } from "frontend/charts/chartPanel";
import { createReferenceLinePlugin } from "frontend/charts/plugins/referenceLinePlugin";
import { isDarkTheme } from "frontend/components/core/axTheme";
import { OPTIONS_SEMANTIC_COLORS } from "frontend/charts/ChartTheme";
import type { OptionCapture } from "backend/core/db/capture/optionMonitorTypes";
import { FLOW_CHART_PROFILES } from "../chartProfiles";

type PCMode = "volume" | "oi";

const PROFILE = FLOW_CHART_PROFILES.pcRatioMomentum;

// ── Helpers ─────────────────────────────────────────────────────────────────

interface DailyPC {
  date: string;
  pcVolume: number | null;
  pcOI: number | null;
}

/** Deduplicate to one snapshot per date (last captured). */
function toDailySeries(history: OptionCapture[]): DailyPC[] {
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
      pcVolume: snap.pcRatioVolume,
      pcOI: snap.pcRatioOI,
    }));
}

/** Simple moving average, preserving null for the leading window. */
function sma(values: (number | null)[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const v = values[j];
      if (v != null) {
        sum += v;
        count++;
      }
    }
    result.push(count >= window * 0.6 ? sum / count : null);
  }
  return result;
}

// ── Chart config builder ────────────────────────────────────────────────────

function buildConfig(history: OptionCapture[], mode: PCMode) {
  const daily = toDailySeries(history);
  const labels = daily.map((d) => {
    const m = parseInt(d.date.substring(5, 7), 10);
    const day = d.date.substring(8, 10);
    return `${m}/${day}`;
  });
  const raw = daily.map((d) => (mode === "volume" ? d.pcVolume : d.pcOI));
  const sma5 = sma(raw, 5);
  const sma20 = sma(raw, 20);

  return {
    type: "line" as const,
    data: {
      labels,
      datasets: [
        {
          label: mode === "volume" ? "P/C Vol" : "P/C OI",
          data: raw,
          borderColor: OPTIONS_SEMANTIC_COLORS.spot,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 2,
          tension: 0.3,
        },
        {
          label: "SMA-5",
          data: sma5,
          borderColor: CHART_COLORS.success,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 0,
          borderDash: [4, 2],
          tension: 0.3,
        },
        {
          label: "SMA-20",
          data: sma20,
          borderColor: CHART_COLORS.warning,
          backgroundColor: "transparent",
          borderWidth: 1.5,
          pointRadius: 0,
          borderDash: [6, 3],
          tension: 0.3,
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
          ...niceLinearScale(raw),
          grid: {
            color: isDarkTheme()
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.06)",
          },
          title: { display: true, text: "P/C Ratio", font: { size: 10 } },
        },
      },
    },
    plugins: [
      createReferenceLinePlugin(1.0, "y", {
        dash: [3, 3],
      }),
    ],
  };
}

// ── Public render ───────────────────────────────────────────────────────────

export function renderPCRatioMomentum(
  monitorHistory: OptionCapture[],
): ChartPanelResult<OptionCapture[]> {
  let currentMode: PCMode = "volume";

  const headerRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;",
  });
  headerRow.appendChild(ui_createElement("div", { styleString: "flex: 1;" }));

  let panelRef: ChartPanelResult<OptionCapture[]> | null = null;

  const pills = createPillGroup<PCMode>(
    [
      { label: "Volume", value: "volume" },
      { label: "OI", value: "oi" },
    ],
    "volume",
    (value) => {
      currentMode = value;
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
