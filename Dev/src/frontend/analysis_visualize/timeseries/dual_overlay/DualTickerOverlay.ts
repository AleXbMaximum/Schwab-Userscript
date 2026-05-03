import { ui_createElement } from "../../../components/core/builders/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY, DS_BUTTONS } from "../../../components/core/styles/theme";
import { createPillGroup } from "../../../components/core/builders/pillGroup";
import { chartManager } from "frontend/charts/ChartManager";
import {
  CHART_COLORS,
  CHART_TOOLTIP_CONFIG,
  baseChartOptions,
  niceLinearScale,
  yAxis,
  TIME_X_AXIS,
} from "frontend/charts/ChartTheme";
import type { ChartDataService } from "../../../../backend/core/network/chart/ChartDataService";
import type { ChartInterval } from "../../../../shared/types/chartData";
import type { OHLCVBar } from "shared/types/chartData";

export type DualTickerOverlayResult = HTMLElement & {
  cleanup?: () => void;
};

const INTERVAL_OPTIONS: { label: string; value: ChartInterval }[] = [
  { label: "1D", value: "1d" },
  { label: "1H", value: "1h" },
  { label: "15m", value: "15m" },
];

const RANGE_OPTIONS: { label: string; value: string }[] = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
];

export function renderDualTickerOverlay(config: {
  chartDataService: ChartDataService;
  defaultSymbol1?: string;
  defaultSymbol2?: string;
}): DualTickerOverlayResult {
  let isDestroyed = false;
  let fetchId = 0;
  let isLoading = false;
  let currentInterval: ChartInterval = "1d";
  let currentRange = "3mo";

  const panel = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as DualTickerOverlayResult;

  // Header
  panel.appendChild(
    ui_createElement("h3", {
      text: "Dual Ticker Overlay",
      styleString:
        DS_TYPOGRAPHY.panelTitle + " margin-bottom: 0; flex-shrink: 0;",
    }),
  );
  panel.appendChild(
    ui_createElement("div", {
      text: "Compare two tickers on the same time axis",
      styleString: DS_TYPOGRAPHY.panelDesc,
    }),
  );

  // Input row: two symbol inputs + interval + range + load button
  const inputRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;",
  });

  const inputStyle =
    "padding: 3px 8px; font-size: var(--ax-fs-sm); border-radius: 6px;" +
    " border: 1px solid var(--ax-border-strong); background: var(--ax-bg-input);" +
    " color: inherit; width: 70px; text-transform: uppercase; outline: none;" +
    " font-family: inherit;";

  const input1 = document.createElement("input");
  input1.type = "text";
  input1.placeholder = "Ticker 1";
  input1.value = config.defaultSymbol1 || "";
  input1.style.cssText = inputStyle;

  const input2 = document.createElement("input");
  input2.type = "text";
  input2.placeholder = "Ticker 2";
  input2.value = config.defaultSymbol2 || "$SPX";
  input2.style.cssText = inputStyle;

  inputRow.appendChild(input1);
  inputRow.appendChild(input2);

  // Interval pills
  const intervalPills = createPillGroup<ChartInterval>(
    INTERVAL_OPTIONS,
    currentInterval,
    (value) => {
      currentInterval = value;
    },
  );
  inputRow.appendChild(intervalPills.element);

  // Range pills
  const rangePills = createPillGroup<string>(
    RANGE_OPTIONS,
    currentRange,
    (value) => {
      currentRange = value;
    },
  );
  inputRow.appendChild(rangePills.element);

  // Load button
  const loadBtn = ui_createElement("button", {
    text: "Load",
    styleString:
      DS_BUTTONS.primary +
      " padding: 3px 14px; font-size: 10px; border-radius: 8px;",
  }) as HTMLButtonElement;
  loadBtn.addEventListener("click", () => {
    if (!isLoading) loadAndRender();
  });
  inputRow.appendChild(loadBtn);

  panel.appendChild(inputRow);

  // Status line
  const statusEl = ui_createElement("div", {
    text: "",
    styleString:
      "font-size: 10px; color: var(--ios-text-secondary, #8e8e93); min-height: 14px; margin-bottom: 4px;",
  });
  panel.appendChild(statusEl);

  // Idle placeholder
  const idleEl = ui_createElement("div", {
    text: 'Enter two tickers and click "Load" to compare.',
    styleString:
      "text-align: center; padding: 40px 0; font-size: 12px;" +
      " color: var(--ios-text-secondary, #8e8e93);",
  });

  // Canvas wrapper
  const canvasWrap = document.createElement("div");
  canvasWrap.style.cssText =
    "position: relative; width: 100%; height: clamp(220px, 45vh, 360px); display: none;";
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position: absolute; inset: 0; width: 100%; height: 100%;";
  canvasWrap.appendChild(canvas);

  panel.appendChild(idleEl);
  panel.appendChild(canvasWrap);

  function setLoadingState(loading: boolean) {
    isLoading = loading;
    loadBtn.disabled = loading;
    loadBtn.textContent = loading ? "Loading..." : "Load";
  }

  function buildChartConfig(
    sym1: string,
    bars1: OHLCVBar[],
    sym2: string,
    bars2: OHLCVBar[],
  ) {
    // Build date-indexed maps for each series
    const map1 = new Map<string, number>();
    for (const b of bars1) map1.set(b.date, b.close);
    const map2 = new Map<string, number>();
    for (const b of bars2) map2.set(b.date, b.close);

    // Union of all dates, sorted
    const allDatesSet = new Set<string>();
    for (const d of map1.keys()) allDatesSet.add(d);
    for (const d of map2.keys()) allDatesSet.add(d);
    const allDates = Array.from(allDatesSet).sort();

    // Downsample if too many points
    const maxPoints = 1500;
    let dates = allDates;
    if (dates.length > maxPoints) {
      const step = Math.ceil(dates.length / maxPoints);
      const sampled: string[] = [];
      for (let i = 0; i < dates.length; i += step) sampled.push(dates[i]);
      const last = dates[dates.length - 1];
      if (sampled[sampled.length - 1] !== last) sampled.push(last);
      dates = sampled;
    }

    const data1 = dates.map((d) => map1.get(d) ?? null);
    const data2 = dates.map((d) => map2.get(d) ?? null);

    const vals1 = data1.filter((v): v is number => v != null);
    const vals2 = data2.filter((v): v is number => v != null);

    const scale1 = niceLinearScale(vals1, { padding: 0.02 });
    const scale2 = niceLinearScale(vals2, { padding: 0.02 });

    const palette = CHART_COLORS.categorical;

    return {
      type: "line" as const,
      data: {
        labels: dates,
        datasets: [
          {
            label: sym1,
            data: data1,
            yAxisID: "y",
            borderColor: palette[0],
            backgroundColor: palette[0],
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 2,
            borderWidth: 1.5,
            spanGaps: true,
            fill: false,
          },
          {
            label: sym2,
            data: data2,
            yAxisID: "y2",
            borderColor: palette[1],
            backgroundColor: palette[1],
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 2,
            borderWidth: 1.5,
            spanGaps: true,
            fill: false,
          },
        ],
      },
      options: {
        ...baseChartOptions(),
        scales: {
          x: {
            ...TIME_X_AXIS,
            ticks: {
              ...TIME_X_AXIS.ticks,
              maxTicksLimit: 12,
              callback: function (_value: any, index: number) {
                const raw = dates[index];
                if (!raw) return "";
                const d = new Date(raw);
                if (isNaN(d.getTime())) return raw;
                return d.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              },
              autoSkip: true,
            },
          },
          y: {
            ...yAxis(sym1),
            ...scale1,
            position: "left" as const,
            ticks: { ...scale1.ticks, color: palette[0], font: { size: 10 } },
          },
          y2: {
            ...yAxis(sym2),
            ...scale2,
            position: "right" as const,
            grid: { drawOnChartArea: false },
            ticks: { ...scale2.ticks, color: palette[1], font: { size: 10 } },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "top" as const,
            labels: {
              font: { size: 10 },
              boxWidth: 12,
              padding: 8,
              usePointStyle: true,
            },
          },
          tooltip: {
            ...CHART_TOOLTIP_CONFIG,
            callbacks: {
              label: (ctx: any) => {
                const v = ctx.parsed?.y;
                return v != null ? `${ctx.dataset.label}: ${v.toFixed(2)}` : "";
              },
            },
          },
        },
      },
    };
  }

  async function loadAndRender() {
    const sym1 = input1.value.trim().toUpperCase();
    const sym2 = input2.value.trim().toUpperCase();
    if (!sym1 || !sym2) {
      statusEl.textContent = "Please enter two ticker symbols.";
      return;
    }

    const thisId = ++fetchId;
    setLoadingState(true);
    statusEl.textContent = `Fetching ${sym1} and ${sym2} (${currentInterval}, ${currentRange})...`;

    if (idleEl.parentNode) idleEl.parentNode.removeChild(idleEl);
    chartManager.destroy(canvas);
    canvasWrap.style.display = "none";

    try {
      const [result1, result2] = await Promise.all([
        config.chartDataService.fetch({
          symbol: sym1,
          interval: currentInterval,
          window: { kind: "range", range: currentRange },
        }),
        config.chartDataService.fetch({
          symbol: sym2,
          interval: currentInterval,
          window: { kind: "range", range: currentRange },
        }),
      ]);
      if (isDestroyed || thisId !== fetchId) return;

      const bars1 = result1.bars;
      const bars2 = result2.bars;

      const source1 = result1.meta.source;
      const source2 = result2.meta.source;

      if (bars1.length === 0 && bars2.length === 0) {
        statusEl.textContent = `No data returned for either ${sym1} or ${sym2}.`;
        return;
      }

      // Find date overlap stats
      const dates1 = new Set(bars1.map((b) => b.date));
      const dates2 = new Set(bars2.map((b) => b.date));
      let overlap = 0;
      for (const d of dates1) if (dates2.has(d)) overlap++;

      statusEl.textContent =
        `${sym1}: ${bars1.length} bars (${source1}) · ` +
        `${sym2}: ${bars2.length} bars (${source2}) · ` +
        `${overlap} dates aligned`;

      canvasWrap.style.display = "";
      const chartConfig = buildChartConfig(sym1, bars1, sym2, bars2);
      chartManager.destroy(canvas);
      chartManager.createOrUpdate(canvas, chartConfig);
    } catch (err) {
      if (isDestroyed || thisId !== fetchId) return;
      statusEl.textContent = `Error: ${(err as Error)?.message || "Unknown error"}`;
    } finally {
      if (thisId === fetchId) setLoadingState(false);
    }
  }

  panel.cleanup = () => {
    isDestroyed = true;
    chartManager.destroy(canvas);
  };

  return panel;
}
