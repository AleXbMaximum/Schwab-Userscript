import type { OHLCVBar } from "shared/types/chartData";
import { mean as mathMean } from "../../../shared/utils/math/statistics";
import { logService } from "../../../shared/log/core/LogService";
import type { BetaHorizon, ThreeFactorBetaResult } from "./types";
import { sanitizeAndNormalizeBars } from "./alignment";

const log = logService.namespace("compute");

export function alignFourBarsByDate(
  stockBars: OHLCVBar[],
  spxBars: OHLCVBar[],
  ndxBars: OHLCVBar[],
  djiBars: OHLCVBar[],
): {
  stockCloses: number[];
  spxCloses: number[];
  ndxCloses: number[];
  djiCloses: number[];
  dates: string[];
} {
  const cleanStock = sanitizeAndNormalizeBars(stockBars);
  const cleanSpx = sanitizeAndNormalizeBars(spxBars);
  const cleanNdx = sanitizeAndNormalizeBars(ndxBars);
  const cleanDji = sanitizeAndNormalizeBars(djiBars);

  const spxMap = new Map<string, number>();
  for (const bar of cleanSpx) spxMap.set(bar.date, bar.close);
  const ndxMap = new Map<string, number>();
  for (const bar of cleanNdx) ndxMap.set(bar.date, bar.close);
  const djiMap = new Map<string, number>();
  for (const bar of cleanDji) djiMap.set(bar.date, bar.close);

  const stockCloses: number[] = [];
  const spxCloses: number[] = [];
  const ndxCloses: number[] = [];
  const djiCloses: number[] = [];
  const dates: string[] = [];

  for (const bar of cleanStock) {
    const spxC = spxMap.get(bar.date);
    const ndxC = ndxMap.get(bar.date);
    const djiC = djiMap.get(bar.date);
    if (spxC != null && ndxC != null && djiC != null && bar.close > 0) {
      stockCloses.push(bar.close);
      spxCloses.push(spxC);
      ndxCloses.push(ndxC);
      djiCloses.push(djiC);
      dates.push(bar.date);
    }
  }

  return { stockCloses, spxCloses, ndxCloses, djiCloses, dates };
}

function solve3x3(A: number[][], b: number[]): [number, number, number] | null {
  const det =
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);

  const diagProd = Math.abs(A[0][0]) * Math.abs(A[1][1]) * Math.abs(A[2][2]);
  const threshold = diagProd > 0 ? 1e-10 * diagProd : 1e-30;
  if (Math.abs(det) < threshold) {
    log.debug("threeFactor.solve.singular", { det, diagProd, threshold });
    return null;
  }

  // Condition number proxy: ratio of max to min diagonal elements.
  // A large ratio signals an ill-conditioned system where solutions are unreliable.
  const d0 = Math.abs(A[0][0]);
  const d1 = Math.abs(A[1][1]);
  const d2 = Math.abs(A[2][2]);
  const maxDiag = Math.max(d0, d1, d2);
  const minDiag = Math.min(d0, d1, d2);
  if (minDiag > 0 && maxDiag / minDiag > 1e10) {
    log.warn("threeFactor.solve.illConditioned", {
      det,
      maxDiag,
      minDiag,
      condRatio: maxDiag / minDiag,
    });
    return null;
  }

  const x0 =
    (b[0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
      A[0][1] * (b[1] * A[2][2] - A[1][2] * b[2]) +
      A[0][2] * (b[1] * A[2][1] - A[1][1] * b[2])) /
    det;

  const x1 =
    (A[0][0] * (b[1] * A[2][2] - A[1][2] * b[2]) -
      b[0] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
      A[0][2] * (A[1][0] * b[2] - b[1] * A[2][0])) /
    det;

  const x2 =
    (A[0][0] * (A[1][1] * b[2] - b[1] * A[2][1]) -
      A[0][1] * (A[1][0] * b[2] - b[1] * A[2][0]) +
      b[0] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])) /
    det;

  return [x0, x1, x2];
}

export function computeThreeFactorBeta(
  stockReturns: number[],
  spxReturns: number[],
  ndxReturns: number[],
  djiReturns: number[],
  horizon: BetaHorizon,
): ThreeFactorBetaResult | null {
  const n = Math.min(
    stockReturns.length,
    spxReturns.length,
    ndxReturns.length,
    djiReturns.length,
  );
  if (n < 10) {
    log.debug("threeFactor.skipped", { n, reason: "insufficient data (<10)" });
    return null;
  }

  const f1 = new Array<number>(n);
  const f2 = new Array<number>(n);
  const f3 = new Array<number>(n);
  const y = stockReturns.slice(0, n);

  for (let i = 0; i < n; i++) {
    f1[i] = spxReturns[i];
    f2[i] = ndxReturns[i] - spxReturns[i];
    f3[i] = djiReturns[i] - spxReturns[i];
  }

  const meanY = mathMean(y);
  const meanF1 = mathMean(f1);
  const meanF2 = mathMean(f2);
  const meanF3 = mathMean(f3);

  let c11 = 0,
    c12 = 0,
    c13 = 0;
  let c22 = 0,
    c23 = 0,
    c33 = 0;
  let cy1 = 0,
    cy2 = 0,
    cy3 = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const df1 = f1[i] - meanF1;
    const df2 = f2[i] - meanF2;
    const df3 = f3[i] - meanF3;
    const dy = y[i] - meanY;

    c11 += df1 * df1;
    c12 += df1 * df2;
    c13 += df1 * df3;
    c22 += df2 * df2;
    c23 += df2 * df3;
    c33 += df3 * df3;
    cy1 += dy * df1;
    cy2 += dy * df2;
    cy3 += dy * df3;
    ssTot += dy * dy;
  }

  c11 /= n;
  c12 /= n;
  c13 /= n;
  c22 /= n;
  c23 /= n;
  c33 /= n;
  cy1 /= n;
  cy2 /= n;
  cy3 /= n;

  const A = [
    [c11, c12, c13],
    [c12, c22, c23],
    [c13, c23, c33],
  ];
  const solution = solve3x3(A, [cy1, cy2, cy3]);
  if (!solution) {
    log.warn("threeFactor.singular", { n, horizon });
    return null;
  }

  const [b1, b2, b3] = solution;
  const alpha = meanY - b1 * meanF1 - b2 * meanF2 - b3 * meanF3;

  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = alpha + b1 * f1[i] + b2 * f2[i] + b3 * f3[i];
    const residual = y[i] - predicted;
    ssRes += residual * residual;
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const residualStd = n > 4 ? Math.sqrt(ssRes / (n - 4)) : 0;

  return {
    betaMkt: Math.round(b1 * 1000) / 1000,
    betaNdxRel: Math.round(b2 * 1000) / 1000,
    betaDjiRel: Math.round(b3 * 1000) / 1000,
    alpha: Math.round(alpha * 10000) / 10000,
    rSquared: Math.round(rSquared * 1000) / 1000,
    residualStd: Math.round(residualStd * 10000) / 10000,
    sampleSize: n,
    horizon,
    computedAt: new Date().toISOString(),
  };
}
