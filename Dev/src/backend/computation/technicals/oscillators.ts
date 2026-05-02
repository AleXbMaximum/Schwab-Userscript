// Momentum / oscillator indicators (RSI, MACD, WaveTrend).

import { ema, sma } from "./timeSeries";

/** RSI with Wilder's RMA smoothing. Returns input-aligned array (null during warmup). */
export function rsiFull(
  closes: readonly number[],
  period = 14,
): (number | null)[] {
  const n = closes.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < period + 1 || period < 1) return out;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < n; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

export type MACDResult = {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
};

export function macdFull(
  closes: readonly number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult {
  const n = closes.length;
  const empty: MACDResult = {
    macd: new Array(n).fill(null),
    signal: new Array(n).fill(null),
    histogram: new Array(n).fill(null),
  };

  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);
  if (slowEma.length === 0) return empty;

  const macdRaw: number[] = [];
  const macdStart = slowPeriod - 1;
  for (let k = macdStart; k < n; k++) {
    const fi = k - fastPeriod + 1;
    const si = k - slowPeriod + 1;
    if (fi < 0 || fi >= fastEma.length || si < 0 || si >= slowEma.length) continue;
    macdRaw.push(fastEma[fi] - slowEma[si]);
  }

  if (macdRaw.length === 0) return empty;

  const signalRaw = ema(macdRaw, signalPeriod);
  if (signalRaw.length === 0) return empty;

  const macdOut: (number | null)[] = new Array(n).fill(null);
  const signalOut: (number | null)[] = new Array(n).fill(null);
  const histOut: (number | null)[] = new Array(n).fill(null);

  for (let i = 0; i < macdRaw.length; i++) {
    macdOut[i + macdStart] = macdRaw[i];
  }

  const signalStart = macdStart + signalPeriod - 1;
  for (let j = 0; j < signalRaw.length; j++) {
    const idx = j + signalStart;
    signalOut[idx] = signalRaw[j];
    const m = macdOut[idx];
    if (m != null) histOut[idx] = m - signalRaw[j];
  }

  return { macd: macdOut, signal: signalOut, histogram: histOut };
}

export type WaveTrendResult = {
  wt1: (number | null)[];
  wt2: (number | null)[];
};

/** WaveTrend (LazyBear): wt1 = EMA(CI, n2); CI = (ap - esa) / (0.015 * EMA(|ap-esa|, n1)). */
export function waveTrendFull(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  n1 = 10,
  n2 = 21,
): WaveTrendResult {
  const n = Math.min(highs.length, lows.length, closes.length);
  const empty: WaveTrendResult = {
    wt1: new Array(n).fill(null),
    wt2: new Array(n).fill(null),
  };
  if (n < n1 + n2) return empty;

  const ap: number[] = [];
  for (let i = 0; i < n; i++) ap.push((highs[i] + lows[i] + closes[i]) / 3);

  const esaRaw = ema(ap, n1);
  if (esaRaw.length === 0) return empty;

  const absDiff: number[] = [];
  for (let j = 0; j < esaRaw.length; j++) {
    absDiff.push(Math.abs(ap[j + n1 - 1] - esaRaw[j]));
  }
  const dRaw = ema(absDiff, n1);
  if (dRaw.length === 0) return empty;

  const ciOffset = 2 * (n1 - 1);
  const ci: number[] = [];
  for (let k = 0; k < dRaw.length; k++) {
    const apIdx = k + ciOffset;
    const esaIdx = k + n1 - 1;
    if (apIdx >= n || esaIdx >= esaRaw.length) break;
    const dVal = dRaw[k];
    ci.push(dVal === 0 ? 0 : (ap[apIdx] - esaRaw[esaIdx]) / (0.015 * dVal));
  }
  if (ci.length === 0) return empty;

  const wt1Raw = ema(ci, n2);
  if (wt1Raw.length === 0) return empty;

  const wt2Raw = sma(wt1Raw, 4);

  const wt1Out: (number | null)[] = new Array(n).fill(null);
  const wt2Out: (number | null)[] = new Array(n).fill(null);

  const wt1Start = ciOffset + n2 - 1;
  for (let m = 0; m < wt1Raw.length; m++) {
    const idx = m + wt1Start;
    if (idx < n) wt1Out[idx] = wt1Raw[m];
  }

  const wt2Start = wt1Start + 3;
  for (let p = 0; p < wt2Raw.length; p++) {
    const idx = p + wt2Start;
    if (idx < n) wt2Out[idx] = wt2Raw[p];
  }

  return { wt1: wt1Out, wt2: wt2Out };
}
