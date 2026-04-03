// ── Numeric helper functions ────────────────────────────────────────────────
// Domain-agnostic number manipulation primitives.

/** Clamp `value` to the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear normalization: maps `value` from [min, max] → [0, 1]. Returns 0 when min === max. */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * Round a number to a fixed number of decimal places.
 * Avoids returning `-0`.
 */
export function roundToDecimals(n: number, decimals: number): number {
  const p = 10 ** decimals;
  const rounded = Math.round(n * p) / p;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Safe percentage: `(value / total) * 100`. Returns 0 when `total === 0`. */
export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}
