// ── Numeric guard utilities ──────────────────────────────────────────────────
// Pure type-guards and safe arithmetic helpers.
// No domain dependencies — safe to import from any layer.

/** Type-guard: value is a finite number (not NaN, not ±Infinity). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Accumulate `v` into `acc` only when `v` is a finite number.
 * Useful for reducing over mixed-type fields: `arr.reduce(addFinite, 0)`.
 */
export function addFinite(acc: number, v: unknown): number {
  return isFiniteNumber(v) ? acc + v : acc;
}

/**
 * Null-safe division.
 * Returns `null` when numerator, denominator, or result would be non-finite,
 * or when `den === 0`.
 */
export function safeDiv(
  num: number | null | undefined,
  den: number | null | undefined,
  fallback: number | null = null,
): number | null {
  if (num == null || den == null) return fallback;
  if (!Number.isFinite(num) || !Number.isFinite(den)) return fallback;
  if (den === 0) return fallback;
  return num / den;
}
