import type{
  DerivedMetricsRow,
  PortfolioAgg,
  UnderlyingAggRow,
  UnderlyingKey,
} from "../../../../shared/types/derived";
import type { HoldingsIndex } from "../../../pipeline/ingestion/holdingsIndexTypes";
import { isOption } from "../../../../shared/utils/domain/holdingsKeys";
import { logService } from "shared/log/core/LogService";
import {
  extractPrice,
  extractDayChange,
  extractGainLoss,
  extractCostBasis,
  extractMarketValue,
} from "../metrics/valueExtractors";

const log = logService.namespace("holdings");

export type UnderlyingAggMap = Record<UnderlyingKey, UnderlyingAggRow>;

type PresenceFlags = {
  hasDelta?: boolean;
  hasOptDelta?: boolean;
  hasGamma?: boolean;
  hasTheta?: boolean;
  hasVega?: boolean;
  hasRho?: boolean;
  hasMargin?: boolean;
  hasNearGamma?: boolean;
  hasPrice?: boolean;
  hasMarketValue?: boolean;
  hasCostBasis?: boolean;
  hasDayChange?: boolean;
  hasGainLoss?: boolean;
};

export class UnderlyingAggregator {
  private createEmptyAggRow(underlyingKey: UnderlyingKey): UnderlyingAggRow {
    return {
      underlyingKey,
      totalDeltaShares: 0,
      totalOptDeltaShares: 0,
      totalGammaSharesPerDol: 0,
      totalThetaPerDay: 0,
      totalVegaPerVolPoint: 0,
      totalRhoPer1pctRate: 0,
      absGammaSharesPerDol: 0,
      absVegaPerVolPoint: 0,
      totalMarginReqDol: 0,
      nearTermGammaAbs: 0,
      nearTermGammaWeighted: 0,
      underlyingPrice: null,
      deltaNotionalDol: null,
      deltaNotionalConcentrationPct: null,
      vegaConcentrationPct: null,
      carryPerVega: null,
      carryPerGamma: null,
      thetaOnMargin: null,
      vegaOnMargin: null,
      gammaOnMargin: null,
      deltaSharesPerMargin: null,
      deltaNotionalPerMargin: null,
      thetaPerMargin: null,
      vegaPerMargin: null,
      convexityDol: null,
      totalMarketValue: 0,
      totalCostBasis: 0,
      totalDayChangeDollar: 0,
      totalGainLossDollar: 0,
      dayChangePercent: null,
      gainLossPercent: null,
      uPnlUp1PctDol: null,
      uPnlDn1PctDol: null,
    };
  }

  private enrichWithEfficiency(entry: UnderlyingAggRow): void {
    const absVega =
      entry.absVegaPerVolPoint != null
        ? entry.absVegaPerVolPoint
        : entry.totalVegaPerVolPoint != null
          ? Math.abs(entry.totalVegaPerVolPoint)
          : null;
    const absGamma =
      entry.absGammaSharesPerDol != null
        ? entry.absGammaSharesPerDol
        : entry.totalGammaSharesPerDol != null
          ? Math.abs(entry.totalGammaSharesPerDol)
          : null;
    const margin =
      entry.totalMarginReqDol != null && entry.totalMarginReqDol !== 0
        ? entry.totalMarginReqDol
        : null;

    entry.carryPerVega =
      absVega != null && absVega !== 0 && entry.totalThetaPerDay != null
        ? entry.totalThetaPerDay / absVega
        : null;
    entry.carryPerGamma =
      absGamma != null && absGamma !== 0 && entry.totalThetaPerDay != null
        ? entry.totalThetaPerDay / absGamma
        : null;
    entry.thetaOnMargin =
      margin != null && entry.totalThetaPerDay != null
        ? entry.totalThetaPerDay / margin
        : null;
    entry.vegaOnMargin =
      margin != null && absVega != null ? absVega / margin : null;
    entry.gammaOnMargin =
      margin != null && absGamma != null ? absGamma / margin : null;
    entry.deltaSharesPerMargin =
      margin != null && entry.totalDeltaShares != null
        ? entry.totalDeltaShares / margin
        : null;
    entry.deltaNotionalPerMargin =
      margin != null && entry.deltaNotionalDol != null
        ? entry.deltaNotionalDol / margin
        : null;
    entry.thetaPerMargin =
      margin != null && entry.totalThetaPerDay != null
        ? entry.totalThetaPerDay / margin
        : null;
    entry.vegaPerMargin =
      margin != null && entry.totalVegaPerVolPoint != null
        ? entry.totalVegaPerVolPoint / margin
        : null;
  }

