// Descriptive statistics — pure functions, no side effects, no domain types.

import { isFiniteNumber } from "./guards";

export function mean(arr: readonly number[], skipInvalid = false): number {
  if (arr.length === 0) return 0;
  if (!skipInvalid) {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
  }
  let sum = 0;
  let count = 0;
  for (let i = 0; i < arr.length; i++) {
    if (isFiniteNumber(arr[i])) {
      sum += arr[i];
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

export function variance(
  arr: readonly number[],
  ddof: 0 | 1 = 0,
  preMean?: number,
): number {
  const n = arr.length;
  if (n < 1 + ddof) return 0;
  const m = preMean ?? mean(arr);
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const d = arr[i] - m;
    sumSq += d * d;
  }
  return sumSq / (n - ddof);
}

export function stdDev(arr: readonly number[], ddof: 0 | 1 = 0): number {
  return Math.sqrt(variance(arr, ddof));
}

export function covariance(
  a: readonly number[],
  b: readonly number[],
  preMeanA?: number,
  preMeanB?: number,
): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  const mA = preMeanA ?? mean(a.length > n ? a.slice(0, n) : a);
  const mB = preMeanB ?? mean(b.length > n ? b.slice(0, n) : b);
  let cov = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - mA) * (b[i] - mB);
  }
  return cov / n;
}

export function pearsonCorrelation(
  a: readonly number[],
  b: readonly number[],
): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let sumA = 0,
    sumB = 0,
    sumA2 = 0,
    sumB2 = 0,
    sumAB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
    sumAB += a[i] * b[i];
  }
  const denom = Math.sqrt(
    (n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB),
  );
  if (denom === 0) return 0;
  return (n * sumAB - sumA * sumB) / denom;
}

export function median(arr: readonly number[]): number {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

export function weightedAverage(
  values: ReadonlyArray<number | null | undefined>,
  weights: ReadonlyArray<number | null | undefined>,
): number | null {
  let weighted = 0;
  let totalWeight = 0;
  let fallbackSum = 0;
  let fallbackCount = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) continue;
    fallbackSum += v;
    fallbackCount += 1;
    const w = weights[i] ?? 0;
    if (w > 0 && Number.isFinite(w)) {
      weighted += v * w;
      totalWeight += w;
    }
  }
  if (totalWeight > 0) return weighted / totalWeight;
  if (fallbackCount > 0) return fallbackSum / fallbackCount;
  return null;
}
