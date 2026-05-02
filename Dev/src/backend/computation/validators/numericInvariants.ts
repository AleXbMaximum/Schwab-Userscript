// Pure validators for numeric records — no I/O, no logging.
// Originally adapted from the desktop app's Script/verify/ audit-log checkers.
// These are reusable at runtime (e.g. before persisting AI report data) and
// are exercised by the test suite to guard against silent regressions.

import { isFiniteNumber } from "../math/guards";

export interface NumericRecord {
  [field: string]: unknown;
}

const PRICE_LIKE_RE = /price/i;
const SPOT_FIELD = "spot";

/**
 * Generic numeric invariants that hold across any record:
 *   - Any field whose name matches /price/i, or equals "spot", must be > 0
 *   - r_squared must be in [0, 1]
 *   - sample_size must be > 0
 *   - All numeric fields must be finite (no NaN, no +/-Infinity)
 *
 * Returns one violation message per breach. An empty array means valid.
 */
export function findInvariantViolations(
  records: readonly NumericRecord[],
  context = "",
): string[] {
  const violations: string[] = [];

  records.forEach((record, index) => {
    const tag = context ? `${context}[${index}]` : `record[${index}]`;
    for (const [key, val] of Object.entries(record)) {
      if (typeof val !== "number") continue;
      if (!Number.isFinite(val)) {
        violations.push(`${tag}: ${key} is not finite (got ${String(val)})`);
        continue;
      }

      if (PRICE_LIKE_RE.test(key) || key === SPOT_FIELD) {
        if (val <= 0) {
          violations.push(`${tag}: ${key} must be > 0 (got ${val})`);
        }
      }
      if (key === "r_squared" && (val < 0 || val > 1)) {
        violations.push(`${tag}: r_squared must be in [0, 1] (got ${val})`);
      }
      if (key === "sample_size" && val <= 0) {
        violations.push(`${tag}: sample_size must be > 0 (got ${val})`);
      }
    }
  });

  return violations;
}

/** Numeric fields a Greeks summary must always populate without NaN/Infinity. */
export const GREEKS_NUMERIC_FIELDS = [
  "spot",
  "atm_strike",
  "atm_iv",
  "atm_delta",
  "atm_gamma",
  "atm_vega",
  "atm_theta",
  "chain_size",
] as const;

/**
 * Greeks-specific invariants beyond the generic ones:
 *   - atm_delta in [-1, 1]
 *   - atm_gamma >= 0
 *   - atm_vega >= 0
 *   - chain_size > 0
 *   - All listed numeric fields must be finite when present
 *
 * Absent fields are tolerated; only present-but-invalid values fail.
 */
export function findGreeksViolations(
  records: readonly NumericRecord[],
  context = "",
): string[] {
  const violations: string[] = [];

  records.forEach((record, index) => {
    const tag = context ? `${context}[${index}]` : `greeks[${index}]`;

    for (const field of GREEKS_NUMERIC_FIELDS) {
      const val = record[field];
      if (val === undefined || val === null) continue;
      if (!isFiniteNumber(val)) {
        violations.push(
          `${tag}: ${field} is not finite (got ${String(val)})`,
        );
      }
    }

    const delta = record.atm_delta;
    if (isFiniteNumber(delta) && (delta < -1 || delta > 1)) {
      violations.push(
        `${tag}: atm_delta out of range [-1, 1] (got ${delta})`,
      );
    }

    const gamma = record.atm_gamma;
    if (isFiniteNumber(gamma) && gamma < 0) {
      violations.push(`${tag}: atm_gamma must be >= 0 (got ${gamma})`);
    }

    const vega = record.atm_vega;
    if (isFiniteNumber(vega) && vega < 0) {
      violations.push(`${tag}: atm_vega must be >= 0 (got ${vega})`);
    }

    const chainSize = record.chain_size;
    if (isFiniteNumber(chainSize) && chainSize <= 0) {
      violations.push(
        `${tag}: chain_size must be > 0 (got ${chainSize})`,
      );
    }
  });

  return violations;
}
