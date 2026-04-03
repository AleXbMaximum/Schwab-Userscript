export function toFiniteNumberOrNull(v: unknown): number | null {
  if (v == null) return null;

  if (typeof v === "number") {
    return Number.isFinite(v) ? v : null;
  }

  if (typeof v === "string") {
    if (v.length === 0) return null;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const fallback = parseFloat(String(v));
  return Number.isFinite(fallback) ? fallback : null;
}

export function toFiniteNumberOrNullNoSentinel(v: unknown): number | null {
  if (v === -999 || v === "-999") return null;
  return toFiniteNumberOrNull(v);
}

export function pctPointsToRatio(v: unknown): number | null {
  const n = toFiniteNumberOrNull(v);
  return n == null ? null : n / 100;
}
