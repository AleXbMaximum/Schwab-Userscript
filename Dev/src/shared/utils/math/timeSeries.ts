// ── Time-series primitives ──────────────────────────────────────────────────
// Stateless helpers for sequential numeric data.

/**
 * Compute log returns from a close-price series.
 * Element `i` = ln(closes[i] / closes[i-1]).
 * Skips any pair where either price ≤ 0 (invalid pairs are omitted, not zero-filled).
 */
export function logReturns(closes: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) {
      out.push(Math.log(closes[i] / closes[i - 1]));
    }
  }
  return out;
}

/**
 * Simple Moving Average — returns the full SMA series.
 * Output length = `arr.length - period + 1`.
 * Returns empty array when input is shorter than `period`.
 */
export function sma(arr: readonly number[], period: number): number[] {
  if (arr.length < period || period < 1) return [];
  const out: number[] = [];
  let window = 0;
  for (let i = 0; i < period; i++) window += arr[i];
  out.push(window / period);
  for (let i = period; i < arr.length; i++) {
    window += arr[i] - arr[i - period];
    out.push(window / period);
  }
  return out;
}

/**
 * Exponential Moving Average — returns the full EMA series.
 * Uses SMA of the first `period` values as the seed.
 * Output length = `arr.length - period + 1`.
 */
export function ema(arr: readonly number[], period: number): number[] {
  if (arr.length < period || period < 1) return [];
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += arr[i];
  prev /= period;
  const out: number[] = [prev];
  for (let i = period; i < arr.length; i++) {
    prev = arr[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/**
 * Annualized realized volatility from log returns.
 * `periodsPerYear` accounts for sampling frequency
 *   (e.g. 252 for daily, 252×39 for 10-min bars).
 */
export function annualizedRV(
  logRets: readonly number[],
  periodsPerYear: number,
): number {
  if (logRets.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < logRets.length; i++) sum += logRets[i];
  const m = sum / logRets.length;
  let sumSq = 0;
  for (let i = 0; i < logRets.length; i++) {
    const d = logRets[i] - m;
    sumSq += d * d;
  }
  const v = sumSq / logRets.length;
  return Math.sqrt(v) * Math.sqrt(periodsPerYear);
}
