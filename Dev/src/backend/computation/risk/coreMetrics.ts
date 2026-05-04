import type{ PortfolioAgg, UnderlyingAggRow } from "../../../shared/types/derived";
import type{ RiskLimits } from "../../../shared/types/core";
import { isFiniteNumber } from "../../../shared/utils/math/guards";
import { sumByField } from "./aggregateHelpers";
import type { ConcentrationItem, ScenarioItem, LimitBreach } from "./types";

export function computeUsedMargin(
  byUnderlying: Record<string, UnderlyingAggRow>,
): number {
  let total = 0;
  for (const key in byUnderlying) {
    const margin = byUnderlying[key]?.totalMarginReqDol;
    if (isFiniteNumber(margin)) total += margin;
  }
  return total;
}

export function computeNetDeltaShares(
  byUnderlying: Record<string, UnderlyingAggRow>,
): number {
  let total = 0;
  for (const key in byUnderlying) {
    const delta = byUnderlying[key]?.totalDeltaShares;
    if (isFiniteNumber(delta)) total += delta;
  }
  return total;
}

export function computeNetDeltaDollars(
  byUnderlying: Record<string, UnderlyingAggRow>,
): number {
  let total = 0;
  for (const key in byUnderlying) {
    const deltaNotional = byUnderlying[key]?.deltaNotionalDol;
    if (isFiniteNumber(deltaNotional)) total += deltaNotional;
  }
  return total;
}

export function computeTotalAbsGamma(
  byUnderlying: Record<string, UnderlyingAggRow>,
): number {
  let total = 0;
  for (const key in byUnderlying) {
    const gamma = byUnderlying[key]?.totalGammaSharesPerDol;
    if (isFiniteNumber(gamma)) total += Math.abs(gamma);
  }
  return total;
}

export function computeGammaDollarExposure(
  byUnderlying: Record<string, UnderlyingAggRow>,
): number {
  let total = 0;
  for (const key in byUnderlying) {
    const gamma = byUnderlying[key]?.totalGammaSharesPerDol;
    const price = byUnderlying[key]?.underlyingPrice;
    if (isFiniteNumber(gamma) && isFiniteNumber(price) && price > 0) {
      total += Math.abs(gamma) * price * price * 0.01;
    }
  }
  return total;
}

export function computeConcentrations(
  byUnderlying: Record<string, UnderlyingAggRow>,
  totalAbsDeltaNotional: number,
  totalMarketValue: number,
  totalUsedMargin: number,
): ConcentrationItem[] {
  const items: ConcentrationItem[] = [];

  for (const key in byUnderlying) {
    const underlying = byUnderlying[key];
    const deltaNotional = underlying?.deltaNotionalDol ?? 0;
    const absDeltaNotional = Math.abs(deltaNotional);

    const marketValue = underlying?.totalMarketValue ?? 0;
    const margin = underlying?.totalMarginReqDol ?? 0;

    // Ratios (0–1); formatPct handles ×100 for display
    const deltaPct =
      totalAbsDeltaNotional > 0
        ? absDeltaNotional / totalAbsDeltaNotional
        : 0;
    const marketValuePct =
      totalMarketValue > 0
        ? Math.abs(marketValue) / totalMarketValue
        : 0;
    const marginPct =
      totalUsedMargin > 0 ? margin / totalUsedMargin : 0;

    items.push({
      underlyingKey: key,
      deltaPct,
      marketValuePct,
      marginPct,
      deltaNotional: absDeltaNotional,
      marketValue: Math.abs(marketValue),
      margin,
    });
  }

  items.sort((a, b) => b.deltaNotional - a.deltaNotional);
  return items.slice(0, 10);
}

