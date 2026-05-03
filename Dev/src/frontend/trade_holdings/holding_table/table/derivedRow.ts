import type{ HoldingsRow } from "shared/types/holdings";
import {
  getHoldingsKey,
  getUnderlyingKey,
} from "../../../../shared/utils/domain/holdingsKeys";
import type { TableUpdateContext } from "../types";

const mapUnderlyingAggToDerived = (agg: any, opts?: { rowType?: string }) => {
  if (!agg) return null;
  return {
    rowType: opts?.rowType ?? "Equity",
    underlying: agg.underlyingKey ?? null,
    deltaShares: agg.totalDeltaShares ?? null,
    totalDeltaShares: agg.totalDeltaShares ?? null,
    totalGammaByUnderlying: agg.totalGammaSharesPerDol ?? null,
    totalThetaByUnderlying: agg.totalThetaPerDay ?? null,
    totalVegaByUnderlying: agg.totalVegaPerVolPoint ?? null,
    totalRhoByUnderlying: agg.totalRhoPer1pctRate ?? null,
    absGammaSharesPerDol: agg.absGammaSharesPerDol ?? null,
    absVegaPerVolPoint: agg.absVegaPerVolPoint ?? null,
    marginReqDol: agg.totalMarginReqDol ?? null,
    totalMarginReqDol: agg.totalMarginReqDol ?? null,
    optDeltaShares: agg.totalOptDeltaShares ?? null,
    deltaNotionalDol: agg.deltaNotionalDol ?? null,
    deltaNotionalConcentrationPct: agg.deltaNotionalConcentrationPct ?? null,
    vegaConcentrationPct: agg.vegaConcentrationPct ?? null,
    gammaDensityNearTerm: agg.nearTermGammaAbs ?? null,
    gammaDensityWeighted: agg.nearTermGammaWeighted ?? null,
    carryPerVega: agg.carryPerVega ?? null,
    carryPerGamma: agg.carryPerGamma ?? null,
    thetaOnMargin: agg.thetaOnMargin ?? null,
    vegaOnMargin: agg.vegaOnMargin ?? null,
    gammaOnMargin: agg.gammaOnMargin ?? null,
    carryToStress: agg.carryToStress ?? null,
    deltaSharesPerMargin: agg.deltaSharesPerMargin ?? null,
    deltaNotionalPerMargin: agg.deltaNotionalPerMargin ?? null,
    thetaPerMargin: agg.thetaPerMargin ?? null,
    vegaPerMargin: agg.vegaPerMargin ?? null,
    totalDayChangeDollar: agg.totalDayChangeDollar ?? null,
    totalGainLossDollar: agg.totalGainLossDollar ?? null,
    uPnlUp1PctDol: agg.uPnlUp1PctDol ?? null,
    uPnlDn1PctDol: agg.uPnlDn1PctDol ?? null,
    convexityDol: agg.convexityDol ?? null,
    betaUltraShort: agg.betaUltraShort ?? null,
    betaWeek: agg.betaWeek ?? null,
    betaShort: agg.betaShort ?? null,
    betaMedium: agg.betaMedium ?? null,
    betaLong: agg.betaLong ?? null,
    betaNotionalDolUltraShort: agg.betaNotionalDolUltraShort ?? null,
    betaNotionalDol: agg.betaNotionalDol ?? null,
    betaNotionalDolMedium: agg.betaNotionalDolMedium ?? null,
    betaNotionalDolLong: agg.betaNotionalDolLong ?? null,
    betaNotionalConcentrationPct: agg.betaNotionalConcentrationPct ?? null,
  } as any;
};

export const getDerivedRow = (
  row: HoldingsRow,
  ctx: TableUpdateContext | undefined,
  parentEquitySymbol: string | null = null,
) => {
  const derived = ctx?.derived ?? null;
  if (!derived) return null;

  const pk = getHoldingsKey(row);
  const byHoldings = (derived as any).byHoldingsKey?.[pk];
  if (byHoldings) return byHoldings;

  const uk = getUnderlyingKey(row, parentEquitySymbol);
  const agg = uk ? (derived as any).byUnderlying?.[uk] : null;
  return mapUnderlyingAggToDerived(agg);
};
