import type{ UnderlyingAggRow } from "../../../shared/types/derived";
import { isFiniteNumber } from "../../../shared/utils/math/guards";
import type { ThreeFactorBundle, TickerBetaBundle, BetaHorizon } from "../beta/types";
import type {
  BetaFactorScenarioInput,
  BetaFactorScenarioResult,
  ScenarioModelType,
  BetaFactorPositionPnl,
} from "./types";

function resolveSingleBeta(
  agg: UnderlyingAggRow,
  bundle: TickerBetaBundle | undefined,
  horizon: BetaHorizon,
): number | null {
  const aggField: Record<BetaHorizon, number | null | undefined> = {
    ultraShort: agg.betaUltraShort,
    week: agg.betaWeek,
    short: agg.betaShort,
    medium: agg.betaMedium,
    long: agg.betaLong,
  };
  const enriched = aggField[horizon];
  if (enriched != null && isFiniteNumber(enriched)) return enriched;

  const result = bundle?.[horizon];
  if (result?.beta != null && isFiniteNumber(result.beta)) return result.beta;

  return null;
}

export function computeSingleBetaFactorScenario(
  input: BetaFactorScenarioInput,
  byUnderlying: Record<string, UnderlyingAggRow>,
  marketValue: number,
  modelType: ScenarioModelType,
  horizon: BetaHorizon,
  threeFactorData?: Map<string, ThreeFactorBundle> | null,
  allBenchmarkBetas?: Map<string, Map<string, TickerBetaBundle>> | null,
): BetaFactorScenarioResult {
  const f1 = input.spxMove / 100;
  const f2 = (input.ndxMove - input.spxMove) / 100;
  const f3 = (input.djiMove - input.spxMove) / 100;

  const positions: BetaFactorPositionPnl[] = [];
  let totalPnl = 0;
  let rSquaredWeightedSum = 0;
  let rSquaredWeightTotal = 0;
  let coveredNotional = 0;
  let totalNotional = 0;
  let coveredCount = 0;
  let totalCount = 0;

  const spxBetas = allBenchmarkBetas?.get("$SPX");

  for (const key in byUnderlying) {
    const agg = byUnderlying[key];
    const price = agg.underlyingPrice;
    const absNotional = Math.abs(agg.deltaNotionalDol ?? 0);
    totalNotional += absNotional;
    totalCount++;

    if (price == null || price <= 0) {
      positions.push({
        underlyingKey: key,
        predictedReturn: 0,
        deltaPnl: 0,
        gammaPnl: 0,
        vegaPnl: 0,
        thetaPnl: 0,
        totalPnl: 0,
        rSquared: 0,
        residualStd: 0,
        sampleSize: 0,
        modelUsed: "none",
        betaMkt: 0,
        betaNdxRel: 0,
        betaDjiRel: 0,
      });
      continue;
    }

    let predictedReturn = 0;
    let posRSquared = 0;
    let posResidualStd = 0;
    let posSampleSize = 0;
    let posModelUsed: "threeFactor" | "anchor" | "none" = "none";
    let posBetaMkt = 0;
    let posBetaNdxRel = 0;
    let posBetaDjiRel = 0;
    let hasBeta = false;

    if (modelType === "threeFactor") {
      const tfBundle = threeFactorData?.get(key);
      const tfResult = tfBundle?.[horizon];
      if (tfResult) {
        predictedReturn =
          tfResult.betaMkt * f1 +
          tfResult.betaNdxRel * f2 +
          tfResult.betaDjiRel * f3;
        posRSquared = tfResult.rSquared;
        posResidualStd = tfResult.residualStd;
        posSampleSize = tfResult.sampleSize;
        posModelUsed = "threeFactor";
        posBetaMkt = tfResult.betaMkt;
        posBetaNdxRel = tfResult.betaNdxRel;
        posBetaDjiRel = tfResult.betaDjiRel;
        hasBeta = true;
      }
    }

    if (!hasBeta) {
      const spxBundle = spxBetas?.get(key);
      const betaSpx = resolveSingleBeta(agg, spxBundle, horizon);
      if (betaSpx != null) {
        predictedReturn = betaSpx * f1;
        const spxResult = spxBundle?.[horizon];
        posRSquared = spxResult?.rSquared ?? 0;
        posSampleSize = spxResult?.sampleSize ?? 0;
        posModelUsed = "anchor";
        posBetaMkt = betaSpx;
        hasBeta = true;
      }
    }

    if (!hasBeta) {
      positions.push({
        underlyingKey: key,
        predictedReturn: 0,
        deltaPnl: 0,
        gammaPnl: 0,
        vegaPnl: 0,
        thetaPnl: 0,
        totalPnl: 0,
        rSquared: 0,
        residualStd: 0,
        sampleSize: 0,
        modelUsed: "none",
        betaMkt: 0,
        betaNdxRel: 0,
        betaDjiRel: 0,
      });
      continue;
    }

    coveredNotional += absNotional;
    coveredCount++;

    const priceMove = price * predictedReturn;
    const deltaShares = agg.totalDeltaShares ?? 0;
    const gamma = agg.totalGammaSharesPerDol ?? 0;
    const vega = agg.totalVegaPerVolPoint ?? 0;
    const theta = agg.totalThetaPerDay ?? 0;

    const deltaPnl = deltaShares * priceMove;
    const gammaPnl = 0.5 * gamma * priceMove * priceMove;
    const vegaPnl = vega * input.volShift;
    const thetaPnl = theta * input.horizonDays;
    const posPnl = deltaPnl + gammaPnl + vegaPnl + thetaPnl;

    totalPnl += posPnl;

    if (posRSquared > 0 && absNotional > 0) {
      rSquaredWeightedSum += posRSquared * absNotional;
      rSquaredWeightTotal += absNotional;
    }

    positions.push({
      underlyingKey: key,
      predictedReturn,
      deltaPnl,
      gammaPnl,
      vegaPnl,
      thetaPnl,
      totalPnl: posPnl,
      rSquared: posRSquared,
      residualStd: posResidualStd,
      sampleSize: posSampleSize,
      modelUsed: posModelUsed,
      betaMkt: posBetaMkt,
      betaNdxRel: posBetaNdxRel,
      betaDjiRel: posBetaDjiRel,
    });
  }

  positions.sort((a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl));

  const avgRSquared =
    positions.length > 0
      ? positions.reduce((s, p) => s + Math.abs(p.predictedReturn), 0) /
        positions.length
      : 0;
  // All Pct fields are ratios 0–1
  const modelExplainedPct =
    rSquaredWeightTotal > 0
      ? rSquaredWeightedSum / rSquaredWeightTotal
      : 0;
  const coveredPct =
    totalNotional > 0 ? coveredNotional / totalNotional : 0;
  const weightedResidualPct = Math.max(0, 1 - modelExplainedPct);

  let confidenceLevel: "high" | "medium" | "low" = "medium";
  if (modelExplainedPct >= 0.60 && coveredPct >= 0.80) confidenceLevel = "high";
  else if (modelExplainedPct < 0.30 || coveredPct < 0.50) confidenceLevel = "low";

  return {
    name: input.name,
    input,
    portfolioPnl: totalPnl,
    portfolioPnlPct: marketValue > 0 ? totalPnl / marketValue : 0,
    positions,
    avgRSquared,
    coveredPct,
    modelExplainedPct,
    coveredCount,
    totalCount,
    weightedResidualPct,
    confidenceLevel,
  };
}
