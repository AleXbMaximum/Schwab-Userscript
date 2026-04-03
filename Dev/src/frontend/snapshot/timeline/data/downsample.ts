/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm.
 * Returns an array of selected indices from the input arrays.
 */
export function downsampleLTTB(
  timestamps: number[],
  values: number[],
  targetCount: number,
): number[] {
  const n = timestamps.length;
  if (n <= targetCount) {
    const indices: number[] = new Array(n);
    for (let i = 0; i < n; i++) indices[i] = i;
    return indices;
  }

  const sampled: number[] = [0];
  const bucketSize = (n - 2) / (targetCount - 2);

  let prevSelected = 0;

  for (let bucket = 0; bucket < targetCount - 2; bucket++) {
    const rangeStart = Math.floor((bucket + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((bucket + 2) * bucketSize) + 1, n - 1);

    let avgX = 0;
    let avgY = 0;
    const nextStart = rangeEnd;
    const nextEnd = Math.min(Math.floor((bucket + 3) * bucketSize) + 1, n);
    const nextCount = nextEnd - nextStart;
    if (nextCount > 0) {
      for (let i = nextStart; i < nextEnd; i++) {
        avgX += timestamps[i];
        avgY += values[i];
      }
      avgX /= nextCount;
      avgY /= nextCount;
    } else {
      avgX = timestamps[n - 1];
      avgY = values[n - 1];
    }

    const prevX = timestamps[prevSelected];
    const prevY = values[prevSelected];
    let maxArea = -1;
    let bestIdx = rangeStart;

    for (let i = rangeStart; i < rangeEnd; i++) {
      const area = Math.abs(
        (prevX - avgX) * (values[i] - prevY) -
          (prevX - timestamps[i]) * (avgY - prevY),
      );
      if (area > maxArea) {
        maxArea = area;
        bestIdx = i;
      }
    }

    sampled.push(bestIdx);
    prevSelected = bestIdx;
  }

  sampled.push(n - 1);
  return sampled;
}
