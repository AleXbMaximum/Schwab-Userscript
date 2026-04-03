import { openAlexQuantDB } from "../../core/db/core/AlexQuantDB";
import { AccountHistoryStore } from "../../core/db/account/AccountHistoryStore";
import { AccountHistoryArchiveStore } from "../../core/db/account/AccountHistoryArchiveStore";
import type { AccountHistoryPoint } from "../../core/db/account/accountHistoryTypes";
import { normalizeHistoryPoint } from "./historyPoint";
import { bucketByResolution, mergeByTimestamp, compactArchive, ONE_MINUTE_MS } from "./historyCompaction";
import { getLiveHistoryCache, getRecentWindowMs } from "./historyCache";

const DEFAULT_ARCHIVE_THRESHOLD = 200_000;

export { DEFAULT_ARCHIVE_THRESHOLD };

async function getStore(): Promise<AccountHistoryStore> {
  const db = await openAlexQuantDB();
  return new AccountHistoryStore(db);
}

async function getArchiveStore(): Promise<AccountHistoryArchiveStore> {
  const db = await openAlexQuantDB();
  return new AccountHistoryArchiveStore(db);
}

/** Load recent history from account_history (configured retention window). */
export async function loadHistory(): Promise<AccountHistoryPoint[]> {
  try {
    const store = await getStore();
    const cutoff = Date.now() - getRecentWindowMs();
    const rawPoints = await store.getRange(cutoff, Date.now() + 60_000);
    return rawPoints
      .map((p) => normalizeHistoryPoint(p))
      .sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

/** Load compacted archive data for long-term views (>7 days). */
export async function loadArchiveHistory(): Promise<AccountHistoryPoint[]> {
  try {
    const archiveStore = await getArchiveStore();
    const rawPoints = await archiveStore.getAll();
    return rawPoints
      .map((p) => normalizeHistoryPoint(p))
      .sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

/**
 * Load history for a given time range, merging archive + recent as needed.
 * For ≤7d: merges persisted + live in-memory points.
 * For >7d: merges archive + persisted + live in-memory points.
 */
export async function loadHistoryForRange(
  durationMs: number,
): Promise<AccountHistoryPoint[]> {
  const cutoff = Date.now() - durationMs;
  const recentWindowMs = getRecentWindowMs();
  if (durationMs <= recentWindowMs) {
    const recent = await loadHistory();
    return mergeByTimestamp(recent, getLiveHistoryCache()).filter(
      (p) => p.ts >= cutoff,
    );
  }
  const [archive, recent] = await Promise.all([
    loadArchiveHistory(),
    loadHistory(),
  ]);
  return mergeByTimestamp(archive, recent, getLiveHistoryCache()).filter(
    (p) => p.ts >= cutoff,
  );
}

/** Save raw history to account_history and trigger archive if needed. */
export async function saveHistory(
  points: AccountHistoryPoint[],
  archiveThreshold: number = DEFAULT_ARCHIVE_THRESHOLD,
  autoArchiveEnabled = true,
): Promise<void> {
  try {
    const persisted = bucketByResolution(points, ONE_MINUTE_MS).sort(
      (a, b) => a.ts - b.ts,
    );
    if (persisted.length === 0) return;
    const store = await getStore();
    await store.putBatch(persisted);

    const cutoff = Date.now() - getRecentWindowMs();
    await store.deleteOlderThan(cutoff);

    if (autoArchiveEnabled) {
      const count = await store.count();
      if (count >= archiveThreshold) {
        void runArchive(persisted);
      }
    }
  } catch {}
}

/** Export all history + archive data as a JSON-serialisable object. */
export async function exportAllHistory(): Promise<{
  version: number;
  exportedAt: number;
  history: AccountHistoryPoint[];
  archive: AccountHistoryPoint[];
}> {
  const [store, archiveStore] = await Promise.all([getStore(), getArchiveStore()]);
  const [history, archive] = await Promise.all([store.getAll(), archiveStore.getAll()]);
  return {
    version: 1,
    exportedAt: Date.now(),
    history: history.map(normalizeHistoryPoint).sort((a, b) => a.ts - b.ts),
    archive: archive.map(normalizeHistoryPoint).sort((a, b) => a.ts - b.ts),
  };
}

/** Import history + archive data, merging with existing records by timestamp. */
export async function importAllHistory(data: {
  history?: unknown[];
  archive?: unknown[];
}): Promise<{ historyCount: number; archiveCount: number }> {
  const historyPoints = (data.history ?? [])
    .map((p) => normalizeHistoryPoint(p))
    .filter((p) => p.ts > 0);
  const archivePoints = (data.archive ?? [])
    .map((p) => normalizeHistoryPoint(p))
    .filter((p) => p.ts > 0);

  const [store, archiveStore] = await Promise.all([getStore(), getArchiveStore()]);
  if (historyPoints.length > 0) await store.putBatch(historyPoints);
  if (archivePoints.length > 0) await archiveStore.putBatch(archivePoints);

  return { historyCount: historyPoints.length, archiveCount: archivePoints.length };
}

/** Archive old data from account_history into account_history_archive. */
async function runArchive(allPoints: AccountHistoryPoint[]): Promise<void> {
  try {
    const recentCutoff = Date.now() - getRecentWindowMs();
    const toArchive = allPoints.filter((p) => p.ts < recentCutoff);
    if (toArchive.length === 0) return;

    const archiveStore = await getArchiveStore();
    const existingArchive = (await archiveStore.getAll()).map((p) =>
      normalizeHistoryPoint(p),
    );

    const merged = new Map<number, AccountHistoryPoint>();
    for (const p of existingArchive) merged.set(p.ts, p);
    for (const p of toArchive) merged.set(p.ts, p);

    const compacted = compactArchive(Array.from(merged.values()));
    await archiveStore.putBatch(compacted);

    const store = await getStore();
    await store.deleteOlderThan(recentCutoff);
  } catch {}
}
