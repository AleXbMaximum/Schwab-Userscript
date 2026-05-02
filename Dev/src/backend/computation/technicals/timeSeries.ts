// Time-series primitives — stateless helpers for sequential numeric data.

const ET_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getEtDateKey(utcMs: number): number {
  const parts = ET_DATE_FORMATTER.formatToParts(new Date(utcMs));
  const year = parseInt(parts.find(p => p.type === "year")!.value);
  const month = parseInt(parts.find(p => p.type === "month")!.value);
  const day = parseInt(parts.find(p => p.type === "day")!.value);
  return year * 10000 + month * 100 + day;
}

/**
 * Log returns from a close-price series.
 * Element `i` = ln(closes[i] / closes[i-1]). Skips pairs where either price <= 0.
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

/** Simple Moving Average. Output length = arr.length - period + 1. */
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

/** Exponential Moving Average. SMA-seeded. Output length = arr.length - period + 1. */
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

/** True Range series. Output length = n - 1. */
export function trueRange(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
): number[] {
  const n = Math.min(highs.length, lows.length, closes.length);
  const out: number[] = [];
  for (let i = 1; i < n; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    out.push(Math.max(hl, hc, lc));
  }
  return out;
}

/** Average True Range using Wilder's RMA. Output length = tr.length - period + 1. */
export function atr(tr: readonly number[], period: number): number[] {
  if (tr.length < period || period < 1) return [];
  let prev = 0;
  for (let i = 0; i < period; i++) prev += tr[i];
  prev /= period;
  const out: number[] = [prev];
  for (let i = period; i < tr.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out.push(prev);
  }
  return out;
}

export type SupertrendResult = {
  values: (number | null)[];
  trend: (1 | -1 | null)[];
};

/**
 * Supertrend overlay: ATR-based bands that ratchet toward price; trend flips on close-side cross.
 * Warmup = period bars (first period values are null).
 */
export function supertrend(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  period: number,
  multiplier: number,
): SupertrendResult {
  const n = Math.min(highs.length, lows.length, closes.length);
  const values: (number | null)[] = new Array(n).fill(null);
  const trend: (1 | -1 | null)[] = new Array(n).fill(null);

  if (n < period + 1 || period < 1) return { values, trend };

  const tr = trueRange(highs, lows, closes);
  const atrVals = atr(tr, period);
  if (atrVals.length === 0) return { values, trend };

  const start = period;

  let prevUp = 0;
  let prevDn = 0;
  let prevTrend: 1 | -1 = 1;

  for (let i = start; i < n; i++) {
    const atrIdx = i - start;
    if (atrIdx >= atrVals.length) break;
    const a = atrVals[atrIdx];
    const src = (highs[i] + lows[i]) / 2;

    let up = src - multiplier * a;
    let dn = src + multiplier * a;

    if (i > start) {
      if (closes[i - 1] > prevUp) up = Math.max(up, prevUp);
      if (closes[i - 1] < prevDn) dn = Math.min(dn, prevDn);
    }

    let curTrend = prevTrend;
    if (i > start) {
      if (prevTrend === -1 && closes[i] > prevDn) curTrend = 1;
      else if (prevTrend === 1 && closes[i] < prevUp) curTrend = -1;
    }

    trend[i] = curTrend;
    values[i] = curTrend === 1 ? up : dn;

    prevUp = up;
    prevDn = dn;
    prevTrend = curTrend;
  }

  return { values, trend };
}

/**
 * VWAP with intraday session reset (new ET calendar day = new session).
 * Bars with zero cumulative volume produce null.
 */
export function vwap(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  volumes: readonly number[],
  timestamps: readonly number[],
): (number | null)[] {
  const n = Math.min(highs.length, lows.length, closes.length, volumes.length, timestamps.length);
  const out: (number | null)[] = new Array(n).fill(null);
  if (n === 0) return out;

  let cumPV = 0;
  let cumVol = 0;
  let prevDay = -1;

  for (let i = 0; i < n; i++) {
    const day = getEtDateKey(timestamps[i]);
    if (day !== prevDay) {
      cumPV = 0;
      cumVol = 0;
      prevDay = day;
    }

    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    const vol = volumes[i] ?? 0;
    cumPV += tp * vol;
    cumVol += vol;
    out[i] = cumVol > 0 ? cumPV / cumVol : null;
  }

  return out;
}

export type VwapBandResult = {
  values: (number | null)[];
  bands: Array<{ upper: (number | null)[]; lower: (number | null)[] }>;
};

/**
 * VWAP plus standard-deviation bands. stddev derived from volume-weighted variance.
 */
export function vwapWithBands(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  volumes: readonly number[],
  timestamps: readonly number[],
  bandMultipliers: readonly number[],
): VwapBandResult {
  const n = Math.min(highs.length, lows.length, closes.length, volumes.length, timestamps.length);
  const values: (number | null)[] = new Array(n).fill(null);
  const bands: VwapBandResult["bands"] = bandMultipliers.map(() => ({
    upper: new Array<number | null>(n).fill(null),
    lower: new Array<number | null>(n).fill(null),
  }));
  if (n === 0) return { values, bands };

  let cumPV = 0;
  let cumVol = 0;
  let cumTPV2 = 0;
  let prevDay = -1;

  for (let i = 0; i < n; i++) {
    const day = getEtDateKey(timestamps[i]);
    if (day !== prevDay) {
      cumPV = 0;
      cumVol = 0;
      cumTPV2 = 0;
      prevDay = day;
    }

    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    const vol = volumes[i] ?? 0;
    cumPV += tp * vol;
    cumVol += vol;
    cumTPV2 += vol * tp * tp;

    if (cumVol <= 0) continue;

    const vwapVal = cumPV / cumVol;
    values[i] = vwapVal;

    const variance = cumTPV2 / cumVol - vwapVal * vwapVal;
    const stddev = variance > 0 ? Math.sqrt(variance) : 0;

    for (let b = 0; b < bandMultipliers.length; b++) {
      const mult = bandMultipliers[b];
      bands[b].upper[i] = vwapVal + mult * stddev;
      bands[b].lower[i] = vwapVal - mult * stddev;
    }
  }

  return { values, bands };
}
