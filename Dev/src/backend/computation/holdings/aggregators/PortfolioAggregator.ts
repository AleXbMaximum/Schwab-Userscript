import type{ PortfolioAgg, UnderlyingAggRow } from "../../../../shared/types/derived";
import type { HoldingsIndex } from "../../../pipeline/ingestion/holdingsIndexTypes";
import { isFiniteNumber } from "../../../../shared/utils/math/guards";
import { extractMarketValue } from "../metrics/valueExtractors";
import { logService } from "../../../../shared/log/core/LogService";

const log = logService.namespace("holdings");

export class PortfolioAggregator {
  computePortfolioAgg(
    holdingsIndex: HoldingsIndex,
    derivedByHoldings: Record<string, any>,
    underlyingAgg?: Record<string, UnderlyingAggRow>,
  ): PortfolioAgg {
    let netMarketValue = 0;
    let grossMarketValue = 0;
    let longCount = 0;
    let shortCount = 0;
    let longMarketValue = 0;
    let shortMarketValue = 0;
    const absMarketValueList: number[] = [];
    let totalAbsDeltaShares = 0;
    let optionAbsDeltaShares = 0;

    let totalAbsDeltaNotionalDol = 0;
    let totalAbsVegaPerVolPoint = 0;
    let totalThetaPerDay: number | null = 0;
    let totalVegaPerVolPoint: number | null = 0;
    let totalRhoPer1pctRate = 0;
    let totalUPnlUp1PctDol = 0;
    let totalUPnlDn1PctDol = 0;
    let totalGammaSharesPerDol = 0;
    let totalAbsGammaSharesPerDol = 0;
    let totalMarginReqDol = 0;
    let totalConvexityDol = 0;

    for (const [holdingsKey, meta] of holdingsIndex.entries()) {
      const derived = derivedByHoldings[holdingsKey];
      if (!derived) continue;

      const row = meta.row;
      const mv = extractMarketValue(row);

      if (mv != null) {
        netMarketValue += mv;
        grossMarketValue += Math.abs(mv);
        absMarketValueList.push(Math.abs(mv));

        if (mv > 0.01) {
          longCount++;
          longMarketValue += mv;
        } else if (mv < -0.01) {
          shortCount++;
          shortMarketValue += mv;
        }
      }

      const deltaShares = derived.deltaShares;
      if (deltaShares != null) {
        const absDeltaShares = Math.abs(deltaShares);
        totalAbsDeltaShares += absDeltaShares;

        if (derived.optDeltaShares != null) {
          optionAbsDeltaShares += absDeltaShares;
        }
      }
    }

    if (underlyingAgg) {
      for (const uk of Object.keys(underlyingAgg)) {
        const u = underlyingAgg[uk];
        const dn = u?.deltaNotionalDol;
        if (isFiniteNumber(dn)) {
          totalAbsDeltaNotionalDol += Math.abs(dn);
        }

        const vega = u?.totalVegaPerVolPoint;
        if (isFiniteNumber(vega)) {
          totalAbsVegaPerVolPoint += Math.abs(vega);
          totalVegaPerVolPoint = (totalVegaPerVolPoint ?? 0) + vega;
        }

        const theta = u?.totalThetaPerDay;
        if (isFiniteNumber(theta)) {
          totalThetaPerDay = (totalThetaPerDay ?? 0) + theta;
        }

        const rho = u?.totalRhoPer1pctRate;
        if (isFiniteNumber(rho)) {
          totalRhoPer1pctRate += rho;
        }

        const pnlUp = u?.uPnlUp1PctDol;
        if (isFiniteNumber(pnlUp)) {
          totalUPnlUp1PctDol += pnlUp;
        }

        const pnlDn = u?.uPnlDn1PctDol;
        if (isFiniteNumber(pnlDn)) {
          totalUPnlDn1PctDol += pnlDn;
        }

        const gamma = u?.totalGammaSharesPerDol;
        if (isFiniteNumber(gamma)) {
          totalGammaSharesPerDol += gamma;
        }

        const absGamma = (u as any)?.absGammaSharesPerDol;
        if (isFiniteNumber(absGamma)) {
          totalAbsGammaSharesPerDol += absGamma;
        }

        const margin = u?.totalMarginReqDol;
        if (isFiniteNumber(margin)) {
          totalMarginReqDol += margin;
        }

        const convexity = (u as any)?.convexityDol;
        if (isFiniteNumber(convexity)) {
          totalConvexityDol += convexity;
        }
      }
    }

    absMarketValueList.sort((a, b) => b - a);
    const top1 = absMarketValueList.length > 0 ? absMarketValueList[0] : 0;
    const top5 = absMarketValueList.slice(0, 5).reduce((a, b) => a + b, 0);

    log.debug("computePortfolioAgg.done", {
      positions: holdingsIndex.size,
      long: longCount,
      short: shortCount,
      netMV: +netMarketValue.toFixed(0),
      grossMV: +grossMarketValue.toFixed(0),
    });

    return {
      netMarketValue: netMarketValue,
      grossMarketValue: grossMarketValue,
      totalAbsDeltaNotionalDol,
      totalAbsVegaPerVolPoint,
      totalThetaPerDay,
      totalVegaPerVolPoint,
      longCount,
      shortCount,
      longMarketValue: longMarketValue,
      shortMarketValue: shortMarketValue,
      top1ConcentrationPct: grossMarketValue > 0 ? top1 / grossMarketValue : 0,
      top5ConcentrationPct: grossMarketValue > 0 ? top5 / grossMarketValue : 0,
      optionsRiskSharePct:
        totalAbsDeltaShares > 0
          ? optionAbsDeltaShares / totalAbsDeltaShares
          : 0,
      totalRhoPer1pctRate,
      totalUPnlUp1PctDol,
      totalUPnlDn1PctDol,
      totalGammaSharesPerDol,
      totalAbsGammaSharesPerDol,
      totalMarginReqDol,
      totalConvexityDol,
    };
  }

}
