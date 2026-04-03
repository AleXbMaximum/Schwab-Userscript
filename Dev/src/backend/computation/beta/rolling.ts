import type { OHLCVBar } from "shared/utils/chartDataTypes";
import {
  alignBarsByDate,
  computeLogReturns,
  computeBetaRange,
} from "./singleFactor";
import type { RollingBetaPoint, RollingBetaOptions } from "./types";

function toPositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function smoothRollingBeta(
  points: RollingBetaPoint[],
  smoothingWindow: number,
): RollingBetaPoint[] {
  if (points.length === 0) return [];
  if (smoothingWindow <= 1) return points;
  if (points.length < smoothingWindow) return [];

  const out: RollingBetaPoint[] = [];
  let sumBeta = 0;
  let sumCorr = 0;
  for (let i = 0; i < points.length; i++) {
    sumBeta += points[i].beta;
    sumCorr += points[i].correlation;
    if (i >= smoothingWindow) {
      sumBeta -= points[i - smoothingWindow].beta;
      sumCorr -= points[i - smoothingWindow].correlation;
    }
    if (i >= smoothingWindow - 1) {
      const beta = Math.round((sumBeta / smoothingWindow) * 1000) / 1000;
      const correlation = Math.round((sumCorr / smoothingWindow) * 1000) / 1000;
      out.push({ date: points[i].date, beta, correlation });
    }
  }
  return out;
}

function sampleRollingBeta(
  points: RollingBetaPoint[],
  step: number,
): RollingBetaPoint[] {
  if (points.length <= 1 || step <= 1) return points;

  const out: RollingBetaPoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1]?.date !== last.date) out.push(last);
  return out;
}

export function computeRollingBeta(
  stockBars: OHLCVBar[],
  marketBars: OHLCVBar[],
  windowSize: number,
  options?: RollingBetaOptions,
): RollingBetaPoint[] {
  const { stockCloses, marketCloses, dates } = alignBarsByDate(
    stockBars,
    marketBars,
  );
  const stockReturns = computeLogReturns(stockCloses);
  const marketReturns = computeLogReturns(marketCloses);
  const returnDates = dates.slice(1);
  const alignedReturnCount = Math.min(
    stockReturns.length,
    marketReturns.length,
    returnDates.length,
  );

  const minWindowPoints = toPositiveInt(options?.minWindowPoints, 50);
  const effectiveWindow = Math.max(
    toPositiveInt(windowSize, 10),
    minWindowPoints,
  );
  if (alignedReturnCount < effectiveWindow) return [];

  const rollingHorizon = options?.horizon ?? "short";
  const rawPoints: RollingBetaPoint[] = [];
  for (let i = effectiveWindow; i <= alignedReturnCount; i++) {
    // Use index-based range to avoid .slice() allocations per window.
    const result = computeBetaRange(
      stockReturns,
      marketReturns,
      i - effectiveWindow,
      i,
      rollingHorizon,
    );
    if (result) {
      rawPoints.push({
        date: returnDates[i - 1],
        beta: result.beta,
        correlation: result.correlation,
      });
    }
  }
  if (rawPoints.length === 0) return [];

  const smoothingWindow = toPositiveInt(options?.smoothingWindow, 10);
  const smoothed = smoothRollingBeta(rawPoints, smoothingWindow);
  const samplingStep = toPositiveInt(options?.samplingStep, 1);
  return sampleRollingBeta(smoothed, samplingStep);
}
