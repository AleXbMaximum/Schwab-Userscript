import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");

export const DB_NAME = "alexquant";
const DB_VERSION = 10;

export const STORES = {
  KV: "kv",
  ACCOUNT_SNAPSHOT_HISTORY: "account_snapshot_history",
  ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE: "account_snapshot_history_archive",
  MONITOR_OPENINGS: "monitor_openings",
  TIMESTAMP_OPENINGS: "timestamp_openings",
  SNAPSHOTS: "opening_snapshots",
  STRIKE_AGGREGATES: "opening_strike_aggregates",
  STRIKE_LEGS: "options_opening_strike_legs",
  FEATURE_LABELS: "options_feature_labels",
  AI_ANALYSES: "ai_analyses",
  AI_MEMORIES: "ai_memories",
} as const;

function hasStore(db: IDBDatabase, storeName: string): boolean {
  return db.objectStoreNames.contains(storeName);
}

function ensureStore(
  db: IDBDatabase,
  tx: IDBTransaction,
  storeName: string,
  keyPath: string | string[],
): IDBObjectStore {
  if (hasStore(db, storeName)) return tx.objectStore(storeName);
  return db.createObjectStore(storeName, { keyPath });
}

function ensureIndex(
  store: IDBObjectStore,
  indexName: string,
  keyPath: string | string[],
  options?: IDBIndexParameters,
): void {
  if (store.indexNames.contains(indexName)) return;
  store.createIndex(indexName, keyPath, options);
}

let cachedDB: IDBDatabase | null = null;

export function openAlexQuantDB(): Promise<IDBDatabase> {
  if (cachedDB) return Promise.resolve(cachedDB);

  const span = log.span("openAlexQuantDB");

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
      log.info("db.upgrade", { from: oldVersion, to: DB_VERSION });
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction;
      if (!tx) return;

      ensureStore(db, tx, STORES.KV, "key");
      ensureStore(db, tx, STORES.ACCOUNT_SNAPSHOT_HISTORY, "ts");
      ensureStore(db, tx, STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE, "ts");

      const monitor = ensureStore(db, tx, STORES.MONITOR_OPENINGS, [
        "symbol",
        "capturedAt",
      ]);
      ensureIndex(monitor, "symbol", "symbol", { unique: false });

      const timestamp = ensureStore(db, tx, STORES.TIMESTAMP_OPENINGS, [
        "symbol",
        "savedAt",
      ]);
      ensureIndex(timestamp, "symbol", "symbol", { unique: false });

      const snapshots = ensureStore(db, tx, STORES.SNAPSHOTS, "openingId");
      ensureIndex(snapshots, "symbolDataTs", ["symbol", "dataTimestamp"], {
        unique: true,
      });
      ensureIndex(snapshots, "symbolCaptured", ["symbol", "capturedAtUtc"], {
        unique: false,
      });
      ensureIndex(snapshots, "capturedAt", "capturedAtUtc", { unique: false });

      const strikeAgg = ensureStore(db, tx, STORES.STRIKE_AGGREGATES, [
        "openingId",
        "strike",
      ]);
      ensureIndex(strikeAgg, "openingId", "openingId", { unique: false });

      const strikeLegs = ensureStore(db, tx, STORES.STRIKE_LEGS, [
        "openingId",
        "expiryLabel",
        "strike",
        "optionType",
      ]);
      ensureIndex(strikeLegs, "openingId", "openingId", { unique: false });

      const labels = ensureStore(db, tx, STORES.FEATURE_LABELS, [
        "openingId",
        "symbol",
      ]);
      ensureIndex(labels, "openingId", "openingId", { unique: false });

      const analyses = ensureStore(db, tx, STORES.AI_ANALYSES, [
        "symbol",
        "id",
      ]);
      ensureIndex(analyses, "symbol", "symbol", { unique: false });
      ensureIndex(analyses, "requestedAt", "requestedAt", { unique: false });

      const memories = ensureStore(db, tx, STORES.AI_MEMORIES, [
        "symbol",
        "id",
      ]);
      ensureIndex(memories, "symbol", "symbol", { unique: false });

    };

    req.onsuccess = () => {
      cachedDB = req.result;
      cachedDB.onclose = () => {
        log.info("db.closed");
        cachedDB = null;
      };
      span.end("ok", { version: DB_VERSION }, "info");
      resolve(cachedDB);
    };

    req.onerror = () => {
      span.end("error", { error: req.error?.message ?? "unknown" }, "error");
      reject(req.error);
    };
  });
}
