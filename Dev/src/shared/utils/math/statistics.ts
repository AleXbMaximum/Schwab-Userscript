// ── Descriptive statistics ───────────────────────────────────────────────────
// Pure functions — no side effects, no domain types.
// All functions silently skip non-finite values where noted.

import { isFiniteNumber } from "./guards";

/**
 * Arithmetic mean. Returns 0 for empty input.
 * Skips non-finite values when `skipInvalid` is true (default: false).
 */
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

/**
 * Population variance (ddof = 0) or sample variance (ddof = 1).
 * Default is population variance (ddof = 0).
 * Pass `preMean` to skip the internal mean computation when already known.
 */
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

/** Standard deviation. See `variance` for ddof semantics. */
export function stdDev(arr: readonly number[], ddof: 0 | 1 = 0): number {
  return Math.sqrt(variance(arr, ddof));
}

/**
 * Population covariance of two equal-length arrays.
 * Returns 0 when arrays are empty or have different lengths.
 * Pass `preMeanA` / `preMeanB` to skip internal mean computation when already known.
 */
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

/**
 * Pearson correlation coefficient between two equal-length arrays.
 * Uses single-pass algebraic form for numerical stability.
 * Returns 0 when n < 2 or when variance of either input is zero.
 */
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

/**
 * Median of an array. Non-destructive (sorts a copy).
 * Returns 0 for empty input.
 * For even-length arrays, returns the average of the two middle elements.
 */
export function median(arr: readonly number[]): number {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

/**
 * Percentile rank (0–100) of `value` within a **sorted ascending** array.
 * Returns the proportion of elements strictly less than `value`.
 */
export function percentileRank(
  sorted: readonly number[],
  value: number,
): number {
  if (sorted.length === 0) return 0;
  let countBelow = 0;
  for (const v of sorted) {
    if (v < value) countBelow++;
  }
  return (countBelow / sorted.length) * 100;
}

/**
 * Weighted average with fallback to simple average when no valid weights exist.
 * Skips null / undefined / non-finite entries.
 * Returns `null` when no valid values exist.
 */
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
