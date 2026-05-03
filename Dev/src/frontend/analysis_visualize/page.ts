import { ui_createElement } from "../components/core/builders/createElement";
import { DS_TYPOGRAPHY } from "../components/core/styles/theme";
import type{ HoldingsViewCtx } from "shared/types/core";
import type{ HierarchicalHoldings } from "shared/types/derived";
import { logService } from "../../shared/log/core/LogService";
import { renderDayChangeBubble } from "./portfolio/DayChangeBubble";
import { renderGainLossBubble } from "./portfolio/GainLossBubble";
import {
  renderMovingBetaChart,
  type MovingBetaChartResult,
} from "./timeseries/moving_beta/MovingBetaChart";
import {
  renderDualTickerOverlay,
  type DualTickerOverlayResult,
} from "./timeseries/dual_overlay/DualTickerOverlay";
import {
  renderCorrelationBetaHeatmap,
  type CorrelationBetaHeatmapResult,
} from "./heatmap/CorrelationBetaHeatmap";

export type VisualizeUnderlyingData = {
  symbol: string;
  marketValue: number;
  dayChangeDol: number;
  dayChangePct: number;
  gainLossDol: number;
  gainLossPercent: number;
  deltaNotionalDol: number;
  deltaConcentrationPct: number;
  percentOfAccount: number;
};

type VisualizeViewContainer = HTMLElement & { cleanup?: () => void };

type ComponentRef = HTMLElement & {
  cleanup?: () => void;
  update?: (...args: any[]) => void;
};

function extractVisualizeData(
  hierarchy: HierarchicalHoldings,
): VisualizeUnderlyingData[] {
  const items: VisualizeUnderlyingData[] = [];
  const grandTotalMV = hierarchy.grandTotal.marketValue || 1;

  for (const assetClass of hierarchy.assetClasses) {
    for (const ticker of assetClass.tickers) {
      const agg = ticker.aggregated;
      const mv = agg.totalMarketValue ?? 0;
      const costBasis = agg.totalCostBasis ?? 0;
      const dayChange = agg.totalDayChangeDollar ?? 0;
      const gainLoss = agg.totalGainLossDollar ?? 0;

      let dayChangePct = 0;
      if (costBasis !== 0) {
        dayChangePct = dayChange / Math.abs(costBasis);
      } else if (mv !== 0) {
        dayChangePct = dayChange / Math.abs(mv);
      }

      let gainLossPercent = 0;
      if (costBasis !== 0) {
        gainLossPercent = gainLoss / Math.abs(costBasis);
      }

      items.push({
        symbol: ticker.underlyingKey,
        marketValue: mv,
        dayChangeDol: dayChange,
        dayChangePct,
        gainLossDol: gainLoss,
        gainLossPercent,
        deltaNotionalDol: agg.deltaNotionalDol ?? 0,
        deltaConcentrationPct: agg.deltaNotionalConcentrationPct ?? 0,
        percentOfAccount: grandTotalMV > 0 ? mv / grandTotalMV : 0,
      });
    }
  }

  return items;
}

const log = logService.namespace("render");

