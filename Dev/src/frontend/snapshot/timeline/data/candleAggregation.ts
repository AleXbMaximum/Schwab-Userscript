import type { AccountHistoryPoint } from "../../../../backend/core/db/account/accountHistoryTypes";
import type { SnapshotMetricDef } from "../timelineTypes";

// ── Types ────────────────────────────────────────────────────────────────────

/** A single OHLC candle aggregated from AccountHistoryPoint[]. */
export type CandleBucket = {
  /** Bucket start timestamp (inclusive). */
  startTs: number;
  /** Bucket end timestamp (exclusive). */
  endTs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Number of source points aggregated into this candle. */
  count: number;
};

// ── Resolution lookup ────────────────────────────────────────────────────────

const ONE_MINUTE = 60_000;
const ONE_HOUR = 60 * ONE_MINUTE;
const ONE_DAY = 24 * ONE_HOUR;

/**
 * Fixed-ms resolution table.
 * Each entry: [maxRangeDurationMs, bucketMs].
 * Must be sorted by maxRangeDurationMs ascending.
 */
const RESOLUTION_TABLE: ReadonlyArray<[number, number]> = [
  [1 * ONE_HOUR, 1 * ONE_MINUTE],       // ≤1h   → 1min
  [6.5 * ONE_HOUR, 5 * ONE_MINUTE],     // ≤6.5h → 5min
  [1 * ONE_DAY, 10 * ONE_MINUTE],       // ≤24h  → 10min
  [3 * ONE_DAY, 30 * ONE_MINUTE],       // ≤3d   → 30min
  [7 * ONE_DAY, 1 * ONE_HOUR],          // ≤7d   → 1h
  [30 * ONE_DAY, 2 * ONE_HOUR],         // ≤30d  → 2h
  [90 * ONE_DAY, 8 * ONE_HOUR],         // ≤90d  → 8h
  [Infinity, 1 * ONE_DAY],              // >90d  → 1d
];

/** Resolve the candle bucket duration (ms) for a given time range. */
export function resolveCandleBucketMs(rangeDurationMs: number): number {
  for (const [maxRange, bucket] of RESOLUTION_TABLE) {
    if (rangeDurationMs <= maxRange) return bucket;
  }
  return ONE_DAY;
}

// ── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Aggregate AccountHistoryPoint[] into OHLC candle buckets.
 * Points MUST be sorted by ts ascending.
 * Empty buckets (gaps) are skipped — no synthetic candles are emitted.
 */
export function aggregateCandles(
  points: AccountHistoryPoint[],
  metric: SnapshotMetricDef,
  bucketMs: number,
  _windowStartTs: number,
  _windowEndTs: number,
): CandleBucket[] {
  if (points.length === 0) return [];

  const buckets: CandleBucket[] = [];
  let curStart = -1;
  let curEnd = -1;
  let open = 0;
  let high = -Infinity;
  let low = Infinity;
  let close = 0;
  let count = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const val = metric.pick(p);
    const bStart = Math.floor(p.ts / bucketMs) * bucketMs;

    if (bStart !== curStart) {
      // Flush previous bucket
      if (count > 0) {
        buckets.push({ startTs: curStart, endTs: curEnd, open, high, low, close, count });
      }
      // Start new bucket
      curStart = bStart;
      curEnd = bStart + bucketMs;
      open = val;
      high = val;
      low = val;
      close = val;
      count = 1;
    } else {
      if (val > high) high = val;
      if (val < low) low = val;
      close = val;
      count++;
    }
  }

  // Flush last bucket
  if (count > 0) {
    buckets.push({ startTs: curStart, endTs: curEnd, open, high, low, close, count });
  }

  return buckets;
}

// ── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Binary-search for the candle bucket that contains a given timestamp.
 * Returns null if no bucket contains the timestamp.
 */
export function findCandleBucketByTs(
  buckets: CandleBucket[],
  ts: number,
): CandleBucket | null {
  if (buckets.length === 0) return null;

  let lo = 0;
  let hi = buckets.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = buckets[mid];
    if (ts < b.startTs) {
      hi = mid - 1;
    } else if (ts >= b.endTs) {
      lo = mid + 1;
    } else {
      return b;
    }
  }

  // Not inside any bucket — return nearest
  if (lo >= buckets.length) return buckets[buckets.length - 1];
  if (lo === 0) return buckets[0];
  const prev = buckets[lo - 1];
  const next = buckets[lo];
  return Math.abs(ts - prev.endTs) <= Math.abs(ts - next.startTs) ? prev : next;
}
