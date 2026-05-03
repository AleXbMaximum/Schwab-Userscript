import { createTableController } from "./holding_table/controller/TableController";
import { injectTableStyles } from "./holding_table/render/tableStyles";
import { ui_createElement } from "../components/core/builders/createElement";
import { DS_BUTTONS, DS_COMPONENTS, DS_SPACING, DS_TYPOGRAPHY } from "../components/core/styles/theme";
import { getLayoutMode } from "../components/core/behaviors/layoutMode";
import type{ HoldingsViewCtx } from "shared/types/core";
import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { KVStore } from "backend/core/db/core/KVStore";
import { chartDataService } from "../../backend/core/network/chart/ChartDataService";
import { setAnalysisSymbol } from "../analysis_ai/orchestration/symbolInput";
import { openCompanyDetailsPanel } from "../components/companyDetailsCard/CompanyDetailsPanel";
import {
  normalizeHoldingsTableViewModes,
  normalizeHoldingsTableActiveViewModeId,
} from "../../shared/types/holdingsTableColumns";
import { ui_copyTextToClipboard } from "../components/core/behaviors/clipboard";
import { openNewsPanel } from "../news_page/panel/NewsPanel";
import { renderRebalanceIdeasPanel } from "../trade_portfolio/components/governance/RebalanceIdeasPanel";
import { createMobileCardView } from "./holding_table/mobileCardView";
import { IntradaySparklineStore } from "./holding_table/sparkline/IntradaySparklineStore";
import { extractEtfUnderlyingKeysFromGroups } from "../../shared/utils/domain/holdingsGroups";
import { createHoldingsSettingsPanel } from "./setting_panel/settingsPanel";
import { resolveNonNegativeInterval } from "../components/core/settingsFramework";
import { logService } from "../../shared/log/core/LogService";

const log = logService.namespace("render");

export type HoldingsViewContainer = HTMLElement & { cleanup?: () => void };

