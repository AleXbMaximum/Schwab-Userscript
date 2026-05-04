import { ui_createElement } from "../components/core/builders/createElement";
import { DS_TYPOGRAPHY } from "../components/core/styles/theme";
import type { HoldingsViewCtx } from "shared/types/core";
import { computeRiskMetrics } from "backend/computation/risk/RiskMetricsCalculator";
import type { BetaFactorScenarioInput } from "backend/computation/risk/RiskMetricsCalculator";
import { logService } from "shared/log/core/LogService";
import { renderPortfolioHealthScore } from "./components/overview/PortfolioHealthScore";
import { renderPortfolioStateVector } from "./components/overview/PortfolioStateVector";
import { renderGreeksRiskPanel } from "./components/exposure/GreeksRiskPanel";
import { renderBetaExposurePanel } from "./components/exposure/BetaExposurePanel";
import { renderScenarioCardPanel } from "./components/scenarios/ScenarioCardPanel";
import { renderPortfolioControlBar } from "./components/governance/PortfolioControlBar";
import { renderRebalanceIdeasPanel } from "./components/governance/RebalanceIdeasPanel";
import type { PortfolioControlState, PortfolioSectionId } from "./types";
import type {
  TickerBetaBundle,
  ThreeFactorBundle,
} from "../../backend/computation/beta/types";
import { createPortfolioSettingsPanel } from "./setting_panel/settingsPanel";

import {
  ALL_PORTFOLIO_SECTIONS,
  createPortfolioLifecycle,
  type ComponentRef,
  type Slots,
} from "./data/portfolioLifecycle";
import {
  buildBetaPayload,
  buildRebalancePayload,
  buildScenarioPayload,
} from "./data/portfolioPayloads";
import type { PortfolioSectionLayoutResult } from "./components/layout/PortfolioSectionLayout";

export function riskManagement_renderPage(
  ctx: HoldingsViewCtx,
): HTMLElement & { cleanup?: () => void } {
  const log = logService.namespace("render");
  const { settings } = ctx;
  const headerController = (ctx as any).headerController;

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

  const manualExpandedSections = new Set<PortfolioSectionId>([
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

  const components: Record<string, ComponentRef> = {};
  const sectionLayoutRef: { value: PortfolioSectionLayoutResult | null } = {
    value: null,
  };
  const slotsRef: { value: Slots | null } = { value: null };

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

  const syncAllStickyTops = (): void => {
    const svEl = stateVectorPlaceholder.firstElementChild as HTMLElement | null;
    if (svEl) svEl.style.top = "0px";

    const svH = getStateVectorStickyHeight();

    const controlBar =
      (components["controlBar"] as HTMLElement | undefined) ??
      (controlBarPlaceholder.firstElementChild as HTMLElement | null);
    if (controlBar) controlBar.style.top = `${svH}px`;

    const cbH = getControlBarStickyHeight();
    const navBarEl = navBarPlaceholder.firstElementChild as HTMLElement | null;
    if (navBarEl) navBarEl.style.top = `${svH + cbH}px`;
  };

  const lifecycle = createPortfolioLifecycle(
    {
      components,
      sectionLayout: sectionLayoutRef,
      slots: slotsRef,
      navBarPlaceholder,
      stateVectorPlaceholder,
      controlBarPlaceholder,
      contentArea,
    },
    {
      syncAllStickyTops,
      getControlState: () => controlState,
      manualExpandedSections,
    },
  );
  const { cleanupComponent, cleanupAllComponents, updateOrCreate, ensureSectionLayout } =
    lifecycle;


  const makeChip = (text: string): HTMLElement => {
    return ui_createElement("span", {
      text,
      styleString:
        "font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 4px;" +
        " background: var(--ax-bg-chip); color: var(--ios-text-secondary); white-space: nowrap;",
    });
  };

  const updateSectionChips = (riskMetrics: any) => {
    const layout = sectionLayoutRef.value;
    if (!layout) return;

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

    ALL_PORTFOLIO_SECTIONS.forEach((sectionId) => {
      const chips = layout.getSectionInfoChips(sectionId);
      chips.innerHTML = "";
      bySection[sectionId].forEach((text) => chips.appendChild(makeChip(text)));
    });
  };

  const applyFocusMode = (scroll: boolean) => {
    const layout = sectionLayoutRef.value;
    if (!layout) return;

    if (controlState.focusMode === "all") {
      ALL_PORTFOLIO_SECTIONS.forEach((sectionId) => {
        layout.setExpanded(sectionId, manualExpandedSections.has(sectionId));
      });
      return;
    }

    if (controlState.focusMode === "breaches") {
      layout.setExpanded("overview", true);
      layout.setExpanded("exposure", false);
      layout.setExpanded("scenarios", false);
      layout.setExpanded("governance", true);
      if (scroll) {
        layout.scrollToSection("governance");
        layout.highlightCard("rebalanceIdeas");
      }
      return;
    }

    layout.setExpanded("overview", true);
    layout.setExpanded("exposure", false);
    layout.setExpanded("scenarios", true);
    layout.setExpanded("governance", false);
    if (scroll) {
      layout.scrollToSection("scenarios");
      layout.highlightCard("stressPlaybook");
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

      const riskMetrics = computeRiskMetrics(
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
              ALL_PORTFOLIO_SECTIONS.forEach((s) =>
                manualExpandedSections.add(s),
              );
              syncControlBarState();
              applyFocusMode(false);
              queueRender(true);
            },
            onCollapseAll: () => {
              controlState = { ...controlState, focusMode: "all" };
              manualExpandedSections.clear();
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
      const slots = slotsRef.value;
      const layout = sectionLayoutRef.value;
      if (!slots || !layout) return;

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

      const betaPayload = buildBetaPayload({
        derived,
        data,
        liveSettings,
        headerController,
        triggerPortfolioRecalculate,
      });
      updateOrCreate(
        slots.betaExposure,
        "betaExposure",
        () => renderBetaExposurePanel(betaPayload),
        [betaPayload],
      );

      const scenarioCardPayload = buildScenarioPayload({
        riskMetrics,
        controlState,
        derived,
        latestThreeFactorData,
        headerController,
        allBenchmarkBetas: betaPayload.allBenchmarkBetas,
        onModelTypeChange: (type) => {
          controlState = { ...controlState, scenarioModelType: type };
          cleanupComponent("heatmap");
          queueRender(true);
        },
        onHorizonChange: (horizon) => {
          controlState = { ...controlState, scenarioHorizon: horizon };
          cleanupComponent("heatmap");
          queueRender(true);
        },
        onCustomScenarioChange: (input) => {
          customScenarioInput = input;
          cleanupComponent("heatmap");
          queueRender(true);
        },
      });
      updateOrCreate(
        slots.heatmap,
        "heatmap",
        () => renderScenarioCardPanel(scenarioCardPayload),
        [scenarioCardPayload],
      );

      const rebalancePayload = buildRebalancePayload({
        riskMetrics,
        derived,
        liveSettings,
        controlState,
        latestBetaData,
        quoteBySymbol: (data.quotesBySymbol ?? {}) as Record<string, any>,
        holdings,
        headerController,
        ctx: ctx as any,
        triggerPortfolioRecalculate,
      });
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
