import { ui_createElement } from "../components/core/createElement";
import { DS_TYPOGRAPHY } from "../components/core/theme";
import type{ HoldingsViewCtx } from "shared/types/core";
import { RiskMetricsCalculator } from "backend/computation/risk/RiskMetricsCalculator";
import type { BetaFactorScenarioInput } from "backend/computation/risk/RiskMetricsCalculator";
import { logService } from "shared/log/core/LogService";
import {
  renderPortfolioSectionLayout,
  type PortfolioSectionLayoutResult,
} from "./components/layout/PortfolioSectionLayout";
import { renderPortfolioHealthScore } from "./components/overview/PortfolioHealthScore";
import { renderPortfolioStateVector } from "./components/overview/PortfolioStateVector";
import { renderGreeksRiskPanel } from "./components/exposure/GreeksRiskPanel";
import { renderBetaExposurePanel } from "./components/exposure/BetaExposurePanel";
import { renderScenarioCardPanel } from "./components/scenarios/ScenarioCardPanel";
import { renderPortfolioControlBar } from "./components/governance/PortfolioControlBar";
import { renderRebalanceIdeasPanel } from "./components/governance/RebalanceIdeasPanel";
import type { PortfolioControlState, PortfolioSectionId } from "./types";
import type { TickerBetaBundle, ThreeFactorBundle } from "../../backend/computation/beta/types";
import { computeWeightedBetaForBenchmarks } from "../../backend/computation/beta/betaEnrichment";
import { computeLinkedTargets } from "../../backend/computation/rebalance/RebalanceCalculator";
import { extractEtfUnderlyingKeysFromGroups } from "../../shared/utils/holdingsGroups";
import { createPortfolioSettingsPanel } from "./setting_panel/settingsPanel";

type ComponentRef = HTMLElement & {
  cleanup?: () => void;
  update?: (...args: any[]) => void;
};

type Slots = {
  health: HTMLElement;
  betaExposure: HTMLElement;
  greeks: HTMLElement;
  heatmap: HTMLElement;
  rebalance: HTMLElement;
};

const ALL_SECTIONS: PortfolioSectionId[] = [
  "overview",
  "exposure",
  "scenarios",
  "governance",
];

