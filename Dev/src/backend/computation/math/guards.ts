// Numeric guard utilities — pure type guards and safe arithmetic helpers.
// No domain dependencies; safe to import from any layer.

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function addFinite(acc: number, v: unknown): number {
  return isFiniteNumber(v) ? acc + v : acc;
}

export function sumFinite(
  values: Array<number | null | undefined>,
): number | null {
  let total = 0;
  let found = false;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    total += v;
    found = true;
  }
  return found ? total : null;
}
