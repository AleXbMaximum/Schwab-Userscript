import type { OHLCVBar } from "shared/utils/chartDataTypes";
import { logReturns as computeLogReturnsMath } from "../../../shared/utils/math/timeSeries";
import {
  mean as mathMean,
  covariance as mathCov,
  variance as mathVar,
} from "../../../shared/utils/math/statistics";
import type { BetaHorizon, BetaResult } from "./types";
import { sanitizeBars } from "./alignment";

// ── Index-range statistics helpers (avoid .slice() allocations) ─────────────

function meanRange(arr: number[], start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += arr[i];
  return sum / (end - start);
}

function covVarRange(
  a: number[],
  b: number[],
  start: number,
  end: number,
  mA: number,
  mB: number,
): { cov: number; varA: number; varB: number } {
  let cov = 0;
  let varA = 0;
  let varB = 0;
  const n = end - start;
  for (let i = start; i < end; i++) {
    const da = a[i] - mA;
    const db = b[i] - mB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  return { cov: cov / n, varA: varA / n, varB: varB / n };
}

export function computeLogReturns(closes: number[]): number[] {
  return computeLogReturnsMath(closes);
}

export function alignBarsByDate(
  stockBars: OHLCVBar[],
  marketBars: OHLCVBar[],
): { stockCloses: number[]; marketCloses: number[]; dates: string[] } {
  const cleanStock = sanitizeBars(stockBars);
  const cleanMarket = sanitizeBars(marketBars);

  const marketMap = new Map<string, number>();
  for (const bar of cleanMarket) {
    marketMap.set(bar.date, bar.close);
  }

  const stockCloses: number[] = [];
  const marketCloses: number[] = [];
  const dates: string[] = [];

  for (const bar of cleanStock) {
    const mClose = marketMap.get(bar.date);
    if (mClose != null && bar.close > 0 && mClose > 0) {
      stockCloses.push(bar.close);
      marketCloses.push(mClose);
      dates.push(bar.date);
    }
  }

  return { stockCloses, marketCloses, dates };
}

export function computeBeta(
  stockReturns: number[],
  marketReturns: number[],
  horizon: BetaHorizon,
): BetaResult | null {
  const n = Math.min(stockReturns.length, marketReturns.length);
  if (n < 10) return null;

  const sr = stockReturns.length > n ? stockReturns.slice(0, n) : stockReturns;
  const mr = marketReturns.length > n ? marketReturns.slice(0, n) : marketReturns;

  // Compute means once and pass to cov/var to avoid redundant passes.
  const meanS = mathMean(sr);
  const meanM = mathMean(mr);

  const cov = mathCov(sr, mr, meanS, meanM);
  const varM = mathVar(mr, 0, meanM);
  const varS = mathVar(sr, 0, meanS);

  if (varM === 0) return null;

  const beta = cov / varM;
  const correlation = varS > 0 ? cov / Math.sqrt(varM * varS) : 0;
  const alpha = meanS - beta * meanM;
  const rSquared = correlation * correlation;

  return {
    beta: Math.round(beta * 1000) / 1000,
    correlation: Math.round(correlation * 1000) / 1000,
    alpha: Math.round(alpha * 10000) / 10000,
    rSquared: Math.round(rSquared * 1000) / 1000,
    sampleSize: n,
    horizon,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Same as computeBeta but operates on a [start, end) sub-range of the arrays,
 * avoiding .slice() allocations. Used by the rolling beta loop.
 */
export function computeBetaRange(
  stockReturns: number[],
  marketReturns: number[],
  start: number,
  end: number,
  horizon: BetaHorizon,
): BetaResult | null {
  const n = end - start;
  if (n < 10) return null;

  const meanS = meanRange(stockReturns, start, end);
  const meanM = meanRange(marketReturns, start, end);

  const { cov, varA: varS, varB: varM } = covVarRange(
    stockReturns,
    marketReturns,
    start,
    end,
    meanS,
    meanM,
  );

  if (varM === 0) return null;

  const beta = cov / varM;
  const correlation = varS > 0 ? cov / Math.sqrt(varM * varS) : 0;
  const alpha = meanS - beta * meanM;
  const rSquared = correlation * correlation;

  return {
    beta: Math.round(beta * 1000) / 1000,
    correlation: Math.round(correlation * 1000) / 1000,
    alpha: Math.round(alpha * 10000) / 10000,
    rSquared: Math.round(rSquared * 1000) / 1000,
    sampleSize: n,
    horizon,
    computedAt: new Date().toISOString(),
  };
}
