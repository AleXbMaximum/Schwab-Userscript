// ── Axis / scale utilities ──────────────────────────────────────────────────
// Heckbert "nice numbers" algorithm and axis-tick generation.
// Moved from charting helpers for broader reuse.

export interface NiceScaleResult {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

export interface NiceScaleOptions {
  dataMin: number;
  dataMax: number;
  maxTicks?: number;
  forceIncludeZero?: boolean;
  symmetric?: boolean;
  padding?: number;
}

/**
 * Round a number to a "nice" value (1, 2, 2.5, 5 scaled by power of 10).
 * `round = true` rounds to nearest; `round = false` rounds up (ceiling).
 */
export function niceNum(value: number, round: boolean): number {
  if (value === 0) return 0;
  const negative = value < 0;
  const abs = Math.abs(value);
  const exponent = Math.floor(Math.log10(abs));
  const fraction = abs / Math.pow(10, exponent);

  let nice: number;
  if (round) {
    if (fraction < 1.5) nice = 1;
    else if (fraction < 3) nice = 2;
    else if (fraction < 3.5) nice = 2.5;
    else if (fraction < 7) nice = 5;
    else nice = 10;
  } else {
    if (fraction <= 1) nice = 1;
    else if (fraction <= 2) nice = 2;
    else if (fraction <= 2.5) nice = 2.5;
    else if (fraction <= 5) nice = 5;
    else nice = 10;
  }

  const result = nice * Math.pow(10, exponent);
  return negative ? -result : result;
}

/**
 * Compute nice axis bounds and step for a data range.
 * Produces clean round tick values (e.g. 0, 50, 100, 150 instead of 13, 67, 121).
 */
export function niceScale(options: NiceScaleOptions): NiceScaleResult {
  const {
    maxTicks = 6,
    forceIncludeZero = false,
    symmetric = false,
    padding = 0.05,
  } = options;

  let { dataMin, dataMax } = options;

  // Handle degenerate cases
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
    return { min: 0, max: 1, step: 0.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };
  }

  if (dataMin > dataMax) {
    [dataMin, dataMax] = [dataMax, dataMin];
  }

  if (forceIncludeZero) {
    if (dataMin > 0) dataMin = 0;
    if (dataMax < 0) dataMax = 0;
  }

  if (symmetric) {
    const absMax = Math.max(Math.abs(dataMin), Math.abs(dataMax));
    dataMin = -absMax;
    dataMax = absMax;
  }

  // Apply padding
  const span = dataMax - dataMin;
  if (span < 1e-12) {
    const center = dataMin;
    const expand = Math.abs(center) * 0.1 || 1;
    dataMin = center - expand;
    dataMax = center + expand;
  } else {
    dataMin -= span * padding;
    dataMax += span * padding;
  }

  // Re-enforce constraints after padding
  if (forceIncludeZero) {
    if (dataMin > 0) dataMin = 0;
    if (dataMax < 0) dataMax = 0;
  }
  if (symmetric) {
    const absMax = Math.max(Math.abs(dataMin), Math.abs(dataMax));
    dataMin = -absMax;
    dataMax = absMax;
  }

  const range = niceNum(dataMax - dataMin, false);
  const step = niceNum(range / (maxTicks - 1), true);

  if (step === 0) {
    return { min: dataMin, max: dataMax, step: 1, ticks: [dataMin, dataMax] };
  }

  const niceMin = Math.floor(dataMin / step) * step;
  const niceMax = Math.ceil(dataMax / step) * step;

  // Build tick array with epsilon tolerance for floating-point
  const ticks: number[] = [];
  const eps = step * 1e-9;
  for (let v = niceMin; v <= niceMax + eps; v += step) {
    const rounded = Math.round(v / step) * step;
    ticks.push(rounded);
  }

  return { min: niceMin, max: niceMax, step, ticks };
}

/**
 * Convenience: compute nice scale from a flat array of data values.
 * Filters out non-finite values automatically.
 */
export function niceScaleFromValues(
  values: (number | null | undefined)[],
  opts?: Partial<Omit<NiceScaleOptions, "dataMin" | "dataMax">>,
): NiceScaleResult {
  const finite = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (finite.length === 0) {
    return { min: 0, max: 1, step: 0.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };
  }
  const dataMin = Math.min(...finite);
  const dataMax = Math.max(...finite);
  return niceScale({ dataMin, dataMax, ...opts });
}

/**
 * Pick a "nice" bucket width so that `range / width <= maxCols`.
 * Steps through [0.5, 1, 2.5, 5, 10, 25, 50, 100].
 */
export function pickNiceBucketWidth(range: number, maxCols: number): number {
  const niceSteps = [0.5, 1, 2.5, 5, 10, 25, 50, 100];
  for (const s of niceSteps) {
    if (range / s <= maxCols) return s;
  }
  return niceSteps[niceSteps.length - 1];
}
