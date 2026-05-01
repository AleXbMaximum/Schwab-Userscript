import { ui_createElement } from "../../../components/core/createElement";
import {
  DS_COMPONENTS,
  DS_TYPOGRAPHY,
  DS_BUTTONS,
} from "../../../components/core/theme";
import { createPillGroup } from "../../../components/core/pillGroup";
import { chartManager } from "frontend/charts/ChartManager";
import {
  CHART_COLORS,
  CHART_TOOLTIP_CONFIG,
  baseChartOptions,
  niceLinearScale,
  yAxis,
  TIME_X_AXIS,
} from "frontend/charts/ChartTheme";
import { createReferenceLinePlugin } from "frontend/charts/plugins/referenceLinePlugin";
import {
  BetaService,
  type RollingMode,
  type RollingProgressEvent,
} from "../../../../backend/pipeline/beta/BetaService";
import type { RollingBetaPoint } from "../../../../backend/computation/beta/types";
import {
  DEFAULT_INDICATORS,
  loadMovingBetaAxes,
  saveMovingBetaAxes,
} from "./MovingBetaStorage";
import {
  createMovingBetaAxisSections,
  type MovingBetaAxisState,
} from "./MovingBetaControls";

export type MovingBetaChartResult = HTMLElement & {
  cleanup?: () => void;
  update?: (symbols: string[]) => void;
};

type ChartMode = "beta" | "correlation";

// ── Component ────────────────────────────────────────────────────────────────