  private finalizeEntry(
    entry: UnderlyingAggRow,
    flags: PresenceFlags | undefined,
  ): void {
    if (!flags?.hasDelta) entry.totalDeltaShares = null;
    if (!flags?.hasOptDelta) entry.totalOptDeltaShares = null;
    if (!flags?.hasGamma) {
      entry.totalGammaSharesPerDol = null;
      entry.absGammaSharesPerDol = null;
    }
    if (!flags?.hasTheta) entry.totalThetaPerDay = null;
    if (!flags?.hasVega) {
      entry.totalVegaPerVolPoint = null;
      entry.absVegaPerVolPoint = null;
    }
    if (!flags?.hasRho) entry.totalRhoPer1pctRate = null;
    if (!flags?.hasMargin) entry.totalMarginReqDol = null;
    if (!flags?.hasNearGamma) {
      entry.nearTermGammaAbs = null;
      entry.nearTermGammaWeighted = null;
    }
    if (!flags?.hasMarketValue) entry.totalMarketValue = null;
    if (!flags?.hasCostBasis) entry.totalCostBasis = null;
    if (!flags?.hasDayChange) entry.totalDayChangeDollar = null;
    if (!flags?.hasGainLoss) entry.totalGainLossDollar = null;

    const prevMv =
      entry.totalMarketValue != null && entry.totalDayChangeDollar != null
        ? entry.totalMarketValue - entry.totalDayChangeDollar
        : null;
    entry.dayChangePercent =
      prevMv != null && prevMv !== 0 && entry.totalDayChangeDollar != null
        ? entry.totalDayChangeDollar / prevMv
        : null;
    entry.gainLossPercent =
      entry.totalCostBasis != null &&
      entry.totalCostBasis !== 0 &&
      entry.totalGainLossDollar != null
        ? entry.totalGainLossDollar / entry.totalCostBasis
        : null;

    if (entry.underlyingPrice == null || entry.totalDeltaShares == null) {
      entry.deltaNotionalDol = null;
    } else {
      entry.deltaNotionalDol = entry.totalDeltaShares * entry.underlyingPrice;
    }

    entry.absGammaSharesPerDol =
      entry.totalGammaSharesPerDol != null
        ? Math.abs(entry.totalGammaSharesPerDol)
        : null;
    entry.absVegaPerVolPoint =
      entry.totalVegaPerVolPoint != null
        ? Math.abs(entry.totalVegaPerVolPoint)
        : null;

    this.enrichWithEfficiency(entry);
  }

  buildUnderlyingAgg(
    holdingsIndex: HoldingsIndex,
    derivedByHoldings: Record<string, DerivedMetricsRow>,
    filterKeys?: Set<UnderlyingKey>,
  ): UnderlyingAggMap {
    const underlyingAgg: UnderlyingAggMap = {};
    const presence = new Map<UnderlyingKey, PresenceFlags>();

    for (const [holdingsKey, meta] of holdingsIndex.entries()) {
      const underlyingKey = meta.underlyingKey;
      if (!underlyingKey) continue;
      if (filterKeys && !filterKeys.has(underlyingKey)) continue;

      if (!underlyingAgg[underlyingKey]) {
        underlyingAgg[underlyingKey] = this.createEmptyAggRow(underlyingKey);
      }
      const flags = presence.get(underlyingKey) ?? {};

      const derived = derivedByHoldings[holdingsKey];
      if (derived) {
        if (derived.deltaShares != null) {
          underlyingAgg[underlyingKey].totalDeltaShares += derived.deltaShares;
          flags.hasDelta = true;
        }
        if (derived.optDeltaShares != null) {
          underlyingAgg[underlyingKey].totalOptDeltaShares +=
            derived.optDeltaShares;
          flags.hasOptDelta = true;
        }
        if (derived.gammaSharesPerDol != null) {
          underlyingAgg[underlyingKey].totalGammaSharesPerDol +=
            derived.gammaSharesPerDol;
          flags.hasGamma = true;
          if (derived.dte != null && derived.dte <= 21) {
            underlyingAgg[underlyingKey].nearTermGammaAbs! += Math.abs(
              derived.gammaSharesPerDol,
            );
            underlyingAgg[underlyingKey].nearTermGammaWeighted! +=
              Math.abs(derived.gammaSharesPerDol) /
              Math.sqrt(Math.max(derived.dte, 1));
            flags.hasNearGamma = true;
          }
        }
        if (derived.thetaPerDay != null) {
          underlyingAgg[underlyingKey].totalThetaPerDay += derived.thetaPerDay;
          flags.hasTheta = true;
        }
        if (derived.vegaPerVolPoint != null) {
          underlyingAgg[underlyingKey].totalVegaPerVolPoint +=
            derived.vegaPerVolPoint;
          flags.hasVega = true;
        }
        if (derived.rhoPer1pctRate != null) {
          underlyingAgg[underlyingKey].totalRhoPer1pctRate! +=
            derived.rhoPer1pctRate;
          flags.hasRho = true;
        }
        if (derived.marginReqDol != null) {
          underlyingAgg[underlyingKey].totalMarginReqDol! +=
            derived.marginReqDol;
          flags.hasMargin = true;
        }
      }

      if (!isOption(meta.row)) {
        const price = extractPrice(meta.row);
        if (price != null) {
          underlyingAgg[underlyingKey].underlyingPrice = price;
          flags.hasPrice = true;
        }
      }

      const marketValueVal = extractMarketValue(meta.row);
      if (marketValueVal != null) {
        underlyingAgg[underlyingKey].totalMarketValue! += marketValueVal;
        flags.hasMarketValue = true;
      }

      const costBasisVal = extractCostBasis(meta.row);
      if (costBasisVal != null) {
        underlyingAgg[underlyingKey].totalCostBasis! += costBasisVal;
        flags.hasCostBasis = true;
      }

      const dayChangeVal = extractDayChange(meta.row);
      if (dayChangeVal != null) {
        underlyingAgg[underlyingKey].totalDayChangeDollar! += dayChangeVal;
        flags.hasDayChange = true;
      }

      const gainLossVal = extractGainLoss(meta.row);
      if (gainLossVal != null) {
        underlyingAgg[underlyingKey].totalGainLossDollar! += gainLossVal;
        flags.hasGainLoss = true;
      }

      presence.set(underlyingKey, flags);
    }

    for (const underlyingKey in underlyingAgg) {
      const entry = underlyingAgg[underlyingKey];
      this.finalizeEntry(entry, presence.get(underlyingKey));
    }

    log.debug("underlyingAgg.build.done", () => ({
      underlyings: Object.keys(underlyingAgg).length,
    }));

    return underlyingAgg;
  }

