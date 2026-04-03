import { ui_createElement } from "frontend/components/core/createElement";
import { DS_COLORS } from "frontend/components/core/theme";
import { logService } from "shared/log/core/LogService";
import { getTodayDateCT, minutesToHHMM } from "shared/utils/time";
import { ui_copyTextToClipboard } from "frontend/components/core/clipboard";
import { createDashboardStore } from "./store";
import { loadAll, loadGexMatrix, loadOIMatrix } from "./data/queryEngine";
import { loadMonitorHistory } from "./data/monitorHistory";
import { renderControlBar } from "./components/ControlBar";
import { renderZoneControlBar } from "./components/ZoneControlBar";
import { renderStatusBand } from "./components/charts/StatusBand";
import { renderGexHeatmap } from "./components/heatmaps/GexHeatmap";
import { renderKeyLevelsChart } from "./components/charts/KeyLevelsChart";
import { renderTermStructureBand } from "./components/charts/TermStructureBand";
import { renderFlowIncrement } from "./components/charts/FlowIncrement";
import { renderSignalPanel } from "./components/SignalPanel";
import { renderPCRatioMomentum } from "./components/charts/PCRatioMomentum";
import { renderImpliedVsRealized } from "./components/charts/ImpliedVsRealized";
import { renderVRPChart } from "./components/charts/VRPChart";
import { renderIVCorrelation } from "./components/IVCorrelation";
import { renderOIHeatmap } from "./components/heatmaps/OIHeatmap";
import { computeAlphaSignals } from "./signals/signalEngine";
import type { DashboardSymbol, GexHeatmapData, OIHeatmapData } from "./types";
import type { ChartPanelResult } from "frontend/charts/chartPanel";
import type { FlowChartData } from "./components/chartData";
import type { MonitorController } from "./monitor/MonitorController";
import type { OptionCapture } from "backend/core/db/capture/optionMonitorTypes";
import { createFlowSettingsPanel } from "./setting_panel/settingsPanel";

const log = logService.namespace("render");
type StatusDotState = "inactive" | "refreshing" | "active" | "error";