export function riskManagement_renderPage(
  ctx: HoldingsViewCtx,
): HTMLElement & { cleanup?: () => void } {
  const log = logService.namespace("render");
  const { settings } = ctx;
  const headerController = (ctx as any).headerController;
  const resolveQuoteLastPrice = (
    symbol: string,
    quoteBySymbol: Record<string, any>,
    byUnderlying?: Record<string, any>,
  ): number | null => {
    const normalized =
      typeof symbol === "string" ? symbol.toUpperCase().trim() : "";
    // 1) Try live quote data
    const quoteItem =
      quoteBySymbol[symbol] ??
      (normalized ? quoteBySymbol[normalized] : undefined);
    const raw =
      quoteItem?.quote?.lastPrice ?? quoteItem?.regularQuote?.lastPrice;
    const price = Number(raw);
    if (Number.isFinite(price) && price > 0) return price;
    // 2) Fallback to derived holdings underlying price
    if (byUnderlying) {
      const agg =
        byUnderlying[symbol] ??
        (normalized ? byUnderlying[normalized] : undefined);
      const up = agg?.underlyingPrice;
      if (typeof up === "number" && Number.isFinite(up) && up > 0) return up;
    }
    return null;
  };
  const triggerPortfolioRecalculate = (): void => {
    const hc = headerController as any;
    if (hc?.triggerRebalanceRecalc) {
      hc.triggerRebalanceRecalc();
      return;
    }
    if (hc?.triggerBetaRecalc) hc.triggerBetaRecalc();
  };

  let isRunning = true;
  let latestFrame: any = null;
  let renderQueued = false;

  let controlState: PortfolioControlState = {
    paused: false,
    focusMode: "all",
    severityFilter: "all",
    riskAppetite: 55,
    scenarioModelType: "anchor",
    scenarioHorizon: "short",
  };

  let manualExpandedSections = new Set<PortfolioSectionId>([
    "overview",
    "exposure",
    "scenarios",
    "governance",
  ]);
  let latestBetaData: Map<string, TickerBetaBundle> | null = null;
  let latestThreeFactorData: Map<string, ThreeFactorBundle> | null = null;
  let customScenarioInput: BetaFactorScenarioInput | null = null;

  const wrapper = ui_createElement("div", {
    styleString: "padding: 0;",
  }) as HTMLElement & { cleanup?: () => void };

  const pageHeader = ui_createElement("div", {
    styleString:
      "padding: 16px 20px 10px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;",
  });
  pageHeader.appendChild(
    ui_createElement("span", {
      text: "Portfolio",
      styleString: DS_TYPOGRAPHY.pageTitle,
    }),
  );

  const portfolioSettingsPanel = createPortfolioSettingsPanel({
    ctx,
    settings: settings as any,
    onRecalculate: triggerPortfolioRecalculate,
  });
  portfolioSettingsPanel.root.style.marginLeft = "auto";
  pageHeader.appendChild(portfolioSettingsPanel.root);
  wrapper.appendChild(pageHeader);

  // Placeholder for the section nav bar (extracted from sectionLayout, pinned at top)
  const navBarPlaceholder = ui_createElement("div", {
    styleString: "display: none;",
  });
  const stateVectorPlaceholder = ui_createElement("div", {
    styleString: "display: none;",
  });
  const controlBarPlaceholder = ui_createElement("div", {
    styleString: "display: none;",
  });
  const contentArea = ui_createElement("div", {
    styleString: "display: none; padding: 0 20px 20px; min-width: 0;",
  });

  wrapper.appendChild(stateVectorPlaceholder);
  wrapper.appendChild(controlBarPlaceholder);
  wrapper.appendChild(navBarPlaceholder);
  wrapper.appendChild(contentArea);

  const getStateVectorStickyHeight = (): number =>
    Math.max(
      0,
      Math.round(
        stateVectorPlaceholder.getBoundingClientRect().height ||
          stateVectorPlaceholder.offsetHeight ||
          0,
      ),
    );

  const getControlBarStickyHeight = (): number =>
    Math.max(
      0,
      Math.round(
        controlBarPlaceholder.getBoundingClientRect().height ||
          controlBarPlaceholder.offsetHeight ||
          0,
      ),
    );

  /** Sync all sticky top offsets: stateVector → controlBar → navBar (top-down stacking). */
  const syncAllStickyTops = (): void => {
    // State vector sticks at the very top
    const svEl = stateVectorPlaceholder.firstElementChild as HTMLElement | null;
    if (svEl) svEl.style.top = "0px";

    const svH = getStateVectorStickyHeight();

    // Control bar sticks below the state vector
    const controlBar =
      (components["controlBar"] as HTMLElement | undefined) ??
      (controlBarPlaceholder.firstElementChild as HTMLElement | null);
    if (controlBar) controlBar.style.top = `${svH}px`;

    // Nav bar sticks below the state vector + control bar
    const cbH = getControlBarStickyHeight();
    const navBarEl = navBarPlaceholder.firstElementChild as HTMLElement | null;
    if (navBarEl) navBarEl.style.top = `${svH + cbH}px`;
  };

  const riskCalculator = new RiskMetricsCalculator();

  let components: Record<string, ComponentRef> = {};
  let sectionLayout: PortfolioSectionLayoutResult | null = null;
  let slots: Slots | null = null;

  const cleanupComponent = (key: string) => {
    const comp = components[key];
    if (!comp) return;
    if (comp.cleanup) {
      try {
        comp.cleanup();
      } catch (err) {
        log.warn("component.cleanup.fail", {
          key,
          error: (err as Error)?.message,
        });
      }
    }
    delete components[key];
  };

  const cleanupAllComponents = () => {
    Object.keys(components).forEach((key) => cleanupComponent(key));
    sectionLayout = null;
    slots = null;
    navBarPlaceholder.innerHTML = "";
    stateVectorPlaceholder.innerHTML = "";
    controlBarPlaceholder.innerHTML = "";
    contentArea.innerHTML = "";
  };

  const updateOrCreate = (
    host: HTMLElement,
    componentKey: string,
    createFn: () => ComponentRef,
    updateArgs?: any[],
  ) => {
    const existing = components[componentKey];

    if (existing && existing.update && updateArgs) {
      try {
        existing.update(...updateArgs);
        return;
      } catch (err) {
        log.warn("component.update.fail", {
          key: componentKey,
          error: (err as Error)?.message,
        });
        cleanupComponent(componentKey);
      }
    }

    if (components[componentKey]) {
      cleanupComponent(componentKey);
    }

    const next = createFn();
    host.innerHTML = "";
    host.appendChild(next);
    components[componentKey] = next;
  };

  const ensureSectionLayout = () => {
    if (sectionLayout && slots) {
      syncAllStickyTops();
      return;
    }

    if (sectionLayout) {
      cleanupComponent("sectionLayout");
      sectionLayout = null;
      slots = null;
    }

    const layout = renderPortfolioSectionLayout(
      (id: PortfolioSectionId, expanded: boolean) => {
        if (controlState.focusMode !== "all") return;
        if (expanded) manualExpandedSections.add(id);
        else manualExpandedSections.delete(id);
      },
    );

    contentArea.innerHTML = "";
    contentArea.appendChild(layout);

    // Extract the nav bar from the section layout and pin it at the top of the page
    const navBarEl = layout.getNavBar();
    navBarPlaceholder.innerHTML = "";
    navBarPlaceholder.appendChild(navBarEl);
    navBarPlaceholder.style.display = "block";
    navBarEl.style.zIndex = "var(--z-sticky-nav, 100)";

    syncAllStickyTops();

    sectionLayout = layout;
    components.sectionLayout = layout;

    slots = {
      health: layout.getCardSlot("overview", "healthScore", 1, "text"),
      greeks: layout.getCardSlot("overview", "greeks", 1, "chart"),

      betaExposure: layout.getCardSlot("exposure", "betaExposure", 3, "text", 1, true),

      heatmap: layout.getCardSlot("scenarios", "heatmap", 3, "interactive"),

      rebalance: layout.getCardSlot("governance", "rebalanceIdeas", 3, "text", 1, true),
    };
  };

  const makeChip = (text: string): HTMLElement => {
    return ui_createElement("span", {
      text,
      styleString:
        "font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 4px;" +
        " background: var(--ax-bg-chip); color: var(--ios-text-secondary); white-space: nowrap;",
    });
  };

  const updateSectionChips = (riskMetrics: any) => {
    if (!sectionLayout) return;

    const top1 = riskMetrics.topUnderlyingConcentrations[0]?.deltaPct ?? 0;
    const worst = Math.min(
      0,
      ...riskMetrics.scenarios.map((s: any) => s.pnlPct),
    );
    const breaches = riskMetrics.limitBreaches.length;

    const bySection: Record<PortfolioSectionId, string[]> = {
      overview: [`Mode ${controlState.focusMode}`, `${breaches} breach(es)`],
      exposure: [
        `Top1 ${(top1 * 100).toFixed(1)}%`,
        `Net Delta ${riskMetrics.netDeltaDollars >= 0 ? "+" : ""}${(riskMetrics.netDeltaDollars / 1000).toFixed(1)}k`,
      ],
      scenarios: [
        `Worst ${(worst * 100).toFixed(2)}%`,
        `Appetite ${controlState.riskAppetite}`,
      ],
      governance: [
        `Severity ${controlState.severityFilter}`,
        `Beta ${riskMetrics.currentBeta.toFixed(2)}`,
      ],
    };

    ALL_SECTIONS.forEach((sectionId) => {
      const chips = sectionLayout!.getSectionInfoChips(sectionId);
      chips.innerHTML = "";
      bySection[sectionId].forEach((text) => chips.appendChild(makeChip(text)));
    });
  };

  const applyFocusMode = (scroll: boolean) => {
    if (!sectionLayout) return;

    if (controlState.focusMode === "all") {
      ALL_SECTIONS.forEach((sectionId) => {
        sectionLayout!.setExpanded(
          sectionId,
          manualExpandedSections.has(sectionId),
        );
      });
      return;
    }

    if (controlState.focusMode === "breaches") {
      sectionLayout.setExpanded("overview", true);
      sectionLayout.setExpanded("exposure", false);
      sectionLayout.setExpanded("scenarios", false);
      sectionLayout.setExpanded("governance", true);
      if (scroll) {
        sectionLayout.scrollToSection("governance");
        sectionLayout.highlightCard("rebalanceIdeas");
      }
      return;
    }

    sectionLayout.setExpanded("overview", true);
    sectionLayout.setExpanded("exposure", false);
    sectionLayout.setExpanded("scenarios", true);
    sectionLayout.setExpanded("governance", false);
    if (scroll) {
      sectionLayout.scrollToSection("scenarios");
      sectionLayout.highlightCard("stressPlaybook");
    }
  };

  const queueRender = (force = false) => {
    if (renderQueued) return;
    if (!latestFrame) return;
    if (controlState.paused && !force) return;

    renderQueued = true;
    requestAnimationFrame(renderPortfolioView);
  };

  const syncControlBarState = () => {
    const controlBar = components.controlBar;
    if (controlBar?.update) {
      try {
        controlBar.update(controlState);
      } catch (err) {
        log.warn("controlBar.sync.fail", { error: (err as Error)?.message });
      }
    }
  };

  const renderPortfolioView = () => {
    renderQueued = false;
    if (!isRunning || !latestFrame) return;

    const liveSettings = (ctx.settings ?? settings) as any;
    const data = latestFrame;
    const holdings = data.holdings;
    const derived = data.derived;
    const account = holdings?.accounts?.[0];
    const totals = account?.totals;

    if (!derived || !account) {
      cleanupAllComponents();
      navBarPlaceholder.style.display = "none";
      stateVectorPlaceholder.style.display = "none";
      controlBarPlaceholder.style.display = "none";
      contentArea.style.display = "block";
      contentArea.innerHTML =
        '<div style="padding: 24px; color: var(--ios-text-secondary); text-align: center;">No portfolio data available.</div>';
      return;
    }

    try {
      const tfDataResolved =
        latestThreeFactorData ??
        (headerController as any)?.getThreeFactorData?.() ??
        null;
      const betaFactorPayload = {
        threeFactorData: tfDataResolved,
        allBenchmarkBetas:
          (headerController as any)?.getAllBenchmarkBetaData?.() ?? null,
        modelType: controlState.scenarioModelType,
        horizon: controlState.scenarioHorizon,
        customScenario: customScenarioInput,
      };

      const riskMetrics = riskCalculator.computeRiskMetrics(
        derived,
        account,
        totals,
        liveSettings.riskLimits,
        betaFactorPayload,
      );

      const timestamp =
        typeof derived.asOfTs === "number" && Number.isFinite(derived.asOfTs)
          ? new Date(derived.asOfTs).toISOString()
          : null;

      stateVectorPlaceholder.style.display = "block";
      updateOrCreate(
        stateVectorPlaceholder,
        "stateVector",
        () =>
          renderPortfolioStateVector({
            riskMetrics,
            portfolioAgg: derived.portfolioAgg,
            timestamp,
          }),
        [{ riskMetrics, portfolioAgg: derived.portfolioAgg, timestamp }],
      );

      controlBarPlaceholder.style.display = "block";
      updateOrCreate(
        controlBarPlaceholder,
        "controlBar",
        () =>
          renderPortfolioControlBar(controlState, {
            onPauseToggle: (paused) => {
              controlState = { ...controlState, paused };
              syncControlBarState();
              if (!paused) queueRender(true);
            },
            onFocusModeChange: (focusMode) => {
              controlState = { ...controlState, focusMode };
              syncControlBarState();
              applyFocusMode(true);
              queueRender(true);
            },
            onSeverityChange: (severityFilter) => {
              controlState = { ...controlState, severityFilter };
              syncControlBarState();
              queueRender(true);
            },
            onRiskAppetiteChange: (riskAppetite) => {
              controlState = { ...controlState, riskAppetite };
              syncControlBarState();
              queueRender(true);
            },
            onExpandAll: () => {
              controlState = { ...controlState, focusMode: "all" };
              manualExpandedSections = new Set(ALL_SECTIONS);
              syncControlBarState();
              applyFocusMode(false);
              queueRender(true);
            },
            onCollapseAll: () => {
              controlState = { ...controlState, focusMode: "all" };
              manualExpandedSections = new Set<PortfolioSectionId>();
              syncControlBarState();
              applyFocusMode(false);
              queueRender(true);
            },
          }),
        [controlState],
      );
      syncAllStickyTops();

      contentArea.style.display = "block";
      ensureSectionLayout();
      if (!slots || !sectionLayout) return;

      updateSectionChips(riskMetrics);

      updateOrCreate(
        slots.health,
        "healthScore",
        () =>
          renderPortfolioHealthScore({
            riskMetrics,
            portfolioAgg: derived.portfolioAgg,
          }),
        [{ riskMetrics, portfolioAgg: derived.portfolioAgg }],
      );

      updateOrCreate(
        slots.greeks,
        "greeks",
        () => renderGreeksRiskPanel(riskMetrics, derived),
        [riskMetrics, derived],
      );

      // Build multi-benchmark beta payload
      const allBenchmarkBetas =
        (headerController as any)?.getAllBenchmarkBetaData?.() ??
        new Map<string, Map<string, TickerBetaBundle>>();
      const byU = derived.byUnderlying || {};
      const quoteBySymbol = (data.quotesBySymbol ?? {}) as Record<string, any>;
      const netMV = Math.abs(derived.portfolioAgg?.netMarketValue ?? 0);
      const totalAbsDelta = derived.portfolioAgg?.totalAbsDeltaNotionalDol ?? 0;
      const portfolioWeightedBeta = computeWeightedBetaForBenchmarks(
        byU,
        allBenchmarkBetas,
        netMV,
        totalAbsDelta,
      );
      const hc = headerController as any;

      // Compute target-mode delta notional from rebalance targets
      const targetByUnderlying: Record<
        string,
        { deltaNotionalDol: number | null }
      > = {};
      const rebTargets = liveSettings.rebalanceTargets ?? {};
      const acctVal = Math.max(derived.portfolioAgg?.netMarketValue ?? 1, 1);
      const currentBm = headerController?.getCurrentBenchmark?.() || "$SPX";
      const currentBmData = allBenchmarkBetas.get(currentBm);
      for (const [key, entry] of Object.entries(rebTargets) as [
        string,
        any,
      ][]) {
        if (!entry?.anchor || entry?.value == null) continue;
        const price = resolveQuoteLastPrice(key, quoteBySymbol, byU) ?? 0;
        const beta = currentBmData?.get(key)?.short?.beta ?? 1;
        const linked = computeLinkedTargets(entry, price, beta, acctVal);
        targetByUnderlying[key] = { deltaNotionalDol: linked.deltaDollar };
      }
      // Holdings tickers with no target keep current exposure
      for (const key in byU) {
        if (!targetByUnderlying[key]) {
          targetByUnderlying[key] = {
            deltaNotionalDol: byU[key]?.deltaNotionalDol ?? null,
          };
        }
      }

      // Target-mode portfolio weighted beta
      let tgtTotalAbsDelta = 0;
      for (const uk in targetByUnderlying) {
        tgtTotalAbsDelta += Math.abs(
          targetByUnderlying[uk]?.deltaNotionalDol ?? 0,
        );
      }
      const targetPortfolioWeightedBeta = computeWeightedBetaForBenchmarks(
        targetByUnderlying,
        allBenchmarkBetas,
        netMV,
        tgtTotalAbsDelta,
      );

      const betaPayload = {
        allBenchmarkBetas,
        portfolioWeightedBeta,
        targetPortfolioWeightedBeta,
        byUnderlying: derived.byUnderlying || {},
        targetByUnderlying,
        accountValue: acctVal,
        rebalanceTargets: liveSettings.rebalanceTargets,
        currentBenchmark: currentBm,
        extraTickers: hc?.getExtraBetaTickers?.() ?? [],
        betaCalcStatus: hc?.getBetaCalcStatus?.() ?? {
          isFetching: false,
          error: null,
        },
        onRecalculate: () => {
          triggerPortfolioRecalculate();
        },
        onAddTicker: (symbol: string) => {
          if (hc?.addExtraBetaTicker) hc.addExtraBetaTicker(symbol);
        },
        onRemoveTicker: (symbol: string) => {
          if (hc?.removeExtraBetaTicker) hc.removeExtraBetaTicker(symbol);
        },
      };
      updateOrCreate(
        slots.betaExposure,
        "betaExposure",
        () => renderBetaExposurePanel(betaPayload),
        [betaPayload],
      );

      // Beta factor scenario cards
      const scenarioCardPayload = {
        riskMetrics,
        modelType: controlState.scenarioModelType,
        horizon: controlState.scenarioHorizon,
        byUnderlying: derived.byUnderlying || {},
        threeFactorData:
          latestThreeFactorData ??
          (headerController as any)?.getThreeFactorData?.() ??
          null,
        allBenchmarkBetas:
          allBenchmarkBetas.size > 0 ? allBenchmarkBetas : null,
        onModelTypeChange: (type: "anchor" | "threeFactor") => {
          controlState = { ...controlState, scenarioModelType: type };
          cleanupComponent("heatmap");
          queueRender(true);
        },
        onHorizonChange: (
          horizon: "ultraShort" | "short" | "medium" | "long",
        ) => {
          controlState = { ...controlState, scenarioHorizon: horizon };
          cleanupComponent("heatmap");
          queueRender(true);
        },
        onCustomScenarioChange: (input: BetaFactorScenarioInput | null) => {
          customScenarioInput = input;
          cleanupComponent("heatmap");
          queueRender(true);
        },
      };
      updateOrCreate(
        slots.heatmap,
        "heatmap",
        () => renderScenarioCardPanel(scenarioCardPayload),
        [scenarioCardPayload],
      );

      const etfUnderlyingKeys = extractEtfUnderlyingKeysFromGroups(
        holdings?.accounts?.[0]?.groupedPositions,
      );

      const rebalancePayload = {
        riskMetrics,
        derived,
        limits: liveSettings.riskLimits,
        riskAppetite: controlState.riskAppetite,
        severityFilter: controlState.severityFilter,
        targetAllocations: liveSettings.targetAllocations,
        rebalanceTargets: liveSettings.rebalanceTargets,
        rebalanceProfiles: liveSettings.rebalanceProfiles,
        betaData: latestBetaData ?? undefined,
        quoteBySymbol,
        etfUnderlyingKeys,
        extraBetaTickers: hc?.getExtraBetaTickers?.() ?? [],
        showRiskIdeas: true,
        showTradeSuggestions: true,
        onRecalculate: () => {
          triggerPortfolioRecalculate();
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
      updateOrCreate(
        slots.rebalance,
        "rebalance",
        () => renderRebalanceIdeasPanel(rebalancePayload),
        [rebalancePayload],
      );

      applyFocusMode(false);
    } catch (err) {
      log.error("portfolio.render.fail", {
        error: (err as Error)?.message,
      });
      contentArea.style.display = "block";
      contentArea.innerHTML = `<div style="padding: 24px; color: var(--ios-red);">Error rendering portfolio view: ${(err as Error)?.message}</div>`;
    }
  };

  const unsubscribe = headerController
    ? headerController.subscribe((data: any) => {
        latestFrame = data;
        if (controlState.paused) return;
        queueRender();
      })
    : () => {};
  const unsubBeta = headerController?.subscribeToBeta
    ? headerController.subscribeToBeta(
        (data: Map<string, TickerBetaBundle>) => {
          latestBetaData = data;
          queueRender();
        },
      )
    : () => {};
  const unsubThreeFactor = headerController?.subscribeToThreeFactor
    ? headerController.subscribeToThreeFactor(
        (data: Map<string, ThreeFactorBundle>) => {
          latestThreeFactorData = data;
          queueRender();
        },
      )
    : (() => () => {})();
  const handleResize = () => {
    syncAllStickyTops();
  };
  window.addEventListener("resize", handleResize);

  // Delayed auto-recalculate: ensures watchlist / non-holding tickers get
  // fresh quotes & beta on page entry without blocking the initial render.
  const initRecalcTimer = setTimeout(() => {
    if (isRunning) triggerPortfolioRecalculate();
  }, 1500);

  wrapper.cleanup = () => {
    isRunning = false;
    clearTimeout(initRecalcTimer);
    portfolioSettingsPanel.cleanup();
    window.removeEventListener("resize", handleResize);
    unsubscribe();
    unsubBeta();
    unsubThreeFactor();
    cleanupAllComponents();
  };

  return wrapper;
}
