import type{ DerivedState, UnderlyingAggRow } from "../../../shared/types/derived";
import type{ HoldingsAccount } from "../../../shared/types/holdings";
import type{ RiskLimits } from "../../../shared/types/core";
import { sumByField } from "./aggregateHelpers";
import {
  calculateScenarios,
  checkLimitBreaches,
  computeConcentrations,
  computeGammaDollarExposure,
  computeNetDeltaDollars,
  computeNetDeltaShares,
  computeTotalAbsGamma,
  computeUsedMargin,
} from "./coreMetrics";
import { computeSingleBetaFactorScenario } from "./betaFactorScenario";
import {
  PRESET_BETA_FACTOR_SCENARIOS,
  type BetaFactorScenarioResult,
  type RiskMetrics,
  type BetaFactorDataPayload,
} from "./types";
import { logService } from "../../../shared/log/core/LogService";

const log = logService.namespace("risk");

export function computeRiskMetrics(
  derived: DerivedState | null,
  account: HoldingsAccount | null,
  totals: any,
  limits?: RiskLimits,
  betaFactorPayload?: BetaFactorDataPayload | null,
): RiskMetrics {
  const portfolioAgg = derived?.portfolioAgg;
  const byUnderlying = derived?.byUnderlying || {};

  const marketValue = totals?.marketValue ?? totals?.liquidationValue ?? 0;
  const grossMarketValue = portfolioAgg?.grossMarketValue ?? marketValue;

  const totalMargin = marketValue;
  const usedMargin = computeUsedMargin(byUnderlying);
  const availableMargin = Math.max(0, totalMargin - usedMargin);
  // Ratio 0–1; formatPct handles ×100 for display
  const marginUtilizationPct = totalMargin > 0 ? usedMargin / totalMargin : 0;

  const absDeltaNotionalDol = sumByField(
    byUnderlying,
    (r) => r?.deltaNotionalDol,
    { cached: portfolioAgg?.totalAbsDeltaNotionalDol, abs: true },
  );
  const weightedBeta = portfolioAgg?.portfolioWeightedBetaShort ?? 0;
  const betaScale =
    Math.abs(marketValue) > 0 ? absDeltaNotionalDol / Math.abs(marketValue) : 0;
  const currentBeta = weightedBeta * betaScale;

  const netDeltaShares = computeNetDeltaShares(byUnderlying);
  const netDeltaDollars = computeNetDeltaDollars(byUnderlying);
  const totalAbsGamma = computeTotalAbsGamma(byUnderlying);
  const totalGammaDollarExposure = computeGammaDollarExposure(byUnderlying);
  const dailyThetaDecay = sumByField(
    byUnderlying,
    (r) => r?.totalThetaPerDay,
    { cached: portfolioAgg?.totalThetaPerDay },
  );
  const totalAbsVega = sumByField(
    byUnderlying,
    (r) => r?.totalVegaPerVolPoint,
    { cached: portfolioAgg?.totalAbsVegaPerVolPoint, abs: true },
  );
  const totalRho = sumByField(byUnderlying, (r) => r?.totalRhoPer1pctRate);

  const topUnderlyingConcentrations = computeConcentrations(
    byUnderlying,
    absDeltaNotionalDol,
    marketValue,
    usedMargin,
  );

  const scenarios = calculateScenarios(
    portfolioAgg,
    byUnderlying,
    totalAbsVega,
    marketValue,
  );

  const betaFactorScenarios = calculateBetaFactorScenarios(
    byUnderlying,
    marketValue,
    betaFactorPayload,
  );

  const metrics = {
    marginUtilizationPct,
    currentBeta,
    netDeltaShares,
    totalAbsVega,
    topUnderlyingConcentrations,
    marketValue,
  };
  const limitBreaches = checkLimitBreaches(metrics, limits);

  void account;

  log.debug("computeRiskMetrics.done", {
    underlyings: Object.keys(byUnderlying).length,
    marginUtil: +(marginUtilizationPct * 100).toFixed(1),
    beta: +currentBeta.toFixed(3),
    breaches: limitBreaches.length,
    scenarios: betaFactorScenarios.length,
  });

  return {
    marginUtilizationPct,
    currentBeta,
    availableMargin,
    totalMargin,
    usedMargin,
    netDeltaShares,
    netDeltaDollars,
    totalAbsGamma,
    totalGammaDollarExposure,
    dailyThetaDecay,
    totalAbsVega,
    totalRho,
    marketValue,
    grossMarketValue,
    topUnderlyingConcentrations,
    scenarios,
    betaFactorScenarios,
    limitBreaches,
  };
}

function calculateBetaFactorScenarios(
  byUnderlying: Record<string, UnderlyingAggRow>,
  marketValue: number,
  payload?: BetaFactorDataPayload | null,
): BetaFactorScenarioResult[] {
  if (!payload) return [];

  const modelType = payload.modelType ?? "anchor";
  const horizon = payload.horizon ?? "short";
  const inputs = [...PRESET_BETA_FACTOR_SCENARIOS];
  if (payload.customScenario) inputs.push(payload.customScenario);

  return inputs.map((input) =>
    computeSingleBetaFactorScenario(
      input,
      byUnderlying,
      marketValue,
      modelType,
      horizon,
      payload.threeFactorData,
      payload.allBenchmarkBetas,
    ),
  );
}

export type {
  ScenarioModelType,
  BetaFactorScenarioInput,
  BetaFactorPositionPnl,
  BetaFactorScenarioResult,
  RiskMetrics,
} from "./types";