export function analysisVisualize_renderPage(
  ctx: HoldingsViewCtx,
): VisualizeViewContainer {
  log.info("analysisVisualize.renderPage");
  const headerController = (ctx as any).headerController;

  let isRunning = true;
  let renderQueued = false;

  const container = ui_createElement("div", {
    styleString: "padding: 0;",
  }) as VisualizeViewContainer;

  // Page header
  const header = ui_createElement("div", {
    styleString: "padding: 16px 20px 0;",
  });
  header.appendChild(
    ui_createElement("h2", {
      text: "Visualize",
      styleString: DS_TYPOGRAPHY.pageTitle,
    }),
  );
  container.appendChild(header);

  // Grid container — 3 columns: row 1 = dayChange + gainLoss + dualOverlay, row 2 = movingBeta (span 3)
  const grid = ui_createElement("div", {
    className: "analysisVisualize-grid-responsive",
    styleString:
      "display: grid; grid-template-columns: repeat(3, 1fr);" +
      " gap: 16px; padding: 0 20px 20px;",
  });
  container.appendChild(grid);

  // Panel slots
  const slots: Record<string, HTMLElement> = {};
  const slotKeys = ["dayChange", "gainLoss", "dualOverlay", "movingBeta"];
  for (const key of slotKeys) {
    const fullWidth = key === "movingBeta";
    const slot = ui_createElement("div", {
      styleString:
        "min-width: 0; overflow: hidden;" +
        (fullWidth ? " grid-column: span 3;" : ""),
    });
    slots[key] = slot;
    grid.appendChild(slot);
  }

  // Component refs for lifecycle
  const components: Record<string, ComponentRef> = {};

  function updateOrCreate(
    host: HTMLElement,
    key: string,
    createFn: () => ComponentRef,
    data: VisualizeUnderlyingData[],
  ): void {
    const existing = components[key];
    if (existing?.update) {
      existing.update(data);
      return;
    }
    if (existing?.cleanup) existing.cleanup();
    host.innerHTML = "";
    const next = createFn();
    host.appendChild(next);
    components[key] = next;
  }

  // No-data placeholder
  const noData = ui_createElement("div", {
    text: "Waiting for portfolio data...",
    styleString:
      "grid-column: 1 / -1; text-align: center; padding: 60px 20px;" +
      " font-size: 12px; color: var(--ios-text-secondary);",
  });
  grid.appendChild(noData);

  // Dual Ticker Overlay — inside grid row 2, col 3
  let dualOverlayRef: DualTickerOverlayResult | null = null;
  const chartDataService = headerController?.getChartDataService?.();
  if (chartDataService) {
    dualOverlayRef = renderDualTickerOverlay({ chartDataService });
    slots.dualOverlay.appendChild(dualOverlayRef);
  }

  // Moving Beta chart (managed separately — async, not VisualizeUnderlyingData-based)
  let movingBetaRef: MovingBetaChartResult | null = null;

  // Correlation/Beta Heatmap — full-width row below grid
  let correlationHeatmapRef: CorrelationBetaHeatmapResult | null = null;
  let latestDerived: any = null;
  const heatmapWrap = ui_createElement("div", {
    styleString: "padding: 0 20px 20px;",
  });
  if (chartDataService) {
    container.appendChild(heatmapWrap);
  }

  const renderVisualizeView = (data: any) => {
    renderQueued = false;
    if (!isRunning || !data) return;

    latestDerived = data.derived ?? null;
    const hierarchy: HierarchicalHoldings | null = data.hierarchy ?? null;
    if (!hierarchy) return;

    // Remove no-data placeholder
    if (noData.parentNode) noData.parentNode.removeChild(noData);

    const vizData = extractVisualizeData(hierarchy);
    const symbols = vizData.map((d) => d.symbol);

    updateOrCreate(
      slots.dayChange,
      "dayChange",
      () => renderDayChangeBubble(vizData),
      vizData,
    );
    updateOrCreate(
      slots.gainLoss,
      "gainLoss",
      () => renderGainLossBubble(vizData),
      vizData,
    );

    // Moving Beta
    const betaService = headerController?.getBetaService?.();
    if (betaService && symbols.length > 0) {
      if (!movingBetaRef) {
        const currentBenchmark =
          headerController?.getCurrentBenchmark?.() || "$SPX";
        movingBetaRef = renderMovingBetaChart({
          betaService,
          symbols,
          currentBenchmark,
        });
        slots.movingBeta.appendChild(movingBetaRef);
      } else if (movingBetaRef.update) {
        movingBetaRef.update(symbols);
      }
    }

    // Correlation/Beta Heatmap
    if (chartDataService && symbols.length > 0) {
      if (!correlationHeatmapRef) {
        correlationHeatmapRef = renderCorrelationBetaHeatmap({
          chartDataService,
          symbols,
          getRebalanceTickers: () => {
            const keys = new Set<string>();
            const byUnd = latestDerived?.byUnderlying;
            if (byUnd) for (const k of Object.keys(byUnd)) keys.add(k);
            const rebTargets = ctx.settings?.rebalanceTargets;
            if (rebTargets)
              for (const k of Object.keys(rebTargets)) keys.add(k);
            const extra: string[] =
              headerController?.getExtraBetaTickers?.() ?? [];
            for (const k of extra) keys.add(k);
            return [...keys];
          },
          getMediumBeta: (symbol: string) => {
            const allBeta = headerController?.getAllBenchmarkBetaData?.();
            const spxData = allBeta?.get("$SPX");
            const bundle = spxData?.get(symbol);
            return bundle?.medium?.beta ?? null;
          },
        });
        heatmapWrap.appendChild(correlationHeatmapRef);
      } else if (correlationHeatmapRef.update) {
        correlationHeatmapRef.update(symbols);
      }
    }
  };

  const unsubscribe = headerController
    ? headerController.subscribe((data: any) => {
        if (!isRunning) return;
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(() => renderVisualizeView(data));
      })
    : () => {};

  container.cleanup = () => {
    isRunning = false;
    unsubscribe();
    for (const key of Object.keys(components)) {
      if (components[key]?.cleanup) components[key].cleanup();
    }
    if (movingBetaRef?.cleanup) movingBetaRef.cleanup();
    if (dualOverlayRef?.cleanup) dualOverlayRef.cleanup();
    if (correlationHeatmapRef?.cleanup) correlationHeatmapRef.cleanup();
  };

  return container;
}
