import {
  sma,
  ema,
  trueRange,
  atr,
  supertrend,
  vwap,
  logReturns,
} from "../../src/backend/computation/technicals/timeSeries";
import { rsiFull, macdFull } from "../../src/backend/computation/technicals/oscillators";
import { adxFull } from "../../src/backend/computation/technicals/directionalMovement";
import { niceScale, niceNum, pickNiceBucketWidth } from "../../src/backend/computation/technicals/scale";

describe("timeSeries primitives", () => {
  it("sma returns running average with correct length", () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out).toEqual([2, 3, 4]);
  });

  it("sma returns empty array when input shorter than period", () => {
    expect(sma([1, 2], 3)).toEqual([]);
  });

  it("ema seeds with SMA and produces input.length - period + 1 values", () => {
    const out = ema([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
    expect(out).toHaveLength(8);
    expect(out[0]).toBeCloseTo(2, 9);
    out.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  it("logReturns skips invalid pairs", () => {
    expect(logReturns([100, 110])).toEqual([Math.log(110 / 100)]);
    expect(logReturns([100, 0, 110])).toEqual([]);
  });

  it("trueRange and atr produce monotonically valid output", () => {
    const highs = [10, 11, 12, 11, 10, 11];
    const lows = [9, 10, 11, 10, 9, 10];
    const closes = [9.5, 10.5, 11.5, 10.5, 9.5, 10.5];
    const tr = trueRange(highs, lows, closes);
    expect(tr).toHaveLength(highs.length - 1);
    tr.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));

    const a = atr(tr, 3);
    expect(a).toHaveLength(tr.length - 3 + 1);
    a.forEach((v) => expect(v).toBeGreaterThan(0));
  });

  it("supertrend null-pads warmup and emits 1/-1 trend afterwards", () => {
    const highs = Array.from({ length: 20 }, (_, i) => 100 + i);
    const lows = Array.from({ length: 20 }, (_, i) => 99 + i);
    const closes = Array.from({ length: 20 }, (_, i) => 99.5 + i);
    const { values, trend } = supertrend(highs, lows, closes, 5, 2);
    expect(values).toHaveLength(20);
    expect(trend).toHaveLength(20);
    for (let i = 0; i < 5; i++) {
      expect(values[i]).toBeNull();
      expect(trend[i]).toBeNull();
    }
    for (let i = 5; i < 20; i++) {
      expect(trend[i] === 1 || trend[i] === -1).toBe(true);
    }
  });

  it("vwap resets across ET session boundaries", () => {
    // Two bars on Mon, one bar on Tue (UTC ms picked far apart).
    const day1 = Date.UTC(2024, 5, 3, 14, 0, 0); // Mon 14:00 UTC
    const day1b = Date.UTC(2024, 5, 3, 15, 0, 0);
    const day2 = Date.UTC(2024, 5, 4, 14, 0, 0); // Tue 14:00 UTC
    const out = vwap(
      [10, 11, 100],
      [10, 11, 100],
      [10, 11, 100],
      [100, 100, 50],
      [day1, day1b, day2],
    );
    expect(out[0]).toBeCloseTo(10, 9);
    expect(out[1]).toBeCloseTo(10.5, 9);
    expect(out[2]).toBeCloseTo(100, 9); // session reset → only Tue's bar counts
  });
});

describe("oscillators", () => {
  it("rsiFull warmup is null then values stay in [0, 100]", () => {
    const closes = [44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00];
    const out = rsiFull(closes, 14);
    expect(out).toHaveLength(closes.length);
    for (let i = 0; i < 14; i++) expect(out[i]).toBeNull();
    for (let i = 14; i < out.length; i++) {
      const v = out[i];
      expect(v).not.toBeNull();
      expect(v as number).toBeGreaterThanOrEqual(0);
      expect(v as number).toBeLessThanOrEqual(100);
    }
  });

  it("macdFull histogram = macd - signal where both defined", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 5) * 5);
    const { macd, signal, histogram } = macdFull(closes);
    for (let i = 0; i < closes.length; i++) {
      const m = macd[i];
      const s = signal[i];
      const h = histogram[i];
      if (m != null && s != null) {
        expect(h).not.toBeNull();
        expect(Math.abs((h as number) - (m - s))).toBeLessThan(1e-9);
      }
    }
  });
});

describe("directionalMovement", () => {
  it("adxFull yields finite, in-range values once warm", () => {
    const n = 60;
    const highs = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 3) * 5 + 0.5);
    const lows = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 3) * 5 - 0.5);
    const closes = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 3) * 5);
    const { adx, plusDI, minusDI } = adxFull(highs, lows, closes, 14);
    expect(adx).toHaveLength(n);
    const lastAdx = adx[n - 1];
    expect(lastAdx).not.toBeNull();
    expect(lastAdx as number).toBeGreaterThanOrEqual(0);
    expect(lastAdx as number).toBeLessThanOrEqual(100);
    [plusDI[n - 1], minusDI[n - 1]].forEach((v) => {
      expect(v).not.toBeNull();
      expect(v as number).toBeGreaterThanOrEqual(0);
      expect(v as number).toBeLessThanOrEqual(100);
    });
  });
});

describe("scale", () => {
  it("niceNum rounds to 1, 2, 2.5, 5 family", () => {
    expect(niceNum(1.2, true)).toBe(1);
    expect(niceNum(2.4, true)).toBe(2);
    expect(niceNum(3.2, true)).toBe(2.5);
    expect(niceNum(6, true)).toBe(5);
    expect(niceNum(8, true)).toBe(10);
  });

  it("niceScale produces clean ticks bracketing the data", () => {
    const r = niceScale({ dataMin: 13, dataMax: 67, maxTicks: 6 });
    expect(r.ticks[0]).toBeLessThanOrEqual(13);
    expect(r.ticks[r.ticks.length - 1]).toBeGreaterThanOrEqual(67);
    expect(r.step).toBeGreaterThan(0);
  });

  it("pickNiceBucketWidth fits range under maxCols", () => {
    expect(pickNiceBucketWidth(50, 10)).toBeGreaterThanOrEqual(5);
  });
});