export function optionFlow_renderPage(
  _ctx: any,
): HTMLElement & { cleanup?: () => void } {
  const wrapper = ui_createElement("div", {
    styleString: "padding: 12px; position: relative;",
  }) as HTMLElement & { cleanup?: () => void };

  const mc = (_ctx as any)?.monitorController as MonitorController | undefined;
  const symbols = mc?.getSymbols();
  const defaultSymbol = symbols && symbols.length > 0 ? symbols[0] : undefined;

  const store = createDashboardStore(defaultSymbol);
  let isRunning = true;
  const cleanups: Array<() => void> = [];

  const panels: { cleanup?: () => void }[] = [];
  let latestGexMatrix: GexHeatmapData | null = null;
  let copyOutResetTimer: number | null = null;

  // Persistent chart references for in-place updates
  let liveStatusBand: ChartPanelResult<FlowChartData> | null = null;
  let liveKeyLevels: ChartPanelResult<FlowChartData> | null = null;
  let liveTermBand: ChartPanelResult<FlowChartData> | null = null;
  let liveFlowIncrement: ChartPanelResult<FlowChartData> | null = null;
  let livePcRatio: ChartPanelResult<OptionCapture[]> | null = null;
  let liveIvr: ChartPanelResult<OptionCapture[]> | null = null;
  let liveVrp: ChartPanelResult<OptionCapture[]> | null = null;
  let liveGexHeatmap:
    | (HTMLElement & {
        cleanup?: () => void;
        update?: (d: GexHeatmapData) => void;
      })
    | null = null;
  let liveOiHeatmap:
    | (HTMLElement & {
        cleanup?: () => void;
        update?: (d: OIHeatmapData) => void;
      })
    | null = null;
  let liveIvCorr: (HTMLElement & { cleanup?: () => void }) | null = null;
  let chartsInitialized = false;
  let heatmapsInitialized = false;
  const optionsStatusDot = ((_ctx as any)?.optionsStatus ??
    null) as HTMLElement | null;

  const updateStatusDot = (
    dot: HTMLElement | null,
    status: StatusDotState,
  ): void => {
    if (!dot) return;
    if (status === "active") dot.style.background = "#00aa00";
    else if (status === "refreshing") dot.style.background = "#ffcc00";
    else if (status === "error") dot.style.background = "#cc0000";
    else dot.style.background = "var(--ios-gray)";
  };
  const updateOptionsStatus = (status: StatusDotState): void => {
    updateStatusDot(optionsStatusDot, status);
  };
  updateOptionsStatus("inactive");

  // ── Zone-level state (independent date+time per zone) ──
  // Charts zone uses the store's state; heatmap zone tracks its own
  let hmDateStart = store.getState().dateStart;
  let hmDateEnd = store.getState().dateEnd;
  let hmTimeStart = store.getState().timeStartMin;
  let hmTimeEnd = store.getState().timeEndMin;

  // ════════════════════════════════════════════════════════════════════════
  // 1. TOP BAR — ticker, refresh, copy, settings
  // ════════════════════════════════════════════════════════════════════════
  const state = store.getState();
  const controlBar = renderControlBar(
    state.symbol,
    {
      onSymbolChange: (sym: DashboardSymbol) => {
        store.setSymbol(sym);
        void refreshCharts();
        void refreshHeatmaps();
      },
      onRefresh: () => {
        if (!mc) {
          updateOptionsStatus("error");
          return;
        }
        const { symbol } = store.getState();
        controlBar.updateStatus?.(0, true);
        updateOptionsStatus("refreshing");
        mc.refreshSymbol(symbol)
          .then((response) => {
            if (!response) {
              controlBar.updateStatus?.(0, false);
              updateOptionsStatus("error");
              return;
            }
            void refreshCharts();
            void refreshHeatmaps();
          })
          .catch((err) => {
            log.error("monitor.manualRefresh.fail", {
              error: (err as Error)?.message ?? String(err),
            });
            controlBar.updateStatus?.(0, false);
            updateOptionsStatus("error");
          });
      },
    },
    symbols,
  );

  // Copy Out button
  const copyOutBtn = ui_createElement("button", {
    text: "Copy Out",
    styleString:
      "padding: 4px 12px; font-size: 11px; font-weight: 700; border-radius: 8px;" +
      " cursor: pointer; border: 1px solid var(--ios-border, rgba(230,230,230,0.7));" +
      ' font-family: var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);' +
      " background: rgba(255,255,255,0.6); color: var(--ios-text-primary);" +
      " flex-shrink: 0; transition: opacity 0.2s, color 0.2s, border-color 0.2s;",
  }) as HTMLButtonElement;

  const setCopyOutBtnAppearance = (
    btnState: "default" | "success" | "error",
  ): void => {
    if (btnState === "success") {
      copyOutBtn.style.borderColor = "#169c35";
      copyOutBtn.style.color = "#0c7a28";
      return;
    }
    if (btnState === "error") {
      copyOutBtn.style.borderColor = DS_COLORS.negative;
      copyOutBtn.style.color = DS_COLORS.negative;
      return;
    }
    copyOutBtn.style.borderColor = "var(--ios-border, rgba(230,230,230,0.7))";
    copyOutBtn.style.color = "var(--ios-text-primary)";
  };

  const buildCopyOutText = (): string => {
    const s = store.getState();
    const payload = {
      source: "AlexQuant Option Flow",
      generatedAt: new Date().toISOString(),
      symbol: s.symbol,
      range: {
        dateStart: s.dateStart,
        dateEnd: s.dateEnd,
        timeStartMin: s.timeStartMin,
        timeEndMin: s.timeEndMin,
        timeStartCt: minutesToHHMM(s.timeStartMin),
        timeEndCt: minutesToHHMM(s.timeEndMin),
      },
      counts: {
        openings: s.metaRows.length,
        expiryRows: s.expiryRows.length,
        heatmapTimes: latestGexMatrix?.times.length ?? 0,
        heatmapStrikes: latestGexMatrix?.strikes.length ?? 0,
      },
      notes: [
        "Option flow metrics use MID basis.",
        "Single-expiry series use nearest expiry (minimum DTE) at each timestamp.",
        "If monitor uses scoped expiries (top_n or fixed_slots), option flow charts aggregate over that selected Expiry.",
      ],
      data: {
        metaRows: s.metaRows,
        expiryRows: s.expiryRows,
        gexHeatmap: latestGexMatrix,
      },
    };
    return `AlexQuant Option Flow Copy Out\n\n${JSON.stringify(payload, null, 2)}`;
  };

  copyOutBtn.addEventListener("click", () => {
    void (async () => {
      const ok = await ui_copyTextToClipboard(buildCopyOutText());
      copyOutBtn.textContent = ok ? "Copied" : "Copy Failed";
      setCopyOutBtnAppearance(ok ? "success" : "error");
      if (copyOutResetTimer != null) window.clearTimeout(copyOutResetTimer);
      copyOutResetTimer = window.setTimeout(() => {
        copyOutResetTimer = null;
        copyOutBtn.textContent = "Copy Out";
        setCopyOutBtnAppearance("default");
      }, 1800);
    })();
  });
  controlBar.appendChild(copyOutBtn);

  const openingSettingsPanel = createFlowSettingsPanel(_ctx);
  controlBar.appendChild(openingSettingsPanel.root);
  wrapper.appendChild(controlBar);
  cleanups.push(() => openingSettingsPanel.cleanup());

  // Brief note
  wrapper.appendChild(
    ui_createElement("div", {
      text: "Option flow metrics use MID basis. Single-expiry series use nearest expiry (min DTE). Scoped expiries reflect selected Expiry.",
      styleString:
        "font-size: 10px; color: var(--ios-text-secondary); margin: 4px 4px 8px;",
    }),
  );

  // Signal panel slot
  const signalSlot = ui_createElement("div");
  wrapper.appendChild(signalSlot);

  // ════════════════════════════════════════════════════════════════════════
  // 2. CHART ZONE — own date+time controls, chart grid
  // ════════════════════════════════════════════════════════════════════════
  const chartZone = ui_createElement("div", {
    styleString: "margin-bottom: 12px;",
  });

  const chartZoneBar = renderZoneControlBar(
    state.dateStart,
    state.dateEnd,
    state.timeStartMin,
    state.timeEndMin,
    {
      onDateRangeChange: (dateStart, dateEnd) => {
        store.setDateRange(dateStart, dateEnd);
        void refreshCharts();
      },
      onTimeWindowChange: (startMin, endMin) => {
        store.setTimeWindow(startMin, endMin);
        void refreshCharts();
      },
    },
  );
  chartZone.appendChild(chartZoneBar);

  const chartContainer = ui_createElement("div", {
    className: "optionFlow-chart-grid",
    styleString:
      "display: grid; grid-template-columns: repeat(3, 1fr);" +
      " gap: 12px; align-items: start;",
  });
  chartZone.appendChild(chartContainer);
  wrapper.appendChild(chartZone);

  // ════════════════════════════════════════════════════════════════════════
  // 3. HEATMAP ZONE — own date+time controls, heatmap container
  // ════════════════════════════════════════════════════════════════════════
  const heatmapZone = ui_createElement("div", {
    styleString: "margin-bottom: 12px;",
  });

  const heatmapZoneBar = renderZoneControlBar(
    hmDateStart,
    hmDateEnd,
    hmTimeStart,
    hmTimeEnd,
    {
      onDateRangeChange: (dateStart, dateEnd) => {
        hmDateStart = dateStart;
        hmDateEnd = dateEnd;
        void refreshHeatmaps();
      },
      onTimeWindowChange: (startMin, endMin) => {
        hmTimeStart = startMin;
        hmTimeEnd = endMin;
        void refreshHeatmaps();
      },
    },
  );
  heatmapZone.appendChild(heatmapZoneBar);

  const heatmapContainer = ui_createElement("div", {
    styleString: "display: flex; flex-direction: column; gap: 12px;",
  });
  heatmapZone.appendChild(heatmapContainer);
  wrapper.appendChild(heatmapZone);

  // ════════════════════════════════════════════════════════════════════════
  // Refresh logic
  // ════════════════════════════════════════════════════════════════════════
  let chartRefreshSeq = 0;
  let heatmapRefreshSeq = 0;

  function teardownCharts(): void {
    // Tear down chart-zone panels only
    if (liveStatusBand) {
      liveStatusBand.cleanup?.();
      liveStatusBand = null;
    }
    if (liveKeyLevels) {
      liveKeyLevels.cleanup?.();
      liveKeyLevels = null;
    }
    if (liveTermBand) {
      liveTermBand.cleanup?.();
      liveTermBand = null;
    }
    if (liveFlowIncrement) {
      liveFlowIncrement.cleanup?.();
      liveFlowIncrement = null;
    }
    if (livePcRatio) {
      livePcRatio.cleanup?.();
      livePcRatio = null;
    }
    if (liveIvr) {
      liveIvr.cleanup?.();
      liveIvr = null;
    }
    if (liveVrp) {
      liveVrp.cleanup?.();
      liveVrp = null;
    }
    if (liveIvCorr) {
      liveIvCorr.cleanup?.();
      liveIvCorr = null;
    }
    chartContainer.innerHTML = "";
    signalSlot.innerHTML = "";
    chartsInitialized = false;
  }

  function teardownHeatmaps(): void {
    if (liveGexHeatmap) {
      liveGexHeatmap.cleanup?.();
      liveGexHeatmap = null;
    }
    if (liveOiHeatmap) {
      liveOiHeatmap.cleanup?.();
      liveOiHeatmap = null;
    }
    heatmapContainer.innerHTML = "";
    latestGexMatrix = null;
    heatmapsInitialized = false;
  }

  async function refreshCharts(fullRebuild: boolean = true): Promise<void> {
    if (!isRunning) return;

    const seq = ++chartRefreshSeq;
    const { symbol, dateStart, dateEnd, timeStartMin, timeEndMin } =
      store.getState();
    store.setLoading(true);
    controlBar.updateStatus?.(0, true);
    updateOptionsStatus("refreshing");

    try {
      // Load data FIRST — keep existing charts visible while loading
      const [{ metaRows, expiryRows }, monitorHistory] = await Promise.all([
        loadAll(symbol, dateStart, dateEnd, timeStartMin, timeEndMin),
        loadMonitorHistory(symbol),
      ]);

      if (seq !== chartRefreshSeq || !isRunning) return;

      store.update({ metaRows, expiryRows, loading: false, error: null });
      controlBar.updateStatus?.(metaRows.length, false);

      if (metaRows.length === 0) {
        teardownCharts();
        const rangeLabel =
          dateStart === dateEnd ? dateStart : `${dateStart} ~ ${dateEnd}`;
        chartContainer.appendChild(
          ui_createElement("div", {
            text: `No data found for ${symbol} on ${rangeLabel}.`,
            styleString:
              "color:var(--ios-gray); font-size:13px; text-align:center; padding:40px 0; grid-column: span 3;",
          }),
        );
        if (seq === chartRefreshSeq && isRunning) updateOptionsStatus("active");
        return;
      }

      const chartData: FlowChartData = {
        meta: metaRows,
        expiry: expiryRows,
      };

      // Alpha signal panel (always rebuild — lightweight)
      signalSlot.innerHTML = "";
      const signals = computeAlphaSignals(monitorHistory, metaRows, expiryRows);
      signalSlot.appendChild(renderSignalPanel(signals));

      if (chartsInitialized && !fullRebuild) {
        // Incremental in-place update
        liveStatusBand?.update?.(chartData);
        liveKeyLevels?.update?.(chartData);
        liveTermBand?.update?.(chartData);
        liveFlowIncrement?.update?.(chartData);
        livePcRatio?.update?.(monitorHistory);
        liveIvr?.update?.(monitorHistory);
        liveVrp?.update?.(monitorHistory);
      } else {
        // Full rebuild: teardown AFTER data is ready, then create new
        teardownCharts();

        liveStatusBand = renderStatusBand(metaRows, expiryRows);
        panels.push(liveStatusBand);
        chartContainer.appendChild(liveStatusBand);

        liveKeyLevels = renderKeyLevelsChart(metaRows, expiryRows);
        panels.push(liveKeyLevels);
        chartContainer.appendChild(liveKeyLevels);

        liveTermBand = renderTermStructureBand(metaRows, expiryRows);
        panels.push(liveTermBand);
        chartContainer.appendChild(liveTermBand);

        liveFlowIncrement = renderFlowIncrement(metaRows, expiryRows);
        panels.push(liveFlowIncrement);
        chartContainer.appendChild(liveFlowIncrement);

        livePcRatio = renderPCRatioMomentum(monitorHistory);
        panels.push(livePcRatio);
        chartContainer.appendChild(livePcRatio);

        liveIvr = renderImpliedVsRealized(monitorHistory);
        panels.push(liveIvr);
        chartContainer.appendChild(liveIvr);

        liveVrp = renderVRPChart(monitorHistory);
        panels.push(liveVrp);
        chartContainer.appendChild(liveVrp);

        // Cross-Asset IV Correlation (1-column width)
        const allSymbols = [...(mc?.getSymbols() ?? [symbol])];
        if (allSymbols.length >= 2) {
          liveIvCorr = renderIVCorrelation(allSymbols);
          panels.push(liveIvCorr);
          chartContainer.appendChild(liveIvCorr);
        }

        chartsInitialized = true;
      }

      if (seq === chartRefreshSeq && isRunning) updateOptionsStatus("active");

      log.info("optionFlow.charts.refresh", {
        msg: `Loaded ${metaRows.length} openings for ${symbol} on ${dateStart}${dateStart !== dateEnd ? ` ~ ${dateEnd}` : ""}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      store.update({ loading: false, error: msg });
      controlBar.updateStatus?.(0, false);
      if (seq === chartRefreshSeq && isRunning) updateOptionsStatus("error");
      chartContainer.appendChild(
        ui_createElement("div", {
          text: `Error loading data: ${msg}`,
          styleString:
            "color:red; font-size:12px; padding:20px 0; grid-column: span 3;",
        }),
      );
      log.error("optionFlow.charts.refresh", { error: msg });
    }
  }

  async function refreshHeatmaps(fullRebuild: boolean = true): Promise<void> {
    if (!isRunning) return;

    const seq = ++heatmapRefreshSeq;
    const { symbol } = store.getState();

    try {
      // Load data FIRST — keep existing heatmaps visible while loading
      const [gexMatrix, oiMatrix] = await Promise.all([
        loadGexMatrix(symbol, hmDateStart, hmDateEnd, hmTimeStart, hmTimeEnd),
        loadOIMatrix(symbol, hmDateStart, hmDateEnd, hmTimeStart, hmTimeEnd),
      ]);

      if (seq !== heatmapRefreshSeq || !isRunning) return;
      latestGexMatrix = gexMatrix;

      if (heatmapsInitialized && !fullRebuild) {
        // Incremental in-place update
        if (gexMatrix.times.length > 0 && gexMatrix.strikes.length > 0) {
          liveGexHeatmap?.update?.(gexMatrix);
        }
        if (oiMatrix.times.length > 0 && oiMatrix.strikes.length > 0) {
          liveOiHeatmap?.update?.(oiMatrix);
        }
      } else {
        // Full rebuild: teardown AFTER data is ready, then create new
        teardownHeatmaps();

        if (gexMatrix.times.length > 0 && gexMatrix.strikes.length > 0) {
          liveGexHeatmap = renderGexHeatmap(gexMatrix);
          panels.push(liveGexHeatmap);
          heatmapContainer.appendChild(liveGexHeatmap);
        }

        if (oiMatrix.times.length > 0 && oiMatrix.strikes.length > 0) {
          liveOiHeatmap = renderOIHeatmap(oiMatrix);
          panels.push(liveOiHeatmap);
          heatmapContainer.appendChild(liveOiHeatmap);
        }

        heatmapsInitialized = true;
      }

      log.info("optionFlow.heatmaps.refresh", {
        msg: `Loaded GEX ${gexMatrix.times.length}x${gexMatrix.strikes.length}, OI ${oiMatrix.times.length}x${oiMatrix.strikes.length}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (seq === heatmapRefreshSeq && isRunning) {
        heatmapContainer.appendChild(
          ui_createElement("div", {
            text: `Error loading heatmaps: ${msg}`,
            styleString: "color:red; font-size:12px; padding:20px 0;",
          }),
        );
      }
      log.error("optionFlow.heatmaps.refresh", { error: msg });
    }
  }

  // Initial load (both zones in parallel)
  void refreshCharts();
  void refreshHeatmaps();

  // Live updates from monitor
  if (mc) {
    const unsubscribeSymbolUpdates = mc.subscribeSymbolUpdates((update) => {
      if (!isRunning) return;
      const current = store.getState();
      if (current.symbol !== update.symbol) return;
      const today = getTodayDateCT();
      if (current.dateStart > today || current.dateEnd < today) return;
      if (!update.dbPersisted) return;
      void refreshCharts(false);
      void refreshHeatmaps(false);
    });
    cleanups.push(unsubscribeSymbolUpdates);
  }

  wrapper.cleanup = () => {
    isRunning = false;
    updateOptionsStatus("inactive");
    if (copyOutResetTimer != null) {
      window.clearTimeout(copyOutResetTimer);
      copyOutResetTimer = null;
    }
    for (const fn of cleanups) {
      try {
        fn();
      } catch {}
    }
    cleanups.length = 0;
    for (const p of panels) {
      try {
        p.cleanup?.();
      } catch {}
    }
    panels.length = 0;
  };

  return wrapper;
}
