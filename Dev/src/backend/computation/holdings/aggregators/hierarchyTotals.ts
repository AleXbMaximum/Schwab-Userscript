import type{
  AssetClassBlock,
  DerivedState,
  GroupTotals,
  TickerBlock,
} from "../../../../shared/types/derived";
import type{ HoldingsRow, HoldingsTotals } from "../../../../shared/types/holdings";
import { addFinite, isFiniteNumber } from "../../../../shared/utils/math/guards";

function extractVal(row: HoldingsRow, field: string): number | null {
  const cell = (row as any)?.[field];
  if (!cell) return null;

  if (field === "costBasis") {
    const val = cell.cstBasis;
    if (typeof val === "number") return val;
  }
  if (field === "gainLoss") {
    const val = cell.gainLossDlr;
    if (typeof val === "number") return val;
  }
  if (field === "marketValue" || field === "dayChange") {
    const val = cell.val;
    if (typeof val === "number") return val;
  }

  const val = cell.val ?? cell.lbl;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const parsed = parseFloat(val.replace(/[$,%]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function computeGroupTotals(
  tickers: TickerBlock[],
  derivedState: DerivedState,
): GroupTotals {
  let marketValue = 0;
  let costBasis = 0;
  let dayChangeDollar = 0;
  let gainLossDollar = 0;
  let holdingCount = 0;

  let thetaSum = 0;
  let vegaSum = 0;
  let rhoSum = 0;
  let gammaSum = 0;
  let absGammaSum = 0;
  let absVegaSum = 0;
  let deltaNotionalSum = 0;
  let marginSum = 0;
  let pnlUp1Sum = 0;
  let pnlDn1Sum = 0;
  let convexitySum = 0;
  let carryPerVegaSum = 0;
  let carryPerVegaCount = 0;
  let carryPerGammaSum = 0;
  let carryPerGammaCount = 0;

  let priceChgPctSum = 0;
  let priceChgPctCount = 0;
  let priceChgDolSum = 0;
  let priceChgDolCount = 0;

  for (const ticker of tickers) {
    for (const pos of ticker.holdings) {
      holdingCount++;
      const row = pos.row;

      const mv = extractVal(row, "marketValue");
      const cb = extractVal(row, "costBasis");
      const dc = extractVal(row, "dayChange");
      const gl = extractVal(row, "gainLoss");

      if (typeof mv === "number") marketValue += mv;
      if (typeof cb === "number") costBasis += cb;
      if (typeof dc === "number") dayChangeDollar += dc;
      if (typeof gl === "number") gainLossDollar += gl;
    }

    const agg = ticker.aggregated;
    if (agg) {
      thetaSum = addFinite(thetaSum, agg.totalThetaPerDay);
      vegaSum = addFinite(vegaSum, agg.totalVegaPerVolPoint);
      rhoSum = addFinite(rhoSum, agg.totalRhoPer1pctRate);
      gammaSum = addFinite(gammaSum, agg.totalGammaSharesPerDol);
      absGammaSum = addFinite(absGammaSum, agg.absGammaSharesPerDol);
      absVegaSum = addFinite(absVegaSum, agg.absVegaPerVolPoint);
      deltaNotionalSum = addFinite(deltaNotionalSum, agg.deltaNotionalDol);
      marginSum = addFinite(marginSum, agg.totalMarginReqDol);
      convexitySum = addFinite(convexitySum, agg.convexityDol);

      const pUp = agg.uPnlUp1PctDol;
      pnlUp1Sum = addFinite(pnlUp1Sum, pUp);
      const pDn = agg.uPnlDn1PctDol;
      pnlDn1Sum = addFinite(pnlDn1Sum, pDn);

      if (isFiniteNumber(agg.carryPerVega)) {
        carryPerVegaSum += agg.carryPerVega;
        carryPerVegaCount++;
      }
      if (isFiniteNumber(agg.carryPerGamma)) {
        carryPerGammaSum += agg.carryPerGamma;
        carryPerGammaCount++;
      }
    }

    const eqRow = ticker.equityInfoRow;
    if (eqRow) {
      const pct = (eqRow as any)?.priceChngPrc?.val;
      if (isFiniteNumber(pct)) {
        priceChgPctSum += pct;
        priceChgPctCount++;
      }
      const dol = (eqRow as any)?.priceChng?.val;
      if (isFiniteNumber(dol)) {
        priceChgDolSum += dol;
        priceChgDolCount++;
      }
    }
  }

  const dayChangePercent =
    marketValue !== 0 && dayChangeDollar !== 0
      ? dayChangeDollar / (marketValue - dayChangeDollar)
      : null;
  const gainLossPercent =
    costBasis !== 0 && costBasis !== null ? gainLossDollar / costBasis : null;

  const portfolioAgg = derivedState.portfolioAgg;
  let deltaNotionalConcentrationPct: number | null = null;
  let vegaConcentrationPct: number | null = null;
  if (portfolioAgg) {
    const absDelta = portfolioAgg.totalAbsDeltaNotionalDol;
    if (absDelta && deltaNotionalSum !== 0) {
      deltaNotionalConcentrationPct = Math.abs(deltaNotionalSum) / absDelta;
    }
    const absVega = portfolioAgg.totalAbsVegaPerVolPoint;
    if (absVega && absVegaSum !== 0) {
      vegaConcentrationPct = absVegaSum / absVega;
    }
  }

  const accountMv =
    portfolioAgg?.netMarketValue ?? portfolioAgg?.grossMarketValue;
  const percentageOfAccount =
    marketValue !== 0 && accountMv && accountMv !== 0
      ? marketValue / accountMv
      : null;

  return {
    marketValue,
    costBasis,
    dayChangeDollar,
    dayChangePercent,
    gainLossDollar,
    gainLossPercent,
    holdingCount,
    thetaPerDay: thetaSum,
    vegaPerVolPoint: vegaSum,
    rhoPer1pctRate: rhoSum,
    gammaSharesPerDol: gammaSum,
    absGammaSharesPerDol: absGammaSum,
    absVegaPerVolPoint: absVegaSum,
    deltaNotionalDol: deltaNotionalSum,
    marginReqDol: marginSum,
    pnlUp1PctDol: pnlUp1Sum,
    pnlDn1PctDol: pnlDn1Sum,
    convexityDol: convexitySum,
    carryPerVega:
      carryPerVegaCount > 0 ? carryPerVegaSum / carryPerVegaCount : null,
    carryPerGamma:
      carryPerGammaCount > 0 ? carryPerGammaSum / carryPerGammaCount : null,
    deltaNotionalConcentrationPct,
    vegaConcentrationPct,
    percentageOfAccount,
    priceChangePercent:
      priceChgPctCount > 0 ? priceChgPctSum / priceChgPctCount : null,
    priceChangeDollar:
      priceChgDolCount > 0 ? priceChgDolSum / priceChgDolCount : null,
  };
}

export function computeGrandTotal(
  assetClasses: AssetClassBlock[],
  derivedState: DerivedState,
): GroupTotals {
  let marketValue = 0;
  let costBasis = 0;
  let dayChangeDollar = 0;
  let gainLossDollar = 0;
  let holdingCount = 0;

  let thetaSum = 0;
  let vegaSum = 0;
  let rhoSum = 0;
  let gammaSum = 0;
  let absGammaSum = 0;
  let absVegaSum = 0;
  let deltaNotionalSum = 0;
  let marginSum = 0;
  let pnlUp1Sum = 0;
  let pnlDn1Sum = 0;
  let convexitySum = 0;
  let carryPerVegaSum = 0;
  let carryPerVegaCount = 0;
  let carryPerGammaSum = 0;
  let carryPerGammaCount = 0;
  let priceChgPctSum = 0;
  let priceChgPctCount = 0;
  let priceChgDolSum = 0;
  let priceChgDolCount = 0;

  for (const ac of assetClasses) {
    const t = ac.totals;
    if (!t) continue;

    marketValue += t.marketValue;
    costBasis += t.costBasis;
    dayChangeDollar += t.dayChangeDollar;
    gainLossDollar += t.gainLossDollar;
    holdingCount += t.holdingCount;

    thetaSum = addFinite(thetaSum, t.thetaPerDay);
    vegaSum = addFinite(vegaSum, t.vegaPerVolPoint);
    rhoSum = addFinite(rhoSum, t.rhoPer1pctRate);
    gammaSum = addFinite(gammaSum, t.gammaSharesPerDol);
    absGammaSum = addFinite(absGammaSum, t.absGammaSharesPerDol);
    absVegaSum = addFinite(absVegaSum, t.absVegaPerVolPoint);
    deltaNotionalSum = addFinite(deltaNotionalSum, t.deltaNotionalDol);
    marginSum = addFinite(marginSum, t.marginReqDol);
    pnlUp1Sum = addFinite(pnlUp1Sum, t.pnlUp1PctDol);
    pnlDn1Sum = addFinite(pnlDn1Sum, t.pnlDn1PctDol);
    convexitySum = addFinite(convexitySum, t.convexityDol);

    if (isFiniteNumber(t.carryPerVega)) {
      carryPerVegaSum += t.carryPerVega;
      carryPerVegaCount++;
    }
    if (isFiniteNumber(t.carryPerGamma)) {
      carryPerGammaSum += t.carryPerGamma;
      carryPerGammaCount++;
    }
    if (isFiniteNumber(t.priceChangePercent)) {
      priceChgPctSum += t.priceChangePercent;
      priceChgPctCount++;
    }
    if (isFiniteNumber(t.priceChangeDollar)) {
      priceChgDolSum += t.priceChangeDollar;
      priceChgDolCount++;
    }
  }

  const dayChangePercent =
    marketValue !== 0 && dayChangeDollar !== 0
      ? dayChangeDollar / (marketValue - dayChangeDollar)
      : null;
  const gainLossPercent = costBasis !== 0 ? gainLossDollar / costBasis : null;

  const portfolioAgg = derivedState.portfolioAgg;
  let deltaNotionalConcentrationPct: number | null = null;
  let vegaConcentrationPct: number | null = null;
  if (portfolioAgg) {
    const absDelta = portfolioAgg.totalAbsDeltaNotionalDol;
    if (absDelta && deltaNotionalSum !== 0) {
      deltaNotionalConcentrationPct = Math.abs(deltaNotionalSum) / absDelta;
    }
    const absVega = portfolioAgg.totalAbsVegaPerVolPoint;
    if (absVega && absVegaSum !== 0) {
      vegaConcentrationPct = absVegaSum / absVega;
    }
  }

  const accountMv =
    portfolioAgg?.netMarketValue ?? portfolioAgg?.grossMarketValue;
  const percentageOfAccount =
    marketValue !== 0 && accountMv && accountMv !== 0
      ? marketValue / accountMv
      : null;

  return {
    marketValue,
    costBasis,
    dayChangeDollar,
    dayChangePercent,
    gainLossDollar,
    gainLossPercent,
    holdingCount,
    thetaPerDay: thetaSum,
    vegaPerVolPoint: vegaSum,
    rhoPer1pctRate: rhoSum,
    gammaSharesPerDol: gammaSum,
    absGammaSharesPerDol: absGammaSum,
    absVegaPerVolPoint: absVegaSum,
    deltaNotionalDol: deltaNotionalSum,
    marginReqDol: marginSum,
    pnlUp1PctDol: pnlUp1Sum,
    pnlDn1PctDol: pnlDn1Sum,
    convexityDol: convexitySum,
    carryPerVega:
      carryPerVegaCount > 0 ? carryPerVegaSum / carryPerVegaCount : null,
    carryPerGamma:
      carryPerGammaCount > 0 ? carryPerGammaSum / carryPerGammaCount : null,
    deltaNotionalConcentrationPct,
    vegaConcentrationPct,
    percentageOfAccount,
    priceChangePercent:
      priceChgPctCount > 0 ? priceChgPctSum / priceChgPctCount : null,
    priceChangeDollar:
      priceChgDolCount > 0 ? priceChgDolSum / priceChgDolCount : null,
  };
}

export function mergeBrokerTotals(
  computed: GroupTotals,
  brokerTotals?: HoldingsTotals,
): GroupTotals {
  if (!brokerTotals) return computed;
  return {
    ...computed,
    marketValue:
      typeof brokerTotals.marketValue === "number"
        ? brokerTotals.marketValue
        : computed.marketValue,
    costBasis:
      typeof brokerTotals.costBasis === "number"
        ? brokerTotals.costBasis
        : computed.costBasis,
    dayChangeDollar:
      typeof brokerTotals.dayChangeDollar === "number"
        ? brokerTotals.dayChangeDollar
        : computed.dayChangeDollar,
    dayChangePercent:
      typeof brokerTotals.dayChangePercent === "number"
        ? brokerTotals.dayChangePercent
        : computed.dayChangePercent,
    gainLossDollar:
      typeof brokerTotals.gainLossDollar === "number"
        ? brokerTotals.gainLossDollar
        : computed.gainLossDollar,
    gainLossPercent:
      typeof brokerTotals.gainLossPercent === "number"
        ? brokerTotals.gainLossPercent
        : computed.gainLossPercent,
  };
}
