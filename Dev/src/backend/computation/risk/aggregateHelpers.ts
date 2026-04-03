import { isFiniteNumber } from "../../../shared/utils/math/guards";

type PortfolioAggLike = {
  totalAbsDeltaNotionalDol?: number | null;
  totalAbsVegaPerVolPoint?: number | null;
  totalThetaPerDay?: number | null;
  totalVegaPerVolPoint?: number | null;
};

type UnderlyingAggLike = {
  deltaNotionalDol?: number | null;
  totalVegaPerVolPoint?: number | null;
  totalThetaPerDay?: number | null;
  rhoPer1pctRate?: number | null;
  uPnlUp1PctDol?: number | null;
  uPnlDn1PctDol?: number | null;
};

export function computeTotalAbsDeltaNotionalDol(
  portfolioAgg: PortfolioAggLike | null | undefined,
  byUnderlying: Record<string, UnderlyingAggLike> | null | undefined,
): number {
  const fromAgg = portfolioAgg?.totalAbsDeltaNotionalDol;
  if (isFiniteNumber(fromAgg)) return fromAgg;
  let total = 0;
  if (!byUnderlying) return total;
  for (const key in byUnderlying) {
    const dn = byUnderlying[key]?.deltaNotionalDol;
    if (isFiniteNumber(dn)) total += Math.abs(dn);
  }
  return total;
}

export function computeTotalAbsVegaPerVolPoint(
  portfolioAgg: PortfolioAggLike | null | undefined,
  byUnderlying: Record<string, UnderlyingAggLike> | null | undefined,
): number {
  const fromAgg = portfolioAgg?.totalAbsVegaPerVolPoint;
  if (isFiniteNumber(fromAgg)) return fromAgg;
  let total = 0;
  if (!byUnderlying) return total;
  for (const key in byUnderlying) {
    const vega = byUnderlying[key]?.totalVegaPerVolPoint;
    if (isFiniteNumber(vega)) total += Math.abs(vega);
  }
  return total;
}

export function computeTotalThetaPerDayFromAgg(
  portfolioAgg: PortfolioAggLike | null | undefined,
  byUnderlying: Record<string, UnderlyingAggLike> | null | undefined,
): number {
  const fromAgg = portfolioAgg?.totalThetaPerDay;
  if (isFiniteNumber(fromAgg)) return fromAgg;
  let total = 0;
  if (!byUnderlying) return total;
  for (const key in byUnderlying) {
    const theta = byUnderlying[key]?.totalThetaPerDay;
    if (isFiniteNumber(theta)) total += theta;
  }
  return total;
}

export function computeTotalRhoPer1pctRate(
  byUnderlying: Record<string, UnderlyingAggLike> | null | undefined,
): number {
  let total = 0;
  if (!byUnderlying) return total;
  for (const key in byUnderlying) {
    const rho = byUnderlying[key]?.rhoPer1pctRate;
    if (isFiniteNumber(rho)) total += rho;
  }
  return total;
}

export function computeTotalUPnlUp1PctDol(
  byUnderlying: Record<string, UnderlyingAggLike> | null | undefined,
): number {
  let total = 0;
  if (!byUnderlying) return total;
  for (const key in byUnderlying) {
    const v = byUnderlying[key]?.uPnlUp1PctDol;
    if (isFiniteNumber(v)) total += v;
  }
  return total;
}

export function computeTotalUPnlDn1PctDol(
  byUnderlying: Record<string, UnderlyingAggLike> | null | undefined,
): number {
  let total = 0;
  if (!byUnderlying) return total;
  for (const key in byUnderlying) {
    const v = byUnderlying[key]?.uPnlDn1PctDol;
    if (isFiniteNumber(v)) total += v;
  }
  return total;
}
