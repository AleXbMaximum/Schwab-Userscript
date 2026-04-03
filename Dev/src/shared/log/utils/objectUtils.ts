import { deepClone, isPlainObject, cloneRegExp } from "../../utils/deepClone";

export const deepMerge = <T extends Record<string, unknown>>(
  target: T | unknown,
  source: unknown,
): T => {
  if (!isPlainObject(target)) {
    target = {};
  }

  if (!isPlainObject(source)) {
    return deepClone(target as T);
  }

  const merged: Record<string, unknown> = {
    ...(target as Record<string, unknown>),
  };

  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      merged[key] = value.map((item) => deepClone(item));
      return;
    }

    const regexClone = cloneRegExp(value);
    if (regexClone) {
      merged[key] = regexClone;
      return;
    }

    if (isPlainObject(value)) {
      merged[key] = deepMerge(merged[key], value);
      return;
    }

    merged[key] = value;
  });

  return merged as T;
};
