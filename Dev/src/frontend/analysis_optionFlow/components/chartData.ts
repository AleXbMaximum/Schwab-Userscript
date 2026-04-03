import type {
  OptionCaptureMetaRow,
  OptionCaptureExpiryMetricsRow,
} from "backend/core/db/capture/optionMonitorTypes";

export type FlowChartData = {
  meta: OptionCaptureMetaRow[];
  expiry: OptionCaptureExpiryMetricsRow[];
};

export interface CaptureFrame {
  meta: OptionCaptureMetaRow;
  expiries: OptionCaptureExpiryMetricsRow[];
  nearestExpiry: OptionCaptureExpiryMetricsRow | null;
}

export interface DualAxisBounds {
  aMin: number;
  aMax: number;
  bMin: number;
  bMax: number;
}

function toFinite(values: (number | null | undefined)[]): number[] {
  return values.filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ensureZeroInAxis(values: number[]): { min: number; max: number } {
  let min = Math.min(...values, 0);
  let max = Math.max(...values, 0);

  if (Math.abs(max - min) < 1e-9) {
    const fallback = Math.max(Math.abs(min), Math.abs(max), 1);
    min = -fallback;
    max = fallback;
  }

  return { min, max };
}

function zeroRatio(min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return 0.5;
  return clamp(-min / range, 0, 1);
}

function alignAxis(
  min: number,
  max: number,
  targetRatio: number,
): { min: number; max: number } {
  const target = clamp(targetRatio, 0.001, 0.999);
  const current = zeroRatio(min, max);
  if (Math.abs(current - target) < 1e-3) return { min, max };

  if (current < target) {
    const denominator = 1 - target;
    min = (-target * max) / denominator;
  } else {
    max = (-min * (1 - target)) / target;
  }
  return { min, max };
}

function withPadding(
  min: number,
  max: number,
  padRatio: number = 0.05,
): { min: number; max: number } {
  const range = Math.max(max - min, 1e-9);
  const pad = range * padRatio;
  return { min: min - pad, max: max + pad };
}

function niceStepSize(range: number): number {
  if (range <= 0) return 1;
  const raw = range / 6;
  const exponent = Math.floor(Math.log10(raw));
  const fraction = raw / Math.pow(10, exponent);
  let nice: number;
  if (fraction < 1.5) nice = 1;
  else if (fraction < 3) nice = 2;
  else if (fraction < 3.5) nice = 2.5;
  else if (fraction < 7) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exponent);
}

function snapToNiceBounds(
  min: number,
  max: number,
): { min: number; max: number } {
  const step = niceStepSize(max - min);
  return {
    min: Math.floor(min / step) * step,
    max: Math.ceil(max / step) * step,
  };
}

export function groupExpiriesByOpeningId(
  expiryRows: OptionCaptureExpiryMetricsRow[],
): Map<string, OptionCaptureExpiryMetricsRow[]> {
  const groups = new Map<string, OptionCaptureExpiryMetricsRow[]>();
  for (const expiry of expiryRows) {
    const rows = groups.get(expiry.openingId);
    if (rows) {
      rows.push(expiry);
    } else {
      groups.set(expiry.openingId, [expiry]);
    }
  }
  return groups;
}

function nearestExpiryFor(
  rows: OptionCaptureExpiryMetricsRow[],
): OptionCaptureExpiryMetricsRow | null {
  if (rows.length === 0) return null;
  let nearest = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].dte < nearest.dte) nearest = rows[i];
  }
  return nearest;
}

export function buildCaptureFrames(
  metaRows: OptionCaptureMetaRow[],
  expiryRows: OptionCaptureExpiryMetricsRow[],
): CaptureFrame[] {
  const expiriesByOpening = groupExpiriesByOpeningId(expiryRows);
  return metaRows.map((meta) => {
    const expiries = expiriesByOpening.get(meta.openingId) ?? [];
    return {
      meta,
      expiries,
      nearestExpiry: nearestExpiryFor(expiries),
    };
  });
}

export function firstFinitePositive(
  values: (number | null | undefined)[],
): number | null {
  for (const value of values) {
    if (value != null && Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

export function alignDualAxisAtZero(
  aValues: (number | null | undefined)[],
  bValues: (number | null | undefined)[],
): DualAxisBounds | null {
  const aFinite = toFinite(aValues);
  const bFinite = toFinite(bValues);
  if (aFinite.length === 0 || bFinite.length === 0) return null;

  let { min: aMin, max: aMax } = ensureZeroInAxis(aFinite);
  let { min: bMin, max: bMax } = ensureZeroInAxis(bFinite);

  const aZero = zeroRatio(aMin, aMax);
  const bZero = zeroRatio(bMin, bMax);

  if (Math.abs(aZero - bZero) >= 0.01) {
    const target = Math.max(aZero, bZero);
    ({ min: aMin, max: aMax } = alignAxis(aMin, aMax, target));
    ({ min: bMin, max: bMax } = alignAxis(bMin, bMax, target));
  }

  ({ min: aMin, max: aMax } = withPadding(aMin, aMax));
  ({ min: bMin, max: bMax } = withPadding(bMin, bMax));

  // Snap to nice round numbers for clean axis labels
  ({ min: aMin, max: aMax } = snapToNiceBounds(aMin, aMax));
  ({ min: bMin, max: bMax } = snapToNiceBounds(bMin, bMax));

  return { aMin, aMax, bMin, bMax };
}
