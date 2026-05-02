// Average Directional Index (Wilder, 1978). Reuses trueRange() for the TR component.

import { trueRange } from "./timeSeries";

export type ADXResult = {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
};

/**
 * Compute ADX, +DI, -DI. All output arrays match input length, null-padded during warmup.
 * Warmup ~ 2 x period bars.
 */
export function adxFull(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  period = 14,
): ADXResult {
  const n = Math.min(highs.length, lows.length, closes.length);
  const adx: (number | null)[] = new Array(n).fill(null);
  const plusDI: (number | null)[] = new Array(n).fill(null);
  const minusDI: (number | null)[] = new Array(n).fill(null);
  if (n < period + 1 || period < 1) return { adx, plusDI, minusDI };

  const tr = trueRange(highs, lows, closes);
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  for (let i = 1; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  if (tr.length < period) return { adx, plusDI, minusDI };

  let smoothTR = 0, smoothPlusDM = 0, smoothMinusDM = 0;
  for (let i = 0; i < period; i++) {
    smoothTR += tr[i];
    smoothPlusDM += plusDM[i];
    smoothMinusDM += minusDM[i];
  }
  smoothTR /= period;
  smoothPlusDM /= period;
  smoothMinusDM /= period;

  const dxValues: number[] = [];

  const barOffset = period;
  const setPDI = (origIdx: number, pdi: number, mdi: number) => {
    if (origIdx >= 0 && origIdx < n) {
      plusDI[origIdx] = pdi;
      minusDI[origIdx] = mdi;
    }
  };

  {
    const pdi = smoothTR > 0 ? 100 * smoothPlusDM / smoothTR : 0;
    const mdi = smoothTR > 0 ? 100 * smoothMinusDM / smoothTR : 0;
    const sum = pdi + mdi;
    const dx = sum > 0 ? 100 * Math.abs(pdi - mdi) / sum : 0;
    dxValues.push(dx);
    setPDI(barOffset, pdi, mdi);
  }

  for (let i = period; i < tr.length; i++) {
    smoothTR = (smoothTR * (period - 1) + tr[i]) / period;
    smoothPlusDM = (smoothPlusDM * (period - 1) + plusDM[i]) / period;
    smoothMinusDM = (smoothMinusDM * (period - 1) + minusDM[i]) / period;

    const pdi = smoothTR > 0 ? 100 * smoothPlusDM / smoothTR : 0;
    const mdi = smoothTR > 0 ? 100 * smoothMinusDM / smoothTR : 0;
    const sum = pdi + mdi;
    const dx = sum > 0 ? 100 * Math.abs(pdi - mdi) / sum : 0;
    dxValues.push(dx);
    setPDI(i + 1, pdi, mdi);
  }

  if (dxValues.length < period) return { adx, plusDI, minusDI };

  let adxVal = 0;
  for (let i = 0; i < period; i++) adxVal += dxValues[i];
  adxVal /= period;

  const adxStartBar = barOffset + period - 1;
  if (adxStartBar < n) adx[adxStartBar] = adxVal;

  for (let i = period; i < dxValues.length; i++) {
    adxVal = (adxVal * (period - 1) + dxValues[i]) / period;
    const bar = barOffset + i;
    if (bar < n) adx[bar] = adxVal;
  }

  return { adx, plusDI, minusDI };
}
