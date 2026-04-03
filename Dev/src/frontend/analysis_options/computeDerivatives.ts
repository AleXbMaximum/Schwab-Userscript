import type{ OptionsChain, OptionsChainsResponse, OptionsExpiration } from "shared/types/options";
import type {
  GreeksBasis,
  GexGammaSource,
  OptionsWallData,
  GexAnalytics,
} from "backend/computation/options/types";
import type { LocalWindowMode } from "./types";
import { applyLocalWindowFilter } from "./store/filters";
import {
  computeGexAnalytics,
  computeCumulativeGex,
  computeScenarioShift,
  computeBSScenarioShift,
} from "backend/computation/options/gex";
import {
  computeIVSkew,
  computeTermStructure,
  computeVolSurface,
  computeVolSurfaceDiagnostics,
  computeIVSmileOverlay,
} from "backend/computation/options/volatility";
import {
  computeOIDistribution,
  computeVolumeProfile,
  computeOptionsWalls,
  computeActivitySurface,
} from "backend/computation/options/distribution";
import {
  computeExpectedMove,
  computeExpectedMoveRND,
  computeProbabilityCone,
  computeProbabilityConeRND,
} from "backend/computation/options/expectedMove";
import { computeGreeksExposure } from "backend/computation/options/greeks";
import {
  computeBidAskSpread,
  computeLiquidityScore,
  computeDataQuality,
} from "backend/computation/options/quality";
import {
  computeSummaryMetrics,
  computePricingAnalysis,
  computeTradingInsights,
  computeKeyLevelsLadder,
  computeStateVector,
} from "backend/computation/options/summary";

export type ComputeInput = {
  response: OptionsChainsResponse;
  exp: OptionsExpiration;
  filteredChains: OptionsChain[];
  greeksBasis: GreeksBasis;
  gammaSource: GexGammaSource;
  localWindowMode: LocalWindowMode;
  localWindowPct: number;
  localWindowDeltaRange: [number, number];
  liquidityThreshold: number;
};

export function computeAllDerivatives(input: ComputeInput) {
  const {
    response,
    exp,
    filteredChains,
    greeksBasis,
    gammaSource,
    localWindowMode,
    localWindowPct,
    localWindowDeltaRange,
    liquidityThreshold,
  } = input;

  const underlyingPrice = response.underlyingPrice;
  const multiplier = response.contractMultiplier;

  // BS config: convert percentage rates to decimals for Black-Scholes
  const bsConfig =
    gammaSource === "bs"
      ? {
          gammaSource: "bs" as const,
          riskFreeRate: (response.interestRate ?? 5) / 100,
          daysToExpiry: exp.daysUntil,
          dividendYield:
            response.dividendYield != null
              ? response.dividendYield / 100
              : undefined,
        }
      : undefined;

  const localWindowExpirations = response.expirations.map((expiration) => ({
    ...expiration,
    chains: applyLocalWindowFilter(
      expiration.chains,
      underlyingPrice,
      localWindowMode,
      localWindowPct,
      localWindowDeltaRange,
    ),
  }));

  const metrics = computeSummaryMetrics(response, exp);

  const unfilteredGex = computeGexAnalytics(
    exp.chains,
    multiplier,
    underlyingPrice,
    greeksBasis,
    bsConfig,
  );
  const unfilteredWalls = computeOptionsWalls(
    exp.chains,
    multiplier,
    underlyingPrice,
    greeksBasis,
    {
      maxPainStrike: metrics.maxPainStrike,
      gexAnalytics: unfilteredGex,
    },
  );
  const filteredGex = computeGexAnalytics(
    filteredChains,
    multiplier,
    underlyingPrice,
    greeksBasis,
    bsConfig,
  );
  const filteredOI = computeOIDistribution(filteredChains);
  const wallData: OptionsWallData = {
    ...unfilteredWalls,
    oiByStrike: filteredOI,
  };
  const gexAnalytics: GexAnalytics = {
    ...unfilteredGex,
    data: filteredGex.data,
  };

  const termData = computeTermStructure(response.expirations, underlyingPrice);
  const emData = computeExpectedMove(
    exp.chains,
    underlyingPrice,
    exp.daysUntil,
    exp.label,
    "mid",
  );
  const rndData = computeExpectedMoveRND(
    exp.chains,
    underlyingPrice,
    exp.daysUntil,
    response.interestRate,
  );
  const straddleConeData = computeProbabilityCone(
    response.expirations,
    underlyingPrice,
    "mid",
  );
  const rndConeData = computeProbabilityConeRND(
    response.expirations,
    underlyingPrice,
    response.interestRate,
  );
  const scenarioDefault = { deltaSpotPct: 0, deltaIVPct: 0, deltaDays: 0 };
  const scenarioOutput =
    bsConfig
      ? computeBSScenarioShift(filteredChains, multiplier, underlyingPrice, scenarioDefault, {
          riskFreeRate: bsConfig.riskFreeRate,
          daysToExpiry: bsConfig.daysToExpiry,
          dividendYield: bsConfig.dividendYield,
        })
      : computeScenarioShift(filteredChains, multiplier, underlyingPrice, scenarioDefault, greeksBasis);
  const ladderData = computeKeyLevelsLadder(
    wallData,
    gexAnalytics,
    scenarioOutput,
    false,
  );
  const stateVectorData = computeStateVector(
    response,
    exp,
    gexAnalytics,
    emData,
  );
  wallData.forward = stateVectorData.forward;

  const skewData = computeIVSkew(filteredChains);
  const smileData = computeIVSmileOverlay(
    localWindowExpirations,
    underlyingPrice,
  );
  const volSurfData = computeVolSurface(
    localWindowExpirations,
    underlyingPrice,
    24,
  );
  const volDiagData = computeVolSurfaceDiagnostics(volSurfData);

  const greeksData = computeGreeksExposure(
    filteredChains,
    multiplier,
    underlyingPrice,
    greeksBasis,
  );
  const volProfileData = computeVolumeProfile(filteredChains);
  const actSurfData = computeActivitySurface(
    localWindowExpirations,
    underlyingPrice,
  );
  const cumGexData = computeCumulativeGex(gexAnalytics.data);

  const spreadData = computeBidAskSpread(filteredChains);
  const liquidityData = computeLiquidityScore(
    exp.chains,
    underlyingPrice,
    liquidityThreshold / 100,
  );
  const qualityData = computeDataQuality(
    response,
    exp,
    liquidityData,
    volDiagData,
  );
  const pricingData = computePricingAnalysis(filteredChains);

  const insightsData = computeTradingInsights(
    metrics,
    gexAnalytics,
    wallData,
    termData,
    emData,
  );
  insightsData.keyLevels = {
    putWall: ladderData.entries.find((e) => e.id === "putWall")?.value ?? null,
    callWall:
      ladderData.entries.find((e) => e.id === "callWall")?.value ?? null,
    maxPain: ladderData.entries.find((e) => e.id === "maxPain")?.value ?? null,
    gammaFlip: ladderData.entries.find((e) => e.id === "flip")?.value ?? null,
    spot: ladderData.spot,
  };

  return {
    metrics,
    gexAnalytics,
    wallData,
    cumGexData,
    scenarioOutput,
    ladderData,
    stateVectorData,
    termData,
    emData,
    rndData,
    straddleConeData,
    rndConeData,
    skewData,
    volSurfData,
    volDiagData,
    smileData,
    greeksData,
    volProfileData,
    actSurfData,
    spreadData,
    liquidityData,
    qualityData,
    pricingData,
    insightsData,
    localWindowExpirations,
  };
}
