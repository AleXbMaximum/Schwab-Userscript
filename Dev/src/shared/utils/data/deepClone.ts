export const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype;

export const cloneRegExp = (value: unknown): RegExp | null => {
  if (!(value instanceof RegExp)) return null;
  return new RegExp(value.source, value.flags);
};

const cloneDate = (value: unknown): Date | null => {
  if (!(value instanceof Date)) return null;
  return new Date(value.getTime());
};

const isCloneableObject = (value: unknown): value is object =>
  value !== null && typeof value === "object";

const deepCloneInternal = (
  value: unknown,
  seen: WeakMap<object, unknown>,
): unknown => {
  if (!isCloneableObject(value)) return value;

  const cached = seen.get(value);
  if (cached !== undefined) return cached;

  if (Array.isArray(value)) {
    const arr: unknown[] = [];
    seen.set(value, arr);
    for (const item of value) arr.push(deepCloneInternal(item, seen));
    return arr;
  }

  const regexClone = cloneRegExp(value);
  if (regexClone) return regexClone;

  const dateClone = cloneDate(value);
  if (dateClone) return dateClone;

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    seen.set(value, out);
    for (const [k, v] of Object.entries(value))
      out[k] = deepCloneInternal(v, seen);
    return out;
  }

  const cloneFn = globalThis.structuredClone;
  if (cloneFn instanceof Function) {
    try {
      return cloneFn(value);
    } catch {
      return value;
    }
  }

  return value;
};

export const deepClone = <T>(value: T): T => {
  const cloneFn = globalThis.structuredClone;
  if (cloneFn instanceof Function) {
    try {
      return cloneFn(value);
    } catch {}
  }

  return deepCloneInternal(value, new WeakMap()) as T;
};
