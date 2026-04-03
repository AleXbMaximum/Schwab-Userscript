import type { AccountHistoryPoint } from "../../core/db/account/accountHistoryTypes";

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export { ONE_MINUTE_MS };

/** Bucket points by resolution, keeping the latest point per bucket. */
export function bucketByResolution(
  points: AccountHistoryPoint[],
  resolutionMs: number,
): AccountHistoryPoint[] {
  const buckets = new Map<number, AccountHistoryPoint>();
  for (const p of points) {
    const key = Math.floor(p.ts / resolutionMs);
    const existing = buckets.get(key);
    if (!existing || p.ts > existing.ts) {
      buckets.set(key, p);
    }
  }
  return Array.from(buckets.values());
}

export function mergeByTimestamp(
  ...groups: AccountHistoryPoint[][]
): AccountHistoryPoint[] {
  const byTs = new Map<number, AccountHistoryPoint>();
  for (const points of groups) {
    for (const p of points) byTs.set(p.ts, p);
  }
  return Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
}

/** Compact archive data: < 3 months → per-minute, ≥ 3 months → per-hour. */
export function compactArchive(points: AccountHistoryPoint[]): AccountHistoryPoint[] {
  const now = Date.now();
  const threeMonthsAgo = now - THREE_MONTHS_MS;

  const recent = points.filter((p) => p.ts >= threeMonthsAgo);
  const old = points.filter((p) => p.ts < threeMonthsAgo);

  const compactedRecent = bucketByResolution(recent, ONE_MINUTE_MS);
  const compactedOld = bucketByResolution(old, ONE_HOUR_MS);

  return [...compactedOld, ...compactedRecent].sort((a, b) => a.ts - b.ts);
}
