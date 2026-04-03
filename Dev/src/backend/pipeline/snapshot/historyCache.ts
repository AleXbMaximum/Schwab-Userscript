import type { AccountHistoryPoint } from "../../core/db/account/accountHistoryTypes";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 7;

let liveHistoryCache: AccountHistoryPoint[] = [];
let recentWindowMs = DEFAULT_RETENTION_DAYS * DAY_MS;

export function getLiveHistoryCache(): AccountHistoryPoint[] {
  return liveHistoryCache;
}

export function updateLiveHistoryCache(points: AccountHistoryPoint[]): void {
  liveHistoryCache = points;
}

export function getRecentWindowMs(): number {
  return recentWindowMs;
}

export function normalizeRetentionDays(
  value: unknown,
  fallback = DEFAULT_RETENTION_DAYS,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.round(parsed);
}

export function setSnapshotRetentionDays(days: number): void {
  recentWindowMs = normalizeRetentionDays(days) * DAY_MS;
}

export { DEFAULT_RETENTION_DAYS };
