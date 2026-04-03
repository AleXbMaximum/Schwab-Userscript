import { getKeyConfig } from "./config/storageConfig";

export function coerceToType(key, value) {
  const config = getKeyConfig(key);
  if (!config) {
    return value; // No config, return as-is
  }

  try {
    switch (config.type) {
      case "array":
        return Array.isArray(value) ? value : config.default;

      case "object":
        return value && typeof value === "object" && !Array.isArray(value)
          ? value
          : config.default;

      case "string":
        return typeof value === "string"
          ? value
          : String(value || config.default);

      case "number":
        const num = Number(value);
        return isNaN(num) ? config.default : num;

      case "boolean":
        return typeof value === "boolean" ? value : Boolean(value);

      default:
        return value;
    }
  } catch {
    return config.default;
  }
}
