import type {
  TechnicalIndicators,
  OHLCVFeatures,
  SwingPoint,
  VolumeProfileBucket,
  GapStats,
} from "../types";
import type { OHLCVBar } from "shared/utils/chartDataTypes";
import { sma as smaSeries, ema as emaSeries } from "shared/utils/math/timeSeries";
import { mean as mathMean, stdDev as mathStdDev } from "shared/utils/math/statistics";

/** Compute Simple Moving Average of the last `period` values */
function sma(arr: number[], period: number): number | null {
  if (arr.length < period) return null;
  const result = smaSeries(arr, period);
  return result.length > 0 ? result[result.length - 1] : null;
}

/** Compute full EMA array for given period */
function emaArray(arr: number[], period: number): number[] {
  return emaSeries(arr, period);
}

/**
 * Compute the full RSI(14) series and return the last `lastN` values.
 * Returns an empty array if there are fewer than 15 closes.
 */
function rsiSeries(closes: number[], lastN = 20): number[] {
  if (closes.length < 15) return [];
  const result: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= 14; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= 14;
  avgLoss /= 14;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = 15; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result.slice(-lastN);
}

/** RSI(14) */
function rsi14(closes: number[]): number | null {
  return rsiSeries(closes, 1).at(-1) ?? null;
}

/** Bollinger Bands (20, 2σ) — returns { upper, middle, lower } */
function bollingerBands(
  closes: number[],
): { upper: number; middle: number; lower: number } | null {
  if (closes.length < 20) return null;
  const slice = closes.slice(-20);
  const mid = mathMean(slice);
  const std = mathStdDev(slice);
  return { upper: mid + 2 * std, middle: mid, lower: mid - 2 * std };
}

/** ATR(14) */
function atr14(bars: OHLCVBar[]): number | null {
  if (bars.length < 15) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    );
    trs.push(tr);
  }
  const last14 = trs.slice(-14);
  return last14.reduce((a, b) => a + b, 0) / 14;
}

/** OBV trend (rising / falling / flat) based on last 20 bars */
function obvTrend(bars: OHLCVBar[]): "rising" | "falling" | "flat" | null {
  if (bars.length < 20) return null;
  let obv = 0;
  const obvArr: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].close > bars[i - 1].close) obv += bars[i].volume;
    else if (bars[i].close < bars[i - 1].close) obv -= bars[i].volume;
    obvArr.push(obv);
  }
  const recent = obvArr.slice(-20);
  const firstHalf = recent.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
  const secondHalf = recent.slice(10).reduce((a, b) => a + b, 0) / 10;
  if (secondHalf > firstHalf * 1.05) return "rising";
  if (secondHalf < firstHalf * 0.95) return "falling";
  return "flat";
}

/**
 * Identify swing highs and lows using a local extremum test with `lookback` bars on each side.
 * Returns last 5 swing highs and last 5 swing lows by date.
 */
function computeSwingPoints(
  bars: OHLCVBar[],
  lookback = 5,
): { swingHighs: SwingPoint[]; swingLows: SwingPoint[] } {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const bar = bars[i];
    const window = bars.slice(i - lookback, i + lookback + 1);
    const isHigh = window.every(
      (b, idx) => idx === lookback || b.high <= bar.high,
    );
    if (isHigh) highs.push({ date: bar.date, price: bar.high, type: "high" });
    const isLow = window.every(
      (b, idx) => idx === lookback || b.low >= bar.low,
    );
    if (isLow) lows.push({ date: bar.date, price: bar.low, type: "low" });
  }
  return { swingHighs: highs.slice(-5), swingLows: lows.slice(-5) };
}

/**
 * Compute VWAP (Volume-Weighted Average Price) over the full bar series.
 * Returns null if total volume is zero.
 */
function computeVWAP(bars: OHLCVBar[]): number | null {
  if (!bars.length) return null;
  let cumPV = 0;
  let cumVol = 0;
  for (const bar of bars) {
    const typical = (bar.high + bar.low + bar.close) / 3;
    cumPV += typical * bar.volume;
    cumVol += bar.volume;
  }
  return cumVol === 0 ? null : cumPV / cumVol;
}

/**
 * Bucket all bars into `buckets` equal-width price bins and return the top 3 by total volume.
 */
