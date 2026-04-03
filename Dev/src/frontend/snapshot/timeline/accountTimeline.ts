import { ui_createElement } from "../../components/core/createElement";
import type { AccountHistoryPoint } from "../../../backend/core/db/account/accountHistoryTypes";
import { loadHistoryForRange } from "../../../backend/pipeline/snapshot/historyPersistence";
import type {
  SnapshotMetricKey,
  TimeRange,
  TimeAxisMapping,
  IndexOverlayLine,
  ResolvedTimeRangeWindow,
  ChartRenderMode,
} from "./timelineTypes";
import { SNAPSHOT_METRICS, TIME_RANGES, DAY_CHANGE_STITCH_MAX_DURATION_MS } from "./timelineConstants";
import { resolveTimeRangeWindow } from "./timelineWindow";
import type { SnapshotChartBaseState } from "./chart/chartTypes";
import { SNAPSHOT_CHART_PAD } from "./chart/chartTypes";
import { drawSnapshotChartBase } from "./chart/chartBase";
import { drawSnapshotChartHover } from "./chart/chartHover";
import { getGapMode, buildTimeAxisMapping } from "./data/timeAxisMapping";
import { findNearestPointIndexByTs } from "./data/dataUtils";
import { resolveCandleBucketMs } from "./data/candleAggregation";
import { isNightSession, buildDayResetStitchedPoints } from "./timelineStitching";
import {
  buildOverlayLines,
  normalizeAccountDayChangePercentPoints,
  summarizeOverlaySelection,
} from "./data/overlayBuilder";
import {
  loadSnapshotRuntimePrefs,
  loadSkipNightSessionSetting,
  saveSnapshotPref,
  KV_METRIC_KEY,
  KV_TIME_RANGE_KEY,
  KV_SMA_PERIOD_KEY,
  KV_OVERLAY_INDICES_KEY,
  KV_OVERLAY_BETA_KEY,
  KV_CHART_MODE_KEY,
  KV_SMA2_PERIOD_KEY,
  SMA_OPTIONS,
} from "./timelinePrefs";
import { buildTimelineControls, updateStatusBar, updateSmaSelectLabels, syncSmaSelectStyle } from "./ui/timelineControls";
import { createIndexOverlayDropdown } from "./ui/overlayControls";
import { handleCanvasMove, handleCanvasLeave } from "./ui/hoverInteraction";
import type { HoverState } from "./ui/hoverInteraction";
import type { BetaService } from "../../../backend/pipeline/beta/BetaService";
import type { IntradaySparklineStore } from "../../trade_holdings/holding_table/sparkline/IntradaySparklineStore";

const OVERLAY_BETA_BENCHMARK = "$SPX";
const OVERLAY_BETA_RETRY_MS = 5 * 60 * 1000;

export type AccountTimelinePanelController = {
  element: HTMLElement;
  refresh: () => void;
  destroy: () => void;
};

export type AccountTimelineDeps = {
  indexSparklineStore: IntradaySparklineStore;
  betaService: BetaService;
  onCapture?: (cb: () => void) => void;
  offCapture?: (cb: () => void) => void;
};

// ══════════════════════════════════════════════════════════════════════════
//  Main export
// ══════════════════════════════════════════════════════════════════════════

