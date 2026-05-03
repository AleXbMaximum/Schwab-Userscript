import { sma, ema, logReturns } from "../../src/shared/utils/math/timeSeries";
import {
  niceScale,
  niceNum,
  pickNiceBucketWidth,
} from "../../src/shared/utils/math/scale";

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