function computeVolumeProfile(
  bars: OHLCVBar[],
  buckets = 8,
): VolumeProfileBucket[] {
  if (!bars.length) return [];
  const priceMin = Math.min(...bars.map((b) => b.low));
  const priceMax = Math.max(...bars.map((b) => b.high));
  if (priceMin === priceMax) return [];
  const bucketWidth = (priceMax - priceMin) / buckets;
  const volumeArr: number[] = new Array(buckets).fill(0);
  for (const bar of bars) {
    const typical = (bar.high + bar.low + bar.close) / 3;
    const idx = Math.min(
      Math.floor((typical - priceMin) / bucketWidth),
      buckets - 1,
    );
    volumeArr[idx] += bar.volume;
  }
  const result: VolumeProfileBucket[] = volumeArr.map((vol, i) => ({
    priceFrom: priceMin + i * bucketWidth,
    priceTo: priceMin + (i + 1) * bucketWidth,
    totalVolume: vol,
  }));
  return result.sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 3);
}

/**
 * Detect price gaps between consecutive bars.
 * A gap is counted when |open/prev_close - 1| ≥ 0.5%.
 */
function computeGapStats(bars: OHLCVBar[]): GapStats {
  const threshold = 0.005;
  const recentGaps: GapStats["recentGaps"] = [];
  let upGaps = 0;
  let downGaps = 0;
  let totalMag = 0;
  for (let i = 1; i < bars.length; i++) {
    const prevClose = bars[i - 1].close;
    const mag = (bars[i].open - prevClose) / prevClose;
    if (Math.abs(mag) >= threshold) {
      const direction = mag > 0 ? "up" : "down";
      if (direction === "up") upGaps++;
      else downGaps++;
      totalMag += Math.abs(mag);
      recentGaps.push({
        date: bars[i].date,
        direction,
        magnitudePct: mag * 100,
      });
    }
  }
  const totalGaps = upGaps + downGaps;
  return {
    totalGaps,
    upGaps,
    downGaps,
    avgMagnitudePct: totalGaps > 0 ? (totalMag / totalGaps) * 100 : 0,
    recentGaps: recentGaps.slice(-5),
  };
}

/**
 * Bundle all OHLCV-derived features into a single structured object.
 * Primary entry point for the technicals analyst pre-computation.
 */
export function computeOHLCVFeatures(bars: OHLCVBar[]): OHLCVFeatures {
  const closes = bars.map((b) => b.close);
  const { swingHighs, swingLows } = computeSwingPoints(bars);
  return {
    rsiSeries: rsiSeries(closes, 20),
    swingHighs,
    swingLows,
    vwap: computeVWAP(bars),
    volumeProfile: computeVolumeProfile(bars, 8),
    gapStats: computeGapStats(bars),
  };
}

/** Main entry: compute all technical indicators from OHLCV bars */
export function computeTechnicalIndicators(
  bars: OHLCVBar[],
): TechnicalIndicators {
  if (bars.length < 2) return {};

  const closes = bars.map((b) => b.close);
  const n = closes.length;
  const currentPrice = closes[n - 1];

  // EMAs for MACD
  const ema12Arr = emaArray(closes, 12);
  const ema26Arr = emaArray(closes, 26);

  let macdLine: number | null = null;
  let macdSignal: number | null = null;
  let macdHistogram: number | null = null;

  if (ema12Arr.length > 0 && ema26Arr.length > 0) {
    const offset = ema12Arr.length - ema26Arr.length;
    const macdArr = ema26Arr.map((v, i) => ema12Arr[i + offset] - v);
    macdLine = macdArr[macdArr.length - 1] ?? null;
    if (macdArr.length >= 9) {
      const signalArr = emaArray(macdArr, 9);
      macdSignal = signalArr[signalArr.length - 1] ?? null;
      if (macdLine !== null && macdSignal !== null) {
        macdHistogram = macdLine - macdSignal;
      }
    }
  }

  const bb = bollingerBands(closes);
  const s50 = sma(closes, Math.min(50, n));
  const s200 = sma(closes, Math.min(200, n));

  const trendDirection = (() => {
    if (s50 === null) return null;
    if (currentPrice > s50 && (s200 === null || currentPrice > s200))
      return "uptrend" as const;
    if (currentPrice < s50 && (s200 === null || currentPrice < s200))
      return "downtrend" as const;
    return "sideways" as const;
  })();

  return {
    sma20: sma(closes, Math.min(20, n)),
    sma50: s50,
    sma200: s200,
    ema12: ema12Arr[ema12Arr.length - 1] ?? null,
    ema26: ema26Arr[ema26Arr.length - 1] ?? null,
    rsi14: rsi14(closes),
    macdLine,
    macdSignal,
    macdHistogram,
    bollingerUpper: bb?.upper ?? null,
    bollingerMiddle: bb?.middle ?? null,
    bollingerLower: bb?.lower ?? null,
    atr14: atr14(bars),
    obvTrend: obvTrend(bars),
    trendDirection,
  };
}
