import { ui_createElement } from "../../components/core/builders/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY, DS_COLORS } from "../../components/core/styles/theme";
import { createPillGroup } from "../../components/core/builders/pillGroup";
import { CHART_COLORS } from "frontend/charts/ChartTheme";
import { createCorrelationHeatmap } from "frontend/charts/types/HeatmapFactory";
import type { HeatmapChartHandle } from "frontend/charts/types/HeatmapTypes";
import type { BetaHorizon } from "../../../backend/computation/beta/types";
import type { ChartDataService } from "../../../backend/core/network/chart/ChartDataService";
import type { OHLCVBar } from "../../../shared/types/chartData";
import {
  createAxisTickerManager,
  type AxisTickerState,
} from "./AxisTickerManager";
import { loadStoredAxes, saveStoredAxes } from "./HeatmapStorage";
import {
  fetchAllBars,
  computeMatrix,
  WINDOW_CONFIGS,
  type HeatmapMode,
  type WindowKey,
} from "./HeatmapDataPipeline";

// ── Types ────────────────────────────────────────────────────────────────────

export type CorrelationBetaHeatmapResult = HTMLElement & {
  cleanup?: () => void;
  update?: (symbols: string[]) => void;
};

// Flat action button — same solid blue as active pill for visual consistency
const ACTION_BTN_STYLE =
  `background: ${DS_COLORS.info}; color: #fff; border: 1px solid ${DS_COLORS.info};` +
  " font-weight: 600; cursor: pointer; border-radius: 8px;" +
  " font-family: var(--ios-font, inherit); transition: all 0.15s;" +
  " white-space: nowrap; flex-shrink: 0;";

// ── Component ────────────────────────────────────────────────────────────────