  enrichWithScenarioPnL(
    underlyingAgg: UnderlyingAggMap,
    holdingsIndex: HoldingsIndex,
    derivedByHoldings: Record<string, DerivedMetricsRow>,
  ): void {
    const uPnlUp1Map = new Map<UnderlyingKey, number>();
    const uPnlDn1Map = new Map<UnderlyingKey, number>();
    const uPnlUp1HasValue = new Set<UnderlyingKey>();
    const uPnlDn1HasValue = new Set<UnderlyingKey>();

    for (const [holdingsKey, meta] of holdingsIndex.entries()) {
      const underlyingKey = meta.underlyingKey;
      if (!underlyingKey) continue;

      const derived = derivedByHoldings[holdingsKey];
      if (!derived) continue;

      if (derived.pnlUp1PctDol != null) {
        uPnlUp1HasValue.add(underlyingKey);
        uPnlUp1Map.set(
          underlyingKey,
          (uPnlUp1Map.get(underlyingKey) ?? 0) + derived.pnlUp1PctDol,
        );
      }

      if (derived.pnlDn1PctDol != null) {
        uPnlDn1HasValue.add(underlyingKey);
        uPnlDn1Map.set(
          underlyingKey,
          (uPnlDn1Map.get(underlyingKey) ?? 0) + derived.pnlDn1PctDol,
        );
      }
    }

    for (const uk in underlyingAgg) {
      underlyingAgg[uk].uPnlUp1PctDol = uPnlUp1HasValue.has(uk)
        ? (uPnlUp1Map.get(uk) ?? 0)
        : null;
      underlyingAgg[uk].uPnlDn1PctDol = uPnlDn1HasValue.has(uk)
        ? (uPnlDn1Map.get(uk) ?? 0)
        : null;
      const up = underlyingAgg[uk].uPnlUp1PctDol;
      const dn = underlyingAgg[uk].uPnlDn1PctDol;
      underlyingAgg[uk].convexityDol =
        up != null && dn != null ? up + dn : null;
    }
  }

  applyPortfolioContext(
    underlyingAgg: UnderlyingAggMap,
    portfolioAgg?: PortfolioAgg | null,
  ): void {
    let totalAbsDeltaNotional = 0;
    let totalAbsVegaPerVol = 0;
    let hasDelta = false;
    let hasVega = false;

    for (const uk in underlyingAgg) {
      const entry = underlyingAgg[uk];
      const absDeltaNotional =
        entry.deltaNotionalDol != null
          ? Math.abs(entry.deltaNotionalDol)
          : null;
      const absVega =
        entry.absVegaPerVolPoint != null ? entry.absVegaPerVolPoint : null;
      if (absDeltaNotional != null) {
        totalAbsDeltaNotional += absDeltaNotional;
        hasDelta = true;
      }
      if (absVega != null) {
        totalAbsVegaPerVol += absVega;
        hasVega = true;
      }
    }

    const deltaDenom =
      hasDelta && totalAbsDeltaNotional !== 0 ? totalAbsDeltaNotional : null;
    const vegaDenom =
      hasVega && totalAbsVegaPerVol !== 0 ? totalAbsVegaPerVol : null;

    if (portfolioAgg) {
      portfolioAgg.totalAbsDeltaNotionalDol = deltaDenom;
      portfolioAgg.totalAbsVegaPerVolPoint = vegaDenom;
    }

    for (const uk in underlyingAgg) {
      const entry = underlyingAgg[uk];
      const absDeltaNotional =
        entry.deltaNotionalDol != null
          ? Math.abs(entry.deltaNotionalDol)
          : null;
      entry.deltaNotionalConcentrationPct =
        deltaDenom != null && absDeltaNotional != null
          ? absDeltaNotional / deltaDenom
          : null;

      const absVega =
        entry.absVegaPerVolPoint != null ? entry.absVegaPerVolPoint : null;
      entry.vegaConcentrationPct =
        vegaDenom != null && absVega != null ? absVega / vegaDenom : null;
    }
  }
}