export function calculateScenarios(
  _portfolioAgg: PortfolioAgg | undefined | null,
  byUnderlying: Record<string, UnderlyingAggRow>,
  totalAbsVega: number,
  marketValue: number,
): ScenarioItem[] {
  const scenarios: ScenarioItem[] = [];

  const uPnlUp1Pct = sumByField(byUnderlying, (r) => r?.uPnlUp1PctDol);
  const uPnlDn1Pct = sumByField(byUnderlying, (r) => r?.uPnlDn1PctDol);

  const marketMoves = [5, 2, 1, 0, -1, -2, -5];
  for (const move of marketMoves) {
    const scaledPnl =
      move > 0 ? uPnlUp1Pct * move : uPnlDn1Pct * Math.abs(move);
    const pnlPct = marketValue > 0 ? scaledPnl / marketValue : 0;

    scenarios.push({
      name: `Market ${move > 0 ? "+" : ""}${move}%`,
      marketMove: move,
      volMove: 0,
      expectedPnl: scaledPnl,
      pnlPct,
    });
  }

  const volMoves = [10, 5, -5, -10];
  for (const volMove of volMoves) {
    const expectedPnl = (totalAbsVega / 100) * volMove;
    const pnlPct = marketValue > 0 ? expectedPnl / marketValue : 0;

    scenarios.push({
      name: `Vol ${volMove > 0 ? "+" : ""}${volMove}%`,
      marketMove: 0,
      volMove,
      expectedPnl,
      pnlPct,
    });
  }

  const stressScenarios = [
    { name: "Best Case", marketMove: 2, volMove: -10 },
    { name: "Worst Case", marketMove: -2, volMove: 10 },
    { name: "Black Swan", marketMove: -10, volMove: 50 },
    { name: "Flash Crash", marketMove: -5, volMove: 20 },
    { name: "Vol Collapse", marketMove: 0, volMove: -30 },
  ];

  for (const stress of stressScenarios) {
    const marketPnl =
      stress.marketMove > 0
        ? uPnlUp1Pct * stress.marketMove
        : uPnlDn1Pct * Math.abs(stress.marketMove);
    const volPnl = (totalAbsVega / 100) * stress.volMove;
    const totalPnl = marketPnl + volPnl;
    const pnlPct = marketValue > 0 ? totalPnl / marketValue : 0;

    scenarios.push({
      name: stress.name,
      marketMove: stress.marketMove,
      volMove: stress.volMove,
      expectedPnl: totalPnl,
      pnlPct,
    });
  }

  return scenarios;
}

export function checkLimitBreaches(
  metrics: any,
  limits?: RiskLimits,
): LimitBreach[] {
  if (!limits) return [];

  const breaches: LimitBreach[] = [];

  if (limits.maxMarginUtilizationPct != null) {
    const current = metrics.marginUtilizationPct;
    const limit = limits.maxMarginUtilizationPct;
    if (current > limit) {
      breaches.push({
        type: "Margin Utilization",
        description: `Margin utilization at ${(current * 100).toFixed(1)}%, exceeds limit of ${(limit * 100).toFixed(0)}%`,
        currentValue: current,
        limitValue: limit,
        severity: current > limit * 1.2 ? "critical" : "warning",
      });
    }
  }

  if (limits.maxBeta != null) {
    const current = metrics.currentBeta;
    const limit = limits.maxBeta;
    if (current > limit) {
      breaches.push({
        type: "Beta",
        description: `Beta at ${current.toFixed(2)}, exceeds limit of ${limit.toFixed(2)}`,
        currentValue: current,
        limitValue: limit,
        severity: current > limit * 1.2 ? "critical" : "warning",
      });
    }
  }

  if (limits.maxNetDeltaShares != null) {
    const current = Math.abs(metrics.netDeltaShares);
    const limit = limits.maxNetDeltaShares;
    if (current > limit) {
      breaches.push({
        type: "Net Delta",
        description: `Net delta at ${current.toFixed(0)} shares, exceeds limit of ${limit}`,
        currentValue: current,
        limitValue: limit,
        severity: current > limit * 1.2 ? "critical" : "warning",
      });
    }
  }

  if (limits.maxAbsVegaPerVolPoint != null) {
    const current = metrics.totalAbsVega;
    const limit = limits.maxAbsVegaPerVolPoint;
    if (current > limit) {
      breaches.push({
        type: "Vega Exposure",
        description: `Vega at ${current.toFixed(0)}, exceeds limit of ${limit}`,
        currentValue: current,
        limitValue: limit,
        severity: current > limit * 1.2 ? "critical" : "warning",
      });
    }
  }

  if (limits.maxSingleUnderlyingDeltaPct != null) {
    const concentrations = metrics.topUnderlyingConcentrations || [];
    for (const conc of concentrations) {
      if (conc.deltaPct > limits.maxSingleUnderlyingDeltaPct) {
        breaches.push({
          type: "Concentration",
          description: `${conc.underlyingKey} delta concentration at ${(conc.deltaPct * 100).toFixed(1)}%, exceeds limit of ${(limits.maxSingleUnderlyingDeltaPct * 100).toFixed(0)}%`,
          currentValue: conc.deltaPct,
          limitValue: limits.maxSingleUnderlyingDeltaPct,
          severity:
            conc.deltaPct > limits.maxSingleUnderlyingDeltaPct * 1.2
              ? "critical"
              : "warning",
        });
      }
    }
  }

  return breaches;
}
