function roundWithFactor(n: number, p: number): number {
  const rounded = Math.round(n * p) / p;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeRecursive(obj: unknown, p: number): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const v = obj[i];
      if (typeof v === "number") {
        if (Number.isFinite(v) && !Number.isInteger(v))
          obj[i] = roundWithFactor(v, p);
      } else if (v && typeof v === "object") {
        normalizeRecursive(v, p);
      }
    }
    return;
  }

  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record);
  for (let i = 0; i < keys.length; i++) {
    const v = record[keys[i]];
    if (typeof v === "number") {
      if (Number.isFinite(v) && !Number.isInteger(v))
        record[keys[i]] = roundWithFactor(v, p);
    } else if (v && typeof v === "object") {
      normalizeRecursive(v, p);
    }
  }
}

export function normalizeNumbersDeepInPlace(obj: unknown, decimals = 6): void {
  const p = 10 ** decimals;
  normalizeRecursive(obj, p);
}
