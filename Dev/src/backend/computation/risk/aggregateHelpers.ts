import { isFiniteNumber } from "../../../shared/utils/math/guards";

export function sumByField<T>(
  byUnderlying: Record<string, T> | null | undefined,
  pick: (row: T | undefined) => number | null | undefined,
  options?: { cached?: number | null | undefined; abs?: boolean },
): number {
  const cached = options?.cached;
  if (isFiniteNumber(cached)) return cached;
  let total = 0;
  if (!byUnderlying) return total;
  for (const key in byUnderlying) {
    const v = pick(byUnderlying[key]);
    if (isFiniteNumber(v)) total += options?.abs ? Math.abs(v) : v;
  }
  return total;
}
