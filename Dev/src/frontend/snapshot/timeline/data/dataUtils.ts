import { median } from "../../../../shared/utils/math/statistics";
import type { AccountHistoryPoint } from "../../../../backend/core/db/account/accountHistoryTypes";

export function arrayMinMax(arr: number[]): { min: number; max: number } {
  let min = arr[0];
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    const v = arr[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/**
 * Compute the true gap threshold from the original (non-downsampled) points.
 * Returns the set of original indices i where points[i-1] → points[i] is a true gap.
 * This set is used by buildLineSegmentsWithIndexMap to cut segments correctly
 * after LTTB downsampling, without being affected by the sparse sampling.
 */
export function buildTrueGapOriginalIndices(
  points: AccountHistoryPoint[],
): Set<number> {
  const result = new Set<number>();
  if (points.length < 3) return result;

  const diffs: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const diff = points[i].ts - points[i - 1].ts;
    if (diff > 0) diffs.push(diff);
  }
  if (diffs.length === 0) return result;

  diffs.sort((a, b) => a - b);
  const med = median(diffs);
  const breakGapMs = Math.max(120_000, med * 10);

  for (let i = 1; i < points.length; i += 1) {
    const gap = points[i].ts - points[i - 1].ts;
    if (gap > breakGapMs) result.add(i);
  }
  return result;
}

/**
 * Build line segments for renderPoints using a pre-computed set of true gap
 * original indices. When originalIndexMap is provided (LTTB was applied), a
 * segment cut is inserted between render index i-1 and i only if any original
 * index in the range (originalIndexMap[i-1]+1 … originalIndexMap[i]) is a
 * known true gap. When originalIndexMap is null (no downsampling), the gap
 * indices are applied directly to renderPoints indices.
 */
export function buildLineSegments(
  renderPoints: AccountHistoryPoint[],
  trueGapOriginalIndices: Set<number>,
  originalIndexMap: number[] | null,
): Array<{ start: number; end: number }> {
  if (renderPoints.length === 0) return [];

  const segments: Array<{ start: number; end: number }> = [];
  let start = 0;

  for (let i = 1; i < renderPoints.length; i += 1) {
    let isGap: boolean;

    if (originalIndexMap === null) {
      // No downsampling: render index equals original index.
      isGap = trueGapOriginalIndices.has(i);
    } else {
      // Downsampling was applied. Check whether any original index in the
      // half-open range (prevOrigIdx, currOrigIdx] is a true gap boundary.
      const prevOrigIdx = originalIndexMap[i - 1];
      const currOrigIdx = originalIndexMap[i];
      isGap = false;
      for (let oi = prevOrigIdx + 1; oi <= currOrigIdx; oi += 1) {
        if (trueGapOriginalIndices.has(oi)) {
          isGap = true;
          break;
        }
      }
    }

    if (isGap) {
      segments.push({ start, end: i - 1 });
      start = i;
    }
  }
  segments.push({ start, end: renderPoints.length - 1 });

  return segments.filter((seg) => seg.end >= seg.start);
}

/**
 * Compute Simple Moving Average over `period` data points.
 * Returns an array of the same length; indices with fewer than `period` preceding points are null.
 */
export function computeSMA(
  values: number[],
  period: number,
): (number | null)[] {
  const result: (number | null)[] = new Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i < period - 1) {
      result[i] = null;
    } else {
      if (i >= period) sum -= values[i - period];
      result[i] = sum / period;
    }
  }
  return result;
}

export function findNearestPointIndexByTs(
  points: AccountHistoryPoint[],
  targetTs: number,
): number | null {
  if (points.length === 0) return null;

  let lo = 0;
  let hi = points.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const ts = points[mid].ts;
    if (ts === targetTs) return mid;
    if (ts < targetTs) lo = mid + 1;
    else hi = mid - 1;
  }

  if (lo <= 0) return 0;
  if (lo >= points.length) return points.length - 1;

  const prevIdx = lo - 1;
  const prevDiff = Math.abs(points[prevIdx].ts - targetTs);
  const nextDiff = Math.abs(points[lo].ts - targetTs);
  return prevDiff <= nextDiff ? prevIdx : lo;
}
