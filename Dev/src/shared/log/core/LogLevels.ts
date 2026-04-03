const LOG_LEVELS = ["error", "warn", "info", "debug"] as const;

export type CanonicalLogLevel = (typeof LOG_LEVELS)[number];
export type NormalizedLevel = CanonicalLogLevel | "disabled";

const LEVEL_PRIORITY = Object.freeze(
  (LOG_LEVELS as readonly string[]).reduce(
    (acc, level, index) => {
      (acc as Record<string, number>)[level] = index;
      return acc;
    },
    Object.create(null) as Record<string, number>,
  ),
);

const DISABLED_TOKENS = new Set(["disabled", "off"]);

const NORMALIZED_ALIASES = Object.freeze({
  all: "debug",
  verbose: "debug",
  trace: "debug",
} as const);

const normalize = (value: unknown): NormalizedLevel | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  if (DISABLED_TOKENS.has(trimmed)) {
    return "disabled";
  }

  if ((LEVEL_PRIORITY as any)[trimmed] !== undefined) {
    return trimmed as NormalizedLevel;
  }

  const aliased = (NORMALIZED_ALIASES as any)[trimmed];
  if (aliased) {
    return aliased as NormalizedLevel;
  }

  return null;
};

export const normalizeLevel = (value: unknown) => normalize(value);

export const isLevelEnabled = (threshold: unknown, level: unknown) => {
  const normalizedLevel = normalize(level);
  if (!normalizedLevel || normalizedLevel === "disabled") return false;

  const normalizedThreshold = normalize(threshold);
  if (!normalizedThreshold || normalizedThreshold === "disabled") {
    return false;
  }

  const thresholdKey =
    (NORMALIZED_ALIASES as any)[normalizedThreshold] || normalizedThreshold;
  return (
    (LEVEL_PRIORITY as any)[normalizedLevel] <=
    (LEVEL_PRIORITY as any)[thresholdKey]
  );
};