export function createAccountTimelinePanel(
  deps?: AccountTimelineDeps,
): AccountTimelinePanelController {
  const panel = ui_createElement("div", {
    styleString: "display:flex; flex-direction:column; gap:4px;",
  });

  const controls = buildTimelineControls();

  // ── Index overlay controls (hidden until Day % selected) ────────────
  let overlaySelectedSymbols: string[] = [];
  let overlayBetaOffset = false;
  let unsubSparkline: (() => void) | null = null;
  const overlayBetaPending = new Set<string>();
  const overlayBetaLastRequestedAt = new Map<string, number>();

  const overlayDropdown = deps
    ? createIndexOverlayDropdown([], (selected) => {
        overlaySelectedSymbols = selected;
        saveSnapshotPref(KV_OVERLAY_INDICES_KEY, selected);
        if (deps.indexSparklineStore && selected.length > 0) {
          deps.indexSparklineStore.requestSymbols(selected);
        }
        renderChart();
      })
    : null;

  if (overlayDropdown) {
    controls.overlayWrap.appendChild(overlayDropdown.element);
  }

  const betaLabel = ui_createElement("label", {
    styleString:
      "display:flex; align-items:center; gap:3px; font-size:11px; cursor:pointer;" +
      " color:var(--ios-text-secondary); white-space:nowrap;",
  });
  const betaCb = document.createElement("input");
  betaCb.type = "checkbox";
  betaCb.style.cssText = "margin:0; accent-color:var(--ios-blue);";
  betaLabel.appendChild(betaCb);
  betaLabel.appendChild(ui_createElement("span", { text: "/ Beta" }));
  controls.overlayWrap.appendChild(betaLabel);

  betaCb.addEventListener("change", () => {
    overlayBetaOffset = betaCb.checked;
    saveSnapshotPref(KV_OVERLAY_BETA_KEY, overlayBetaOffset);
    renderChart();
  });

  const canvasWrap = ui_createElement("div", {
    styleString: "width:100%; height:200px; position:relative;",
  });
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width: 100%; height: 100%; display:block;";
  canvas.getContext("2d", { willReadFrequently: true });
  canvasWrap.appendChild(canvas);

  panel.appendChild(controls.chartHeader);
  panel.appendChild(canvasWrap);
  panel.appendChild(controls.statusBar);

  // ── State ──────────────────────────────────────────────────────────
  let history: AccountHistoryPoint[] = [];
  let selectedMetric: SnapshotMetricKey = "dayChangeDollar";
  let selectedTimeRange: TimeRange = TIME_RANGES[1]; // default 6.5h
  let skipNightSession = true;
  let smaPeriod = 0;
  let sma2Period = 0;
  let chartMode: ChartRenderMode = "line";
  let latestPlotPoints: AccountHistoryPoint[] = [];
  let latestAxisMapping: TimeAxisMapping | null = null;
  let latestTimeWindow: ResolvedTimeRangeWindow | null = null;
  let cachedBaseState: SnapshotChartBaseState | null = null;

  const hoverState: HoverState = { hoveredTs: null, hoverRafId: null };

  const isDayPctMetric = () => selectedMetric === "dayChangePercent";

  const syncOverlayVisibility = () => {
    controls.overlayWrap.style.display = isDayPctMetric() && deps ? "flex" : "none";
  };

  const getSmaLookbackMs = (durationMs: number): number => {
    const maxPeriod = Math.max(smaPeriod, sma2Period);
    return maxPeriod > 0 ? maxPeriod * resolveCandleBucketMs(durationMs) : 0;
  };

  const reloadData = (): Promise<AccountHistoryPoint[]> => {
    const tw = resolveTimeRangeWindow(selectedTimeRange);
    const lookback = getSmaLookbackMs(tw.durationMs);
    const historyLookbackMs = Math.max(
      60_000, tw.durationMs + lookback, Date.now() - tw.startTs + lookback,
    );
    return loadHistoryForRange(historyLookbackMs);
  };

  // ── Build overlay lines from sparkline store ─────────────────────────
  const getOverlayLines = (): IndexOverlayLine[] => {
    if (!isDayPctMetric() || !deps || overlaySelectedSymbols.length === 0) return [];
    const resolveOverlayBeta = (symbol: string): number | null => {
      if (symbol === OVERLAY_BETA_BENCHMARK) return 1;
      return deps.betaService.getCached(symbol, OVERLAY_BETA_BENCHMARK)?.short?.beta ?? null;
    };
    return buildOverlayLines(
      deps.indexSparklineStore,
      overlaySelectedSymbols,
      overlayBetaOffset,
      resolveOverlayBeta,
    );
  };

  const ensureOverlayBetas = (): void => {
    if (!deps || !overlayBetaOffset || !isDayPctMetric()) return;
    for (const symbol of overlaySelectedSymbols) {
      if (symbol === OVERLAY_BETA_BENCHMARK) continue;
      if (deps.betaService.getCached(symbol, OVERLAY_BETA_BENCHMARK)?.short?.beta != null) continue;
      const now = Date.now();
      const lastRequestedAt = overlayBetaLastRequestedAt.get(symbol) ?? 0;
      if (overlayBetaPending.has(symbol) || now - lastRequestedAt < OVERLAY_BETA_RETRY_MS) continue;
      overlayBetaPending.add(symbol);
      overlayBetaLastRequestedAt.set(symbol, now);
      void deps.betaService
        .computeForTicker(symbol, OVERLAY_BETA_BENCHMARK)
        .catch(() => null)
        .finally(() => {
          overlayBetaPending.delete(symbol);
          if (overlayBetaOffset && isDayPctMetric() && overlaySelectedSymbols.includes(symbol)) {
            renderChart();
          }
        });
    }
  };

  // ── Restore persisted prefs ────────────────────────────────────────
  void loadSnapshotRuntimePrefs().then(async (prefs) => {
    if (prefs.metric && SNAPSHOT_METRICS.some((m) => m.key === prefs.metric)) {
      selectedMetric = prefs.metric;
    }
    if (prefs.timeRangeLabel) {
      const normalizedTimeRangeLabel =
        prefs.timeRangeLabel === "6h" ? "6.5h" : prefs.timeRangeLabel;
      const found = TIME_RANGES.find((r) => r.label === normalizedTimeRangeLabel);
      if (found) {
        selectedTimeRange = found;
        if (normalizedTimeRangeLabel !== prefs.timeRangeLabel) {
          saveSnapshotPref(KV_TIME_RANGE_KEY, normalizedTimeRangeLabel);
        }
      }
    }
    skipNightSession = prefs.skipNightSession;
    smaPeriod = prefs.smaPeriod ?? 0;
    sma2Period = prefs.sma2Period ?? 0;
    controls.smaSelect.value = String(smaPeriod);
    controls.sma2Select.value = String(sma2Period);
    syncSmaSelectStyle(controls.smaSelect);
    syncSmaSelectStyle(controls.sma2Select);
    chartMode = prefs.chartMode ?? "line";
    controls.chartModeToggle.textContent = chartMode === "candle" ? "Candle" : "Line";

    if (prefs.overlayIndices && prefs.overlayIndices.length > 0) {
      overlaySelectedSymbols = prefs.overlayIndices;
      if (deps) deps.indexSparklineStore.requestSymbols(overlaySelectedSymbols);
    }
    if (prefs.overlayBetaOffset) {
      overlayBetaOffset = true;
      betaCb.checked = true;
    }
    if (overlayDropdown && overlaySelectedSymbols.length > 0) {
      const dropdownEl = overlayDropdown.element;
      const cbs = dropdownEl.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
      for (const cb of cbs) {
        cb.checked = overlaySelectedSymbols.includes(cb.dataset.symbol ?? "");
      }
      const btn = dropdownEl.querySelector<HTMLButtonElement>("button");
      if (btn) {
        const summary = summarizeOverlaySelection(overlaySelectedSymbols);
        btn.textContent = summary.text;
        btn.title = summary.title;
      }
    }

    history = await reloadData();
    controls.metricSelect.value = selectedMetric;
    controls.timeRangeSelect.value = selectedTimeRange.label;
    syncOverlayVisibility();
    render();
  });

  // Subscribe to sparkline store updates to re-render overlay
  if (deps) {
    unsubSparkline = deps.indexSparklineStore.onUpdate(() => {
      if (isDayPctMetric() && overlaySelectedSymbols.length > 0) {
        renderChart();
      }
    });
  }

  let refreshTimer: number | null = null;
  let ro: ResizeObserver | null = null;

  /** Full chart render: recompute data, draw base chart, cache base state, then draw hover. */
  const renderChart = (): void => {
    const timeWindow = resolveTimeRangeWindow(selectedTimeRange);
    latestTimeWindow = timeWindow;
    // Update SMA select labels with current bucket resolution
    const bucketMs = resolveCandleBucketMs(timeWindow.durationMs);
    updateSmaSelectLabels(controls.smaSelect, bucketMs, false);
    updateSmaSelectLabels(controls.sma2Select, bucketMs, true);
    const metric = SNAPSHOT_METRICS.find((m) => m.key === selectedMetric) ?? SNAPSHOT_METRICS[0];
    // Extend filter backwards to provide SMA warmup data
    const filterStartTs = timeWindow.startTs - getSmaLookbackMs(timeWindow.durationMs);
    const rawPlotPoints = history
      .filter((p) => p.ts >= filterStartTs && p.ts <= timeWindow.endTs)
      .filter((p) => (skipNightSession ? !isNightSession(p.ts) : true));
    const normalizedPlotPoints = normalizeAccountDayChangePercentPoints(
      rawPlotPoints,
      selectedMetric === "dayChangePercent" && overlayBetaOffset,
    );
    const isDayMetric =
      selectedMetric === "dayChangeDollar" || selectedMetric === "dayChangePercent";
    const shouldStitchDayReset =
      isDayMetric && timeWindow.durationMs <= DAY_CHANGE_STITCH_MAX_DURATION_MS;
    const plotPoints = shouldStitchDayReset
      ? buildDayResetStitchedPoints(normalizedPlotPoints)
      : normalizedPlotPoints;
    latestPlotPoints = plotPoints;

    let axisMapping: TimeAxisMapping | null = null;
    if (skipNightSession) {
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(320, Math.floor(rect.width || canvas.clientWidth || 0));
      const cW = Math.max(1, cssW - SNAPSHOT_CHART_PAD.left - SNAPSHOT_CHART_PAD.right);
      axisMapping = buildTimeAxisMapping(
        timeWindow.startTs,
        timeWindow.endTs,
        cW,
        SNAPSHOT_CHART_PAD.left,
        getGapMode(timeWindow.durationMs),
      );
    }
    latestAxisMapping = axisMapping;

    ensureOverlayBetas();
    const overlays = getOverlayLines();

    cachedBaseState = drawSnapshotChartBase(
      canvas, plotPoints, metric, timeWindow.durationMs,
      axisMapping, [smaPeriod, sma2Period], overlays, timeWindow.startTs, timeWindow.endTs,
      chartMode,
    );

    const hoveredIndex =
      hoverState.hoveredTs == null
        ? null
        : findNearestPointIndexByTs(plotPoints, hoverState.hoveredTs);
    if (cachedBaseState) {
      drawSnapshotChartHover(canvas, cachedBaseState, hoveredIndex, plotPoints);
    }

    updateStatusBar(
      controls.statusTextEl,
      controls.statusDot,
      controls.statusLabelEl,
      plotPoints.length,
      plotPoints.length > 0 ? plotPoints[plotPoints.length - 1].ts : null,
    );

    if (plotPoints.length === 0) {
      hoverState.hoveredTs = null;
    }
  };

  /** Hover-only render: restore cached base image + draw tooltip. */
  const renderHoverOnly = (): void => {
    if (!cachedBaseState || latestPlotPoints.length === 0) return;
    const hoveredIndex =
      hoverState.hoveredTs == null
        ? null
        : findNearestPointIndexByTs(latestPlotPoints, hoverState.hoveredTs);
    drawSnapshotChartHover(canvas, cachedBaseState, hoveredIndex, latestPlotPoints);
  };

  const render = (): void => {
    renderChart();
  };

  // ── Event handlers ─────────────────────────────────────────────────
  controls.metricSelect.addEventListener("change", () => {
    const nextMetric = controls.metricSelect.value as SnapshotMetricKey;
    if (!SNAPSHOT_METRICS.some((m) => m.key === nextMetric)) return;
    selectedMetric = nextMetric;
    hoverState.hoveredTs = null;
    saveSnapshotPref(KV_METRIC_KEY, nextMetric);
    syncOverlayVisibility();
    renderChart();
  });

  controls.smaSelect.addEventListener("change", () => {
    const val = Number(controls.smaSelect.value);
    smaPeriod = (SMA_OPTIONS as readonly number[]).includes(val) ? val : 0;
    saveSnapshotPref(KV_SMA_PERIOD_KEY, String(smaPeriod));
    syncSmaSelectStyle(controls.smaSelect);
    renderChart();
  });

  controls.sma2Select.addEventListener("change", () => {
    const val = Number(controls.sma2Select.value);
    sma2Period = (SMA_OPTIONS as readonly number[]).includes(val) ? val : 0;
    saveSnapshotPref(KV_SMA2_PERIOD_KEY, String(sma2Period));
    syncSmaSelectStyle(controls.sma2Select);
    renderChart();
  });

  controls.chartModeToggle.addEventListener("click", () => {
    chartMode = chartMode === "line" ? "candle" : "line";
    controls.chartModeToggle.textContent = chartMode === "candle" ? "Candle" : "Line";
    saveSnapshotPref(KV_CHART_MODE_KEY, chartMode);
    renderChart();
  });

  controls.timeRangeSelect.addEventListener("change", () => {
    const found = TIME_RANGES.find((r) => r.label === controls.timeRangeSelect.value);
    if (!found) return;
    selectedTimeRange = found;
    hoverState.hoveredTs = null;
    saveSnapshotPref(KV_TIME_RANGE_KEY, found.label);
    void Promise.all([reloadData(), loadSkipNightSessionSetting()]).then(
      ([loaded, skipNight]) => {
        history = loaded;
        skipNightSession = skipNight;
        renderChart();
      },
    );
  });

  const onCanvasMove = (event: MouseEvent): void => {
    handleCanvasMove(
      event, canvas, hoverState, latestPlotPoints,
      latestAxisMapping, latestTimeWindow, renderHoverOnly,
    );
  };

  const onCanvasLeave = (): void => {
    handleCanvasLeave(hoverState, renderHoverOnly);
  };

  canvas.addEventListener("mousemove", onCanvasMove);
  canvas.addEventListener("mouseleave", onCanvasLeave);

  const doRefresh = () => {
    void Promise.all([reloadData(), loadSkipNightSessionSetting()]).then(
      ([loaded, skipNight]) => {
        history = loaded;
        skipNightSession = skipNight;
        render();
      },
    );
  };

  // Primary: event-driven refresh from Recorder capture callback
  if (deps?.onCapture) deps.onCapture(doRefresh);

  // Fallback: reduced-frequency polling (30s) in case callback is unavailable
  refreshTimer = window.setInterval(doRefresh, 30_000);

  window.addEventListener("resize", render);
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => render());
    ro.observe(panel);
    ro.observe(canvasWrap);
  }

  render();

  return {
    element: panel,
    refresh: () => {
      void Promise.all([reloadData(), loadSkipNightSessionSetting()]).then(
        ([loaded, skipNight]) => {
          history = loaded;
          skipNightSession = skipNight;
          render();
        },
      );
    },
    destroy: () => {
      if (refreshTimer != null) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
      if (deps?.offCapture) deps.offCapture(doRefresh);
      if (hoverState.hoverRafId != null) {
        cancelAnimationFrame(hoverState.hoverRafId);
        hoverState.hoverRafId = null;
      }
      if (ro) {
        ro.disconnect();
        ro = null;
      }
      if (unsubSparkline) {
        unsubSparkline();
        unsubSparkline = null;
      }
      canvas.removeEventListener("mousemove", onCanvasMove);
      canvas.removeEventListener("mouseleave", onCanvasLeave);
      window.removeEventListener("resize", render);
      cachedBaseState = null;
    },
  };
}