export function holdings_renderPage(
  ctx: HoldingsViewCtx,
): HoldingsViewContainer {
  injectTableStyles();
  log.info("holdings.renderPage", { mobile: getLayoutMode() === "mobile" });

  if (getLayoutMode() === "mobile") {
    return holdings_renderMobilePage(ctx);
  }

  const { settings } = ctx;
  const headerController = (ctx as any).headerController;
  const triggerRebalanceRecalculate = (): void => {
    const hc = headerController as any;
    if (hc?.triggerRebalanceRecalc) {
      hc.triggerRebalanceRecalc();
      return;
    }
    if (hc?.triggerBetaRecalc) hc.triggerBetaRecalc();
  };

  let isRunning = true;
  let currentSortState: any = { colId: null, asc: true };
  let sortStateReady = false;
  let pendingOpeningData: any = null;

  // Load persisted sort state BEFORE first render to avoid unsorted flash
  {
    const loadSortState = async () => {
      try {
        const db = await openAlexQuantDB();
        const kv = new KVStore(db);
        const saved = await kv.get("ui.holdingsTableSort");
        if (saved && typeof saved === "object") {
          currentSortState = saved;
        }
      } catch {}
      sortStateReady = true;
      // Flush deferred render if data arrived before sort state loaded
      if (pendingOpeningData) {
        const data = pendingOpeningData;
        pendingOpeningData = null;
        renderQueued = true;
        requestAnimationFrame(() => renderOpening(data));
      }
    };
    void loadSortState();
  }

  const container = ui_createElement("div", {
    className: "holdings-page-root",
    styleString:
      `padding: ${DS_SPACING.md} ${DS_SPACING.lg} ${DS_SPACING.lg};` +
      " height: 100%; min-height: 0; box-sizing: border-box;" +
      " display: flex; flex-direction: column;",
  }) as HoldingsViewContainer;

  const modes = normalizeHoldingsTableViewModes(
    (settings as any).holdingsTableViewModes,
  );
  const activeModeId = normalizeHoldingsTableActiveViewModeId(
    (settings as any).holdingsTableActiveViewModeId,
    modes,
  );
  const activeMode = modes.find((m) => m.id === activeModeId) ?? modes[0];

  const visibleModes = modes.filter(
    (m) => m.isVisible !== false || m.id === activeModeId,
  );

  const topBar = ui_createElement("div", {
    styleString: `display:flex; align-items:center; margin-bottom:${DS_SPACING.md}; flex:0 0 auto;`,
  });

  const controlsContainer = ui_createElement("div", {
    styleString:
      `display:flex; align-items:center; gap:${DS_SPACING.md};` +
      ` flex-wrap:wrap; justify-content:flex-end; width:100%;`,
  });

  if (visibleModes.length > 1) {
    controlsContainer.appendChild(
      ui_createElement("div", {
        text: "View:",
        styleString: DS_TYPOGRAPHY.controlLabel,
      }),
    );

    const select = ui_createElement("select", {
      styleString:
        "padding: 6px 10px; border: 1px solid var(--ax-border); border-radius: var(--ax-radius-lg); font-size: var(--ax-fs-md);" +
        " font-family: var(--ax-font-body); background: var(--ax-bg-input); cursor: pointer;" +
        " outline: none; transition: border-color 0.2s, box-shadow 0.2s;",
    }) as HTMLSelectElement;

    for (const m of visibleModes) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      if (m.id === activeModeId) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener("change", () => {
      const nextId = select.value;
      if (nextId === activeModeId) return;
      ctx.onUpdateSettings({ holdingsTableActiveViewModeId: nextId } as any);
    });

    controlsContainer.appendChild(select);
  }

  const tableContainer = ui_createElement("div", {
    className: "table-scroll",
    styleString:
      DS_COMPONENTS.card +
      ` padding: 0; width: 100%; flex: 1 1 auto; min-height: 0;` +
      " overflow: auto; scrollbar-gutter: auto; padding-right: 0;",
  });

  const copyTableJsonButton = ui_createElement("button", {
    text: "Copy Table",
    styleString:
      DS_BUTTONS.secondary +
      " padding: 6px 12px; font-size: 12px; border-radius: 10px;",
  }) as HTMLButtonElement;

  const copyOverviewButton = ui_createElement("button", {
    text: "Copy Overview",
    styleString:
      DS_BUTTONS.secondary +
      " padding: 6px 12px; font-size: 12px; border-radius: 10px;",
  }) as HTMLButtonElement;

  container.appendChild(tableContainer);

  let lastTableCtx: any = null;
  let latestBetaData: Map<string, any> | null = null;

  const tableController = createTableController({
    chartDataService,
    columnOrder: activeMode?.columnOrder,
    onSortChange: (newState: any) => {
      currentSortState = newState;
      // Fire-and-forget async save
      void (async () => {
        try {
          const db = await openAlexQuantDB();
          const kv = new KVStore(db);
          await kv.set("ui.holdingsTableSort", newState);
        } catch {}
      })();
      if (lastTableCtx) {
        tableController.update({
          ...lastTableCtx,
          sortState: currentSortState,
        });
      }
    },
    onColumnOrderChange: (newOrder: any) => {
      const updatedModes = modes.map((m) =>
        m.id === activeModeId ? { ...m, columnOrder: newOrder } : m,
      );
      ctx.onUpdateSettings({ holdingsTableViewModes: updatedModes } as any);
    },
    actionsConfig: {
      onNews: (sym) => openNewsPanel(sym),
      onCompanyDetails: (sym) => openCompanyDetailsPanel(sym),
      onAIAnalysis: (sym: string) => {
        setAnalysisSymbol(sym);
        const changeView = (ctx as any).changeView as
          | ((v: string) => void)
          | undefined;
        changeView?.("AI_ANALYSIS");
      },
    },
  });
  tableContainer.appendChild(tableController.table);

  // Initialize sparkline refresh from persisted settings (both table + index stores)
  {
    const savedInterval = resolveNonNegativeInterval(
      (settings as any).sparklineRefreshInterval,
      300_000, // 5 min default
    );
    tableController.sparklineStore.setRefreshInterval(savedInterval);
    headerController?.getIndexSparklineStore()?.setRefreshInterval(savedInterval);
  }

  copyTableJsonButton.addEventListener("click", async () => {
    const payload = tableController.exportJson();
    if (!payload) return;
    const text = JSON.stringify(payload, null, 2);
    await ui_copyTextToClipboard(text);
  });
  controlsContainer.appendChild(copyTableJsonButton);

  copyOverviewButton.addEventListener("click", async () => {
    const overview = headerController?.getLatestOverview?.();
    if (!overview) return;
    const frame = headerController?.getLatestFrame();
    const asOfTs = frame?.derived?.asOfTs ?? null;
    const text = JSON.stringify(
      { asOfTs, metrics: overview },
      null,
      2,
    );
    await ui_copyTextToClipboard(text);
  });
  controlsContainer.appendChild(copyOverviewButton);

  // ── Rebalance button + popover (left of settings gear) ──
  const rebalanceWrap = ui_createElement("div", {
    styleString: "position: relative; flex-shrink: 0;",
  });
  const rebalanceBtn = ui_createElement("button", {
    props: {
      type: "button",
      title: "Rebalance",
      "aria-label": "Rebalance",
      "aria-expanded": "false",
      innerHTML:
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"></path>' +
        "</svg>",
    },
    styleString:
      "width: 32px; height: 32px; border-radius: var(--ax-radius-lg); cursor: pointer;" +
      " border: 1px solid var(--ax-border); color: var(--ax-fg-2);" +
      " background: var(--ax-bg-input); display: flex; align-items: center; justify-content: center;" +
      " transition: all 0.15s;",
  }) as HTMLButtonElement;
  rebalanceWrap.appendChild(rebalanceBtn);

  const rebalancePopover = ui_createElement("div", {
    styleString:
      "position: absolute; top: 38px; right: 0; z-index: var(--z-page-popover, 210);" +
      " width: min(max-content, calc(100vw - 24px)); max-width: calc(100vw - 24px);" +
      " max-height: 80vh; overflow-y: auto;" +
      " border: 1px solid var(--ax-border); border-radius: var(--ax-radius-xl);" +
      " background: var(--ax-bg-card); box-shadow: var(--ax-shadow-lg);" +
      " display: none;",
  });
  rebalanceWrap.appendChild(rebalancePopover);

  type RebalancePanelRef = HTMLElement & {
    cleanup?: () => void;
    update?: (...args: any[]) => void;
  };
  let rebalancePanelRef: RebalancePanelRef | null = null;

  const renderRebalancePopoverContent = (data: any) => {
    const derived = data?.derived;
    if (!derived) return;

    const liveSettings = (ctx.settings ?? settings) as any;
    const betaData = latestBetaData ?? data?.beta ?? null;
    const quoteBySymbol = (data?.quotesBySymbol ?? {}) as Record<string, any>;
    const hc = headerController as any;

    const etfUnderlyingKeys = extractEtfUnderlyingKeysFromGroups(
      data?.holdings?.accounts?.[0]?.groupedPositions,
    );

    const rebalancePayload = {
      derived,
      quoteBySymbol,
      targetAllocations: liveSettings.targetAllocations,
      rebalanceTargets: liveSettings.rebalanceTargets,
      rebalanceProfiles: liveSettings.rebalanceProfiles,
      betaData: betaData ?? undefined,
      etfUnderlyingKeys,
      extraBetaTickers: hc?.getExtraBetaTickers?.() ?? [],
      showRiskIdeas: false,
      showTradeSuggestions: false,
      onRecalculate: () => {
        triggerRebalanceRecalculate();
      },
      onUpdateTargetAllocations: (next: any) => {
        ctx.onUpdateSettings({ targetAllocations: next } as any, {
          rerender: false,
        });
      },
      onUpdateRebalanceTargets: (next: any) => {
        ctx.onUpdateSettings({ rebalanceTargets: next } as any, {
          rerender: false,
        });
      },
      onUpdateRebalanceProfiles: (next: any) => {
        ctx.onUpdateSettings({ rebalanceProfiles: next } as any, {
          rerender: false,
        });
      },
      onAddTicker: (symbol: string) => {
        if (hc?.addExtraBetaTicker) hc.addExtraBetaTicker(symbol);
      },
      onRemoveTicker: (symbol: string) => {
        if (hc?.removeExtraBetaTicker) hc.removeExtraBetaTicker(symbol);
      },
    };

    if (rebalancePanelRef?.update) {
      rebalancePanelRef.update(rebalancePayload);
    } else {
      rebalancePopover.innerHTML = "";
      rebalancePanelRef = renderRebalanceIdeasPanel(rebalancePayload);
      rebalancePopover.appendChild(rebalancePanelRef);
    }
  };

  let isRebalanceOpen = false;
  const setRebalanceOpen = (open: boolean): void => {
    isRebalanceOpen = open;
    rebalancePopover.style.display = open ? "block" : "none";
    rebalanceBtn.setAttribute("aria-expanded", open ? "true" : "false");
    rebalanceBtn.style.background = open
      ? "rgba(0,122,255,0.12)"
      : "var(--ax-bg-input)";
    rebalanceBtn.style.borderColor = open
      ? "rgba(0,122,255,0.4)"
      : "var(--ax-border)";
    rebalanceBtn.style.color = open
      ? "var(--ax-blue)"
      : "var(--ios-text-secondary)";
    if (open) {
      const latestData = headerController?.getLatestFrame?.();
      if (latestData) renderRebalancePopoverContent(latestData);
    }
  };
  rebalanceBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setRebalanceOpen(!isRebalanceOpen);
  });
  const handleOutsideRebalanceClick = (e: MouseEvent) => {
    if (!isRebalanceOpen) return;
    const target = e.target as Node | null;
    if (!target) return;
    if (rebalanceBtn.contains(target) || rebalancePopover.contains(target))
      return;
    setRebalanceOpen(false);
  };
  const handleRebalanceEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isRebalanceOpen) setRebalanceOpen(false);
  };
  document.addEventListener("mousedown", handleOutsideRebalanceClick);
  document.addEventListener("keydown", handleRebalanceEscape);
  controlsContainer.appendChild(rebalanceWrap);

  const indexSparklineStore = headerController?.getIndexSparklineStore();
  const hcForPhase = headerController as any;
  const holdingsSettingsPanel = createHoldingsSettingsPanel({
    ctx,
    settings: settings as any,
    sparklineStores: [
      tableController.sparklineStore,
      ...(indexSparklineStore ? [indexSparklineStore] : []),
    ],
    phaseApi: {
      getCurrentPhase: () => hcForPhase?.getCurrentPhase?.() ?? "closed",
      getSchedulerStatus: (key: string) =>
        hcForPhase?.getSchedulerStatus?.(key) ?? {
          isFetching: false,
          error: null,
          isPaused: false,
        },
      setSourceOverride: (key: any, state: any) =>
        hcForPhase?.setSourceOverride?.(key, state),
      getSourceOverride: (key: any) =>
        hcForPhase?.getSourceOverride?.(key) ?? "auto",
      subscribeToPhaseChange: (cb: any) =>
        hcForPhase?.subscribeToPhaseChange?.(cb) ?? (() => {}),
    },
  });
  controlsContainer.appendChild(holdingsSettingsPanel.root);

  topBar.appendChild(controlsContainer);
  container.insertBefore(topBar, tableContainer);

  let renderQueued = false;
  let betaRefreshRafId: number | null = null;

  const queueBetaTableRefresh = (): void => {
    if (!isRunning || !lastTableCtx) return;
    if (renderQueued) return;
    if (betaRefreshRafId != null) return;
    betaRefreshRafId = requestAnimationFrame(() => {
      betaRefreshRafId = null;
      if (!isRunning || !lastTableCtx) return;
      if (renderQueued) return;
      tableController.update(lastTableCtx);
    });
  };

  const renderOpening = (data: any) => {
    renderQueued = false;
    if (!isRunning || !data) return;
    if (betaRefreshRafId != null) {
      cancelAnimationFrame(betaRefreshRafId);
      betaRefreshRafId = null;
    }

    const holdings = data.holdings;
    if (holdings) {
      lastTableCtx = {
        hierarchy: data.hierarchy ?? null,
        derived: data.derived,
        warnings: data.warnings,
        changeToken: data.changeToken ?? null,
        sortState: currentSortState,
        quotesBySymbol: data.quotesBySymbol ?? undefined,
      };
      tableController.update(lastTableCtx);

      // Sync rebalance popover if open
      if (isRebalanceOpen) renderRebalancePopoverContent(data);
    }
  };

  const unsubscribe = headerController
    ? headerController.subscribe((data: any) => {
        if (!isRunning) return;
        // Defer first render until persisted sort state is loaded
        if (!sortStateReady) {
          pendingOpeningData = data;
          return;
        }
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(() => renderOpening(data));
      })
    : () => {};

  const unsubBeta = headerController?.subscribeToBeta
    ? headerController.subscribeToBeta((data: Map<string, any>) => {
        if (!isRunning) return;
        latestBetaData = data;
        // DerivedState is already enriched by DataPipelineCoordinator;
        // just trigger a table refresh so updated beta fields are displayed.
        queueBetaTableRefresh();
      })
    : () => {};

  container.cleanup = () => {
    isRunning = false;
    document.removeEventListener("mousedown", handleOutsideRebalanceClick);
    document.removeEventListener("keydown", handleRebalanceEscape);
    holdingsSettingsPanel.cleanup();
    if (rebalancePanelRef?.cleanup) rebalancePanelRef.cleanup();
    unsubscribe();
    unsubBeta();
    if (betaRefreshRafId != null) {
      cancelAnimationFrame(betaRefreshRafId);
      betaRefreshRafId = null;
    }
    tableController.destroy();
  };

  return container;
}

function holdings_renderMobilePage(
  ctx: HoldingsViewCtx,
): HoldingsViewContainer {
  const headerController = (ctx as any).headerController;

  const container = ui_createElement("div", {
    className: "holdings-page-root",
    styleString:
      `padding: ${DS_SPACING.sm} ${DS_SPACING.md};` +
      " height: 100%; min-height: 0; box-sizing: border-box;" +
      " display: flex; flex-direction: column;",
  }) as HoldingsViewContainer;

  let isRunning = true;

  // Dedicated sparkline store for mobile card view
  const sparklineStore = new IntradaySparklineStore(chartDataService);
  const cardView = createMobileCardView({ sparklineStore });

  container.appendChild(cardView.container);

  let renderQueued = false;

  const unsubscribe = headerController
    ? headerController.subscribe((data: any) => {
        if (!isRunning) return;
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(() => {
          renderQueued = false;
          if (!isRunning || !data) return;
          if (data.hierarchy) {
            cardView.update({ hierarchy: data.hierarchy });
          }
        });
      })
    : () => {};

  container.cleanup = () => {
    isRunning = false;
    unsubscribe();
    cardView.destroy();
    sparklineStore.dispose();
  };

  return container;
}