export function renderCorrelationBetaHeatmap(config: {
  chartDataService: ChartDataService;
  symbols: string[];
  getRebalanceTickers: () => string[];
  getMediumBeta: (symbol: string) => number | null;
}): CorrelationBetaHeatmapResult {
  let currentMode: HeatmapMode = "correlation";
  let currentWindow: WindowKey = "6M";
  let isDestroyed = false;
  let fetchId = 0;
  let isLoading = false;
  let heatmapHandle: HeatmapChartHandle | null = null;

  // ── Ticker state ─────────────────────────────────────────────────────────

  const tickerState: AxisTickerState = {
    rowTickers: [...config.symbols],
    colTickers: [...config.symbols],
  };

  // Color range clamp (undefined = auto)
  let colorRangeMin: number | undefined;
  let colorRangeMax: number | undefined;

  // R² threshold — beta values with R² below this are suppressed as noise
  let minRSquared = 0.05;

  // Last computed result (for copy-to-clipboard)
  let lastResult: {
    rows: string[];
    cols: string[];
    matrix: number[][];
    mode: HeatmapMode;
    summaryColumn: number[];
  } | null = null;

  // Cached bars to allow mode switching without re-fetching
  let cachedBars: {
    barsMap: Map<string, OHLCVBar[]>;
    horizon: BetaHorizon;
    rows: string[];
    cols: string[];
  } | null = null;

  const panel = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as CorrelationBetaHeatmapResult;

  // ── Header ───────────────────────────────────────────────────────────────

  panel.appendChild(
    ui_createElement("h3", {
      text: "Cross-Asset Matrix",
      styleString:
        DS_TYPOGRAPHY.panelTitle + " margin-bottom: 0; flex-shrink: 0;",
    }),
  );
  const descEl = ui_createElement("div", {
    text: "Pairwise correlation or beta across portfolio holdings and indices",
    styleString: DS_TYPOGRAPHY.panelDesc,
  });
  panel.appendChild(descEl);

  // ── Controls row ─────────────────────────────────────────────────────────

  const controlsRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;",
  });

  const windowPills = createPillGroup<WindowKey>(
    [
      { label: "1D", value: "1D" },
      { label: "1M", value: "1M" },
      { label: "6M", value: "6M" },
      { label: "2Y", value: "2Y" },
    ],
    "6M",
    (w) => {
      currentWindow = w;
    },
  );
  controlsRow.appendChild(windowPills.element);

  // Load button
  const loadBtn = ui_createElement("button", {
    text: "Load",
    styleString: ACTION_BTN_STYLE + " padding: 3px 14px; font-size: 10px;",
  }) as HTMLButtonElement;
  loadBtn.addEventListener("click", () => {
    if (!isLoading) loadAndRender();
  });
  controlsRow.appendChild(loadBtn);

  // Visual separator between Load and mode/copy group
  controlsRow.appendChild(
    ui_createElement("div", {
      styleString:
        "width: 1px; height: 18px; background: var(--ios-border, rgba(230,230,230,0.7)); margin: 0 4px;",
    }),
  );

  const modePills = createPillGroup<HeatmapMode>(
    [
      { label: "Correlation", value: "correlation" },
      { label: "Beta", value: "beta" },
    ],
    "correlation",
    (mode) => {
      currentMode = mode;
      descEl.textContent =
        mode === "correlation"
          ? "Pairwise correlation across portfolio holdings and indices"
          : "Pairwise beta (row regressed on column) across holdings and indices";
      recomputeFromCache();
    },
  );
  controlsRow.appendChild(modePills.element);

  // Copy button — export current matrix as JSON to clipboard
  const copyBtn = ui_createElement("button", {
    text: "Copy",
    styleString: ACTION_BTN_STYLE + " padding: 3px 10px; font-size: 10px;",
  }) as HTMLButtonElement;
  copyBtn.addEventListener("click", () => {
    if (!lastResult) return;
    const { rows, cols, matrix, mode, summaryColumn } = lastResult;
    const payload = rows.map((row, i) => {
      const entry: Record<string, string | number> = { ticker: row };
      for (let j = 0; j < cols.length; j++) {
        entry[cols[j]] = Number.isFinite(matrix[i][j])
          ? +matrix[i][j].toFixed(4)
          : (null as any);
      }
      entry[mode === "beta" ? "avg_beta" : "avg_corr"] = Number.isFinite(
        summaryColumn[i],
      )
        ? +summaryColumn[i].toFixed(4)
        : (null as any);
      return entry;
    });
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1500);
    });
  });
  controlsRow.appendChild(copyBtn);

  panel.appendChild(controlsRow);

  // ── Axis sections (row / col ticker areas) ──────────────────────────────

  const tickerManager = createAxisTickerManager(
    tickerState,
    {
      onSave: () => {
        saveStoredAxes(tickerState.rowTickers, tickerState.colTickers);
      },
    },
    ACTION_BTN_STYLE,
  );

  // "From Rebalance" button — import rebalance tickers with |6M beta| > 0.1
  const rebalBtn = ui_createElement("button", {
    text: "From Rebalance",
    styleString: ACTION_BTN_STYLE + " padding: 3px 10px; font-size: 10px;",
  }) as HTMLButtonElement;
  rebalBtn.addEventListener("click", () => {
    const rebalanceTickers = config.getRebalanceTickers();
    let added = 0;
    for (const sym of rebalanceTickers) {
      if (tickerState.rowTickers.includes(sym)) continue;
      const beta = config.getMediumBeta(sym);
      if (beta !== null && Math.abs(beta) > 0.1) {
        tickerState.rowTickers.push(sym);
        added++;
      }
    }
    if (added > 0) {
      saveStoredAxes(tickerState.rowTickers, tickerState.colTickers);
      tickerManager.renderAxisTags("row");
    }
  });
  tickerManager.rowSection.headerRow.appendChild(rebalBtn);

  panel.appendChild(tickerManager.rowSection.container);
  panel.appendChild(tickerManager.colSection.container);

  // ── Storage ──────────────────────────────────────────────────────────────

  // Kick off async load from IndexedDB
  loadStoredAxes(config.symbols)
    .then((result) => {
      if (isDestroyed) return;

      const changed =
        JSON.stringify(result.rows) !==
          JSON.stringify(tickerState.rowTickers) ||
        JSON.stringify(result.cols) !== JSON.stringify(tickerState.colTickers);

      if (changed) {
        tickerState.rowTickers = result.rows;
        tickerState.colTickers = result.cols;
        tickerManager.renderAxisTags("row");
        tickerManager.renderAxisTags("col");
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
    text: 'Click "Load" to compute the cross-asset matrix.',
    styleString:
      "text-align: center; padding: 40px 0; font-size: 12px;" +
      " color: var(--ios-text-secondary, #8e8e93);",
  });

  // Canvas wrapper
  const canvasWrap = document.createElement("div");
  canvasWrap.style.cssText =
    "position: relative; width: 100%; display: none; overflow-x: auto;";

  // Color range + R² toolbar (single row: Min [gradient] Max | R²≥)
  const rangeToolbar = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 6px; margin-bottom: 4px;",
  });
  const rangeInputStyle =
    "width: 48px; padding: 3px 5px; font-size: var(--ax-fs-xs); border-radius: 6px;" +
    " border: 1px solid var(--ax-border);" +
    " font-family: var(--ax-font-body); background: var(--ax-bg-input); text-align: center;";
  const minInput = document.createElement("input");
  minInput.type = "text";
  minInput.placeholder = "Min";
  minInput.style.cssText = rangeInputStyle;

  // DOM color scale gradient bar (replaces canvas-drawn color scale)
  const colorScaleBar = ui_createElement("div", {
    styleString:
      "width: 180px; flex-shrink: 0; height: 10px; border-radius: 5px;" +
      " background: linear-gradient(90deg," +
      " rgb(215,49,38) 0%, rgb(215,129,0) 25%, rgb(255,255,255) 50%," +
      " rgb(144,238,144) 75%, rgb(32,169,69) 100%);" +
      " border: 0.5px solid var(--ax-border);",
  });

  const maxInput = document.createElement("input");
  maxInput.type = "text";
  maxInput.placeholder = "Max";
  maxInput.style.cssText = rangeInputStyle;

  const parseRangeInput = (input: HTMLInputElement): number | undefined => {
    const v = parseFloat(input.value.trim());
    return Number.isFinite(v) ? v : undefined;
  };
  const onRangeChange = () => {
    colorRangeMin = parseRangeInput(minInput);
    colorRangeMax = parseRangeInput(maxInput);
    recomputeFromCache();
  };
  minInput.addEventListener("change", onRangeChange);
  maxInput.addEventListener("change", onRangeChange);

  // R² threshold input (beta mode: suppress values with low R²)
  const r2Label = ui_createElement("span", {
    text: "R\u00b2\u2265",
    styleString:
      "font-size: 10px; color: var(--ios-text-secondary, #8e8e93); margin-left: 6px;",
  });
  const r2Input = document.createElement("input");
  r2Input.type = "text";
  r2Input.value = String(minRSquared);
  r2Input.style.cssText = rangeInputStyle;
  r2Input.addEventListener("change", () => {
    const v = parseFloat(r2Input.value.trim());
    if (Number.isFinite(v) && v >= 0 && v <= 1) {
      minRSquared = v;
    } else {
      r2Input.value = String(minRSquared);
    }
    recomputeFromCache();
  });

  rangeToolbar.appendChild(minInput);
  rangeToolbar.appendChild(colorScaleBar);
  rangeToolbar.appendChild(maxInput);
  rangeToolbar.appendChild(r2Label);
  rangeToolbar.appendChild(r2Input);
  canvasWrap.appendChild(rangeToolbar);

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display: block;";
  canvasWrap.appendChild(canvas);

  panel.appendChild(idleEl);
  panel.appendChild(canvasWrap);

  // ── State helpers ────────────────────────────────────────────────────────

  function setLoadingState(loading: boolean): void {
    isLoading = loading;
    loadBtn.disabled = loading;
    loadBtn.textContent = loading ? "Loading..." : "Load";
  }

  function setProgress(
    percent: number,
    summary: string,
    meta?: string,
    detail?: string,
  ): void {
    progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    loadingSummary.textContent = `${Math.round(percent)}% \u00b7 ${summary}`;
    loadingMeta.textContent = meta ?? "";
    loadingDetail.textContent = detail ?? "";
    loadBtn.textContent = `Loading ${Math.round(percent)}%`;
  }

  // ── Render helpers ─────────────────────────────────────────────────────

  function renderFromBars(
    barsMap: Map<string, OHLCVBar[]>,
    rows: string[],
    cols: string[],
    mode: HeatmapMode,
    horizon: BetaHorizon,
  ): void {
    const { matrix, sampleSizes, rSquared } = computeMatrix(
      rows,
      cols,
      barsMap,
      mode,
      horizon,
      minRSquared,
    );

    // Compute per-row average (exclude diagonal / NaN)
    const summaryColumn = matrix.map((row, i) => {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < row.length; j++) {
        if (rows[i] === cols[j]) continue;
        if (Number.isFinite(row[j])) {
          sum += row[j];
          count++;
        }
      }
      return count > 0 ? sum / count : NaN;
    });

    // Stash latest result for copy-to-clipboard
    lastResult = { rows, cols, matrix, mode, summaryColumn };

    if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
    canvasWrap.style.display = "";

    if (heatmapHandle) {
      heatmapHandle.destroy();
      heatmapHandle = null;
    }
    heatmapHandle = createCorrelationHeatmap(canvas, rows, cols, matrix, {
      mode,
      sampleSizes,
      rSquared,
      colorRangeMin,
      colorRangeMax,
      summaryColumn,
    });
  }

  /** Recompute and re-render using cached bars (e.g. after mode toggle). */
  function recomputeFromCache(): void {
    if (!cachedBars || isDestroyed) return;
    renderFromBars(
      cachedBars.barsMap,
      cachedBars.rows,
      cachedBars.cols,
      currentMode,
      cachedBars.horizon,
    );
  }

  // ── Load and render ────────────────────────────────────────────────────

  async function loadAndRender(): Promise<void> {
    if (
      isDestroyed ||
      tickerState.rowTickers.length < 1 ||
      tickerState.colTickers.length < 1
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
    if (heatmapHandle) {
      heatmapHandle.destroy();
      heatmapHandle = null;
    }
    canvasWrap.style.display = "none";
    if (!loadingEl.parentNode) panel.appendChild(loadingEl);

    const cfg = WINDOW_CONFIGS[currentWindow];

    // Deduplicate tickers for bar fetching
    const allTickers = [
      ...new Set([...tickerState.rowTickers, ...tickerState.colTickers]),
    ];

    try {
      // Phase 1: Fetch bars
      const barsMap = await fetchAllBars(
        allTickers,
        cfg,
        config.chartDataService,
        () => isDestroyed || thisId !== fetchId,
        setProgress,
      );
      if (!barsMap || isDestroyed || thisId !== fetchId) return;

      // Cache bars for instant mode switching
      const snapshotRows = [...tickerState.rowTickers];
      const snapshotCols = [...tickerState.colTickers];
      cachedBars = {
        barsMap,
        horizon: cfg.horizon,
        rows: snapshotRows,
        cols: snapshotCols,
      };

      // Phase 2: Compute & render
      setProgress(92, "Computing matrix...");
      if (isDestroyed || thisId !== fetchId) return;

      setProgress(98, "Rendering heatmap...");
      renderFromBars(
        barsMap,
        snapshotRows,
        snapshotCols,
        currentMode,
        cfg.horizon,
      );
    } catch {
      if (isDestroyed || thisId !== fetchId) return;
      if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);

      const errEl = ui_createElement("div", {
        text: "Failed to compute cross-asset matrix.",
        styleString:
          "text-align: center; padding: 40px 0; font-size: var(--ax-fs-md); color: var(--ax-negative);",
      });
      panel.appendChild(errEl);
    } finally {
      if (thisId === fetchId) setLoadingState(false);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  panel.update = (_symbols: string[]) => {
    // Ticker list is user-managed; no auto-sync with portfolio symbols
  };

  panel.cleanup = () => {
    isDestroyed = true;
    if (heatmapHandle) {
      heatmapHandle.destroy();
      heatmapHandle = null;
    }
  };

  return panel;
}
