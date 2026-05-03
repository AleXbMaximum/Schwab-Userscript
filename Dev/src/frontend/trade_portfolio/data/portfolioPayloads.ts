/**
 * Portfolio page payload builders.
 *
 * Pure / deterministic helpers that assemble the prop bundles for each
 * panel from the orchestrator-provided derived state, headerController,
 * and live settings. Lifted out of page.ts so the render path becomes
 * a sequence of `updateOrCreate(slot, key, () => panel(builder(input)))`
 * calls rather than 100+ lines of inline payload wiring.
 */

import type { PortfolioControlState } from "../types";
import type { BetaFactorScenarioInput } from "backend/computation/risk/RiskMetricsCalculator";
import type {
  TickerBetaBundle,
  ThreeFactorBundle,
} from "../../../backend/computation/beta/types";
import { computeWeightedBetaForBenchmarks } from "../../../backend/computation/beta/betaEnrichment";
import { computeLinkedTargets } from "../../../backend/computation/rebalance/RebalanceCalculator";
import { extractEtfUnderlyingKeysFromGroups } from "../../../shared/utils/domain/holdingsGroups";

// ── Quote price resolution ──────────────────────────────────────────────────

export function resolveQuoteLastPrice(
  symbol: string,
  quoteBySymbol: Record<string, any>,
  byUnderlying?: Record<string, any>,
): number | null {
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
}

// ── Beta exposure payload ───────────────────────────────────────────────────

export type BetaPayloadInput = {
  derived: any;
  data: any;
  liveSettings: any;
  headerController: any;
  triggerPortfolioRecalculate: () => void;
};

export function buildBetaPayload(input: BetaPayloadInput) {
  const { derived, data, liveSettings, headerController } = input;
  const allBenchmarkBetas =
    headerController?.getAllBenchmarkBetaData?.() ??
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

  const targetByUnderlying: Record<
    string,
    { deltaNotionalDol: number | null }
  > = {};
  const rebTargets = liveSettings.rebalanceTargets ?? {};
  const acctVal = Math.max(derived.portfolioAgg?.netMarketValue ?? 1, 1);
  const currentBm = headerController?.getCurrentBenchmark?.() || "$SPX";
  const currentBmData = allBenchmarkBetas.get(currentBm);
  for (const [key, entry] of Object.entries(rebTargets) as [string, any][]) {
    if (!entry?.anchor || entry?.value == null) continue;
    const price = resolveQuoteLastPrice(key, quoteBySymbol, byU) ?? 0;
    const beta = currentBmData?.get(key)?.short?.beta ?? 1;
    const linked = computeLinkedTargets(entry, price, beta, acctVal);
    targetByUnderlying[key] = { deltaNotionalDol: linked.deltaDollar };
  }
  for (const key in byU) {
    if (!targetByUnderlying[key]) {
      targetByUnderlying[key] = {
        deltaNotionalDol: byU[key]?.deltaNotionalDol ?? null,
      };
    }
  }

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

  return {
    allBenchmarkBetas,
    portfolioWeightedBeta,
    targetPortfolioWeightedBeta,
    byUnderlying: derived.byUnderlying || {},
    targetByUnderlying,
    accountValue: acctVal,
    rebalanceTargets: liveSettings.rebalanceTargets,
    currentBenchmark: currentBm,
    extraTickers: headerController?.getExtraBetaTickers?.() ?? [],
    betaCalcStatus: headerController?.getBetaCalcStatus?.() ?? {
      isFetching: false,
      error: null,
    },
    onRecalculate: () => {
      input.triggerPortfolioRecalculate();
    },
    onAddTicker: (symbol: string) => {
      headerController?.addExtraBetaTicker?.(symbol);
    },
    onRemoveTicker: (symbol: string) => {
      headerController?.removeExtraBetaTicker?.(symbol);
    },
  };
}

// ── Scenario card payload ───────────────────────────────────────────────────

export type ScenarioPayloadInput = {
  riskMetrics: any;
  controlState: PortfolioControlState;
  derived: any;
  latestThreeFactorData: Map<string, ThreeFactorBundle> | null;
  headerController: any;
  allBenchmarkBetas: Map<string, Map<string, TickerBetaBundle>>;
  onModelTypeChange: (type: "anchor" | "threeFactor") => void;
  onHorizonChange: (
    horizon: "ultraShort" | "short" | "medium" | "long",
  ) => void;
  onCustomScenarioChange: (input: BetaFactorScenarioInput | null) => void;
};

export function buildScenarioPayload(input: ScenarioPayloadInput) {
  return {
    riskMetrics: input.riskMetrics,
    modelType: input.controlState.scenarioModelType,
    horizon: input.controlState.scenarioHorizon,
    byUnderlying: input.derived.byUnderlying || {},
    threeFactorData:
      input.latestThreeFactorData ??
      input.headerController?.getThreeFactorData?.() ??
      null,
    allBenchmarkBetas:
      input.allBenchmarkBetas.size > 0 ? input.allBenchmarkBetas : null,
    onModelTypeChange: input.onModelTypeChange,
    onHorizonChange: input.onHorizonChange,
    onCustomScenarioChange: input.onCustomScenarioChange,
  };
}

// ── Rebalance payload ───────────────────────────────────────────────────────

export type RebalancePayloadInput = {
  riskMetrics: any;
  derived: any;
  liveSettings: any;
  controlState: PortfolioControlState;
  latestBetaData: Map<string, TickerBetaBundle> | null;
  quoteBySymbol: Record<string, any>;
  holdings: any;
  headerController: any;
  ctx: { onUpdateSettings: (next: any, opts: { rerender: boolean }) => void };
  triggerPortfolioRecalculate: () => void;
};

export function buildRebalancePayload(input: RebalancePayloadInput) {
  const etfUnderlyingKeys = extractEtfUnderlyingKeysFromGroups(
    input.holdings?.accounts?.[0]?.groupedPositions,
  );

  return {
    riskMetrics: input.riskMetrics,
    derived: input.derived,
    limits: input.liveSettings.riskLimits,
    riskAppetite: input.controlState.riskAppetite,
    severityFilter: input.controlState.severityFilter,
    targetAllocations: input.liveSettings.targetAllocations,
    rebalanceTargets: input.liveSettings.rebalanceTargets,
    rebalanceProfiles: input.liveSettings.rebalanceProfiles,
    betaData: input.latestBetaData ?? undefined,
    quoteBySymbol: input.quoteBySymbol,
    etfUnderlyingKeys,
    extraBetaTickers: input.headerController?.getExtraBetaTickers?.() ?? [],
    showRiskIdeas: true,
    showTradeSuggestions: true,
    onRecalculate: () => {
      input.triggerPortfolioRecalculate();
    },
    onUpdateTargetAllocations: (next: any) => {
      input.ctx.onUpdateSettings({ targetAllocations: next } as any, {
        rerender: false,
      });
    },
    onUpdateRebalanceTargets: (next: any) => {
      input.ctx.onUpdateSettings({ rebalanceTargets: next } as any, {
        rerender: false,
      });
    },
    onUpdateRebalanceProfiles: (next: any) => {
      input.ctx.onUpdateSettings({ rebalanceProfiles: next } as any, {
        rerender: false,
      });
    },
    onAddTicker: (symbol: string) => {
      input.headerController?.addExtraBetaTicker?.(symbol);
    },
    onRemoveTicker: (symbol: string) => {
      input.headerController?.removeExtraBetaTicker?.(symbol);
    },
  };
}