export function renderMovingBetaChart(config: {
  betaService: BetaService;
  symbols: string[];
  currentBenchmark?: string;
}): MovingBetaChartResult {
  let currentWindow: RollingMode = "daily";
  let currentMode: ChartMode = "beta";
  let isDestroyed = false;
  let fetchId = 0;
  let isLoading = false;

  // Cached rolling data for instant mode switching
  let cachedData: Map<string, RollingBetaPoint[]> | null = null;

  // ── Axis state ──────────────────────────────────────────────────────────

  const axisState: MovingBetaAxisState = {
    watchlistTickers: [...config.symbols],
    indicatorTickers: [...DEFAULT_INDICATORS],
    selectedBenchmark: DEFAULT_INDICATORS[0] || "$SPX",
  };

  const panel = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as MovingBetaChartResult;

  // ── Header ─────────────────────────────────────────────────────────────

  panel.appendChild(
    ui_createElement("h3", {
      text: "Moving Beta / Correlation",
      styleString:
        DS_TYPOGRAPHY.panelTitle + " margin-bottom: 0; flex-shrink: 0;",
    }),
  );
  const descEl = ui_createElement("div", {
    text: `Rolling beta vs ${axisState.selectedBenchmark} over time`,
    styleString: DS_TYPOGRAPHY.panelDesc,
  });
  panel.appendChild(descEl);

  function updateDescription(): void {
    const metricLabel = currentMode === "beta" ? "beta" : "correlation";
    descEl.textContent = `Rolling ${metricLabel} vs ${axisState.selectedBenchmark} over time`;
  }

  // ── Controls row ───────────────────────────────────────────────────────

  const controlsRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;",
  });

  const windowPills = createPillGroup<RollingMode>(
    [
      { label: "2Y Hourly (1h)", value: "daily" },
      { label: "60D Intraday (5m)", value: "intraday" },
    ],
    "daily",
    (mode) => {
      currentWindow = mode;
    },
  );
  controlsRow.appendChild(windowPills.element);

  // Load button
  const loadBtn = ui_createElement("button", {
    text: "Load",
    styleString:
      DS_BUTTONS.primary +
      " padding: 3px 14px; font-size: 10px; border-radius: 8px; flex-shrink: 0;",
  }) as HTMLButtonElement;
  loadBtn.addEventListener("click", () => {
    if (!isLoading) loadAndRender();
  });
  controlsRow.appendChild(loadBtn);

  const modePills = createPillGroup<ChartMode>(
    [
      { label: "Beta", value: "beta" },
      { label: "Correlation", value: "correlation" },
    ],
    "beta",
    (mode) => {
      currentMode = mode;
      updateDescription();
      renderFromCache();
    },
  );
  controlsRow.appendChild(modePills.element);

  panel.appendChild(controlsRow);

  // ── Axis sections ──────────────────────────────────────────────────────

  const axisSections = createMovingBetaAxisSections(
    axisState,
    {
      onSave: () =>
        saveMovingBetaAxes(
          axisState.watchlistTickers,
          axisState.indicatorTickers,
        ),
      onBenchmarkChange: () => updateDescription(),
    },
    DS_BUTTONS.primary,
  );

  panel.appendChild(axisSections.watchlistSection.container);
  panel.appendChild(axisSections.indicatorSection.container);

  // Kick off async load from IndexedDB
  loadMovingBetaAxes(config.symbols)
    .then((result) => {
      if (isDestroyed) return;

      const changed =
        JSON.stringify(result.watchlist) !==
          JSON.stringify(axisState.watchlistTickers) ||
        JSON.stringify(result.indicators) !==
          JSON.stringify(axisState.indicatorTickers);

      if (changed) {
        axisState.watchlistTickers = result.watchlist;
        axisState.indicatorTickers = result.indicators;
        axisState.selectedBenchmark =
          result.indicators[0] || "$SPX";
        updateDescription();
        axisSections.renderAxisTags("watchlist");
        axisSections.renderAxisTags("indicator");
      }
    })
    .catch(() => {
      /* noop — defaults already applied */
    });

  // ── Loading indicator ──────────────────────────────────────────────────

  const loadingEl = ui_createElement("div", {
    styleString:
      "display: flex; flex-direction: column; align-items: center; gap: 8px;" +
      " text-align: center; padding: 24px 0;",
  });
  const loadingSummary = ui_createElement("div", {
    text: "Preparing...",
    styleString: "font-size: 12px; color: var(--ios-text-secondary, #8e8e93);",
  });
  const progressTrack = ui_createElement("div", {
    styleString:
      "width: min(560px, 90%); height: 8px; border-radius: 6px;" +
      " background: var(--ax-bg-glass-inset); overflow: hidden;",
  });
  const progressFill = ui_createElement("div", {
    styleString:
      "height: 100%; width: 0%; border-radius: 6px;" +
      ` background: linear-gradient(90deg, ${CHART_COLORS.info}, ${CHART_COLORS.info}); transition: width 120ms linear;`,
  });
  const loadingMeta = ui_createElement("div", {
    text: "",
    styleString:
      "font-size: 11px; color: var(--ios-text-secondary, #8e8e93); min-height: 14px;",
  });
  const loadingDetail = ui_createElement("div", {
    text: "",
    styleString:
      "font-size: 10px; color: var(--ios-text-secondary, #8e8e93); min-height: 14px;",
  });
  progressTrack.appendChild(progressFill);
  loadingEl.appendChild(loadingSummary);
  loadingEl.appendChild(progressTrack);
  loadingEl.appendChild(loadingMeta);
  loadingEl.appendChild(loadingDetail);

  // Idle placeholder
  const idleEl = ui_createElement("div", {
    text: 'Click "Load" to compute rolling beta / correlation.',
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

  // ── State helpers ──────────────────────────────────────────────────────

  function setLoadingState(loading: boolean): void {
    isLoading = loading;
    loadBtn.disabled = loading;
    loadBtn.textContent = loading ? "Loading..." : "Load";
  }

  function setProgressState(progress: RollingProgressEvent): void {
    const percent = Math.max(0, Math.min(100, progress.percent));
    progressFill.style.width = `${percent}%`;
    loadingSummary.textContent = `${percent}% \u00b7 ${progress.message}`;
    loadingMeta.textContent = `${progress.completed}/${progress.total} steps \u00b7 ${(progress.elapsedMs / 1000).toFixed(1)}s`;

    if (progress.symbol) {
      const pointsTxt =
        typeof progress.points === "number" ? `points: ${progress.points}` : "";
      const barsTxt =
        typeof progress.bars === "number" ? `bars: ${progress.bars}` : "";
      const extra = [barsTxt, pointsTxt].filter(Boolean).join(" \u00b7 ");
      loadingDetail.textContent = extra
        ? `${progress.symbol} \u00b7 ${extra}`
        : progress.symbol;
    } else if (progress.error) {
      loadingDetail.textContent = `Error: ${progress.error}`;
    } else {
      loadingDetail.textContent = "";
    }

    loadBtn.textContent = `Loading ${percent}%`;
  }

  // ── Chart helpers ──────────────────────────────────────────────────────

  function downsampleDates(dates: string[], maxPoints: number): string[] {
    if (dates.length <= maxPoints) return dates;
    const step = Math.max(1, Math.ceil(dates.length / maxPoints));
    const sampled: string[] = [];
    for (let i = 0; i < dates.length; i += step) sampled.push(dates[i]);
    const last = dates[dates.length - 1];
    if (sampled[sampled.length - 1] !== last) sampled.push(last);
    return sampled;
  }

  function collectDateDomain(allData: Map<string, RollingBetaPoint[]>) {
    const nonEmpty = Array.from(allData.values()).filter(
      (points) => points.length > 0,
    );
    if (nonEmpty.length === 0) return { unionDates: [] as string[] };

    const unionSet = new Set<string>();
    for (const points of nonEmpty) {
      for (const p of points) unionSet.add(p.date);
    }
    return { unionDates: Array.from(unionSet).sort() };
  }

  function buildChartConfig(
    allData: Map<string, RollingBetaPoint[]>,
    mode: ChartMode,
  ) {
    const { unionDates } = collectDateDomain(allData);
    const maxPoints = currentWindow === "intraday" ? 1000 : 1800;
    const allDates = downsampleDates(unionDates, maxPoints);

    const isBeta = mode === "beta";
    const datasets: any[] = [];
    const allValues: number[] = [];
    let colorIdx = 0;
    const palette = CHART_COLORS.categorical;

    const firstVisibleSymbol = Array.from(allData.keys())[0] ?? null;

    for (const [symbol, points] of allData) {
      const valueByDate = new Map<string, number>();
      for (const p of points) {
        valueByDate.set(p.date, isBeta ? p.beta : p.correlation);
      }

      const data = allDates.map((d) => valueByDate.get(d) ?? null);
      for (const v of data) {
        if (v != null) allValues.push(v);
      }

      datasets.push({
        label: symbol,
        data,
        borderColor: palette[colorIdx % palette.length],
        backgroundColor: palette[colorIdx % palette.length],
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 2,
        borderWidth: 1.5,
        spanGaps: true,
        fill: false,
        hidden: firstVisibleSymbol != null && symbol !== firstVisibleSymbol,
      });
      colorIdx++;
    }

    const scaleRange = niceLinearScale(allValues, {
      padding: currentWindow === "intraday" ? 0.02 : 0.03,
      symmetric: !isBeta,
      maxTicks: 9,
    });

    const refLineValue = isBeta ? 1 : 0;
    const yLabel = isBeta ? "Beta" : "Correlation";

    return {
      type: "line" as const,
      data: { labels: allDates, datasets },
      options: {
        ...baseChartOptions(),
        normalized: true,
        scales: {
          x: {
            ...TIME_X_AXIS,
            ticks: {
              ...TIME_X_AXIS.ticks,
              maxTicksLimit: 12,
              callback: function (_value: any, index: number) {
                const raw = allDates[index];
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
            ...yAxis(yLabel),
            ...scaleRange,
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
                return v != null ? `${ctx.dataset.label}: ${v.toFixed(3)}` : "";
              },
            },
          },
        },
      },
      plugins: [
        createReferenceLinePlugin(refLineValue, "y", {
          color: "rgba(0,0,0,0.4)",
          dash: [6, 4],
        }),
      ],
    };
  }

  // ── Render helpers ─────────────────────────────────────────────────────

  function renderChart(
    allData: Map<string, RollingBetaPoint[]>,
    mode: ChartMode,
  ): void {
    if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
    canvasWrap.style.display = "";

    const chartConfig = buildChartConfig(allData, mode);
    chartManager.destroy(canvas);
    chartManager.createOrUpdate(canvas, chartConfig);
  }

  function renderFromCache(): void {
    if (!cachedData || isDestroyed) return;
    renderChart(cachedData, currentMode);
  }

  // ── Load and render ────────────────────────────────────────────────────

  async function loadAndRender(): Promise<void> {
    if (
      isDestroyed ||
      axisState.watchlistTickers.length < 1 ||
      !axisState.selectedBenchmark
    )
      return;

    const thisId = ++fetchId;
    setLoadingState(true);
    progressFill.style.width = "0%";
    loadingSummary.textContent = "Preparing...";
    loadingMeta.textContent = "";
    loadingDetail.textContent = "";

    // Show loading, hide idle & canvas
    if (idleEl.parentNode) idleEl.parentNode.removeChild(idleEl);
    chartManager.destroy(canvas);
    canvasWrap.style.display = "none";
    if (!loadingEl.parentNode) panel.appendChild(loadingEl);

    try {
      const data = await config.betaService.computeRollingForAll(
        axisState.watchlistTickers,
        currentWindow,
        {
          marketSymbol: axisState.selectedBenchmark,
          onProgress: (progress) => {
            if (isDestroyed || thisId !== fetchId) return;
            setProgressState(progress);
          },
        },
      );
      if (isDestroyed || thisId !== fetchId) return;

      cachedData = data;
      renderChart(data, currentMode);
    } catch {
      if (isDestroyed || thisId !== fetchId) return;
      if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);

      const errEl = ui_createElement("div", {
        text: "Failed to load rolling data.",
        styleString:
          "text-align: center; padding: 40px 0; font-size: var(--ax-fs-md); color: var(--ax-negative);",
      });
      panel.appendChild(errEl);
    } finally {
      if (thisId === fetchId) setLoadingState(false);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────

  panel.update = (_symbols: string[]) => {
    // Ticker lists are user-managed via KVStore; no auto-sync
  };

  panel.cleanup = () => {
    isDestroyed = true;
    chartManager.destroy(canvas);
  };

  return panel;
}
