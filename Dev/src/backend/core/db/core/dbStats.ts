import { DB_NAME, STORES, openAlexQuantDB } from "./AlexQuantDB";
import { txPromise } from "./idbUtils";

// ── Public types ──

export interface StoreStats {
  name: string;
  count: number;
  estimatedSizeBytes: number | null;
}

export interface DbStats {
  dbName: string;
  dbVersion: number;
  stores: StoreStats[];
  totalRecords: number;
  totalEstimatedSizeBytes: number | null;
  /** Total bytes used by the entire browser origin (not just this DB). */
  estimatedOriginUsageBytes: number | null;
}

export interface StoreDetailGroup {
  key: string;
  count: number;
}

export interface StoreDetails {
  groups: StoreDetailGroup[];
  dateRange?: { oldest: string; newest: string };
  /** Whether `count` in groups represents record count or byte size. */
  groupUnit: "records" | "bytes";
}

// ── Helpers ──

function countStore(db: IDBDatabase, storeName: string): Promise<number> {
  const tx = db.transaction(storeName, "readonly");
  return txPromise(tx.objectStore(storeName).count());
}

function estimateJsonBytes(val: unknown): number {
  const json = JSON.stringify(val);
  try {
    return new Blob([json]).size;
  } catch {
    return json.length * 2;
  }
}

async function sampleAvgRecordSize(
  db: IDBDatabase,
  storeName: string,
): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const samples: unknown[] = [];
      const req = tx.objectStore(storeName).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && samples.length < 10) {
          samples.push(cursor.value);
          cursor.continue();
        } else {
          if (samples.length === 0) {
            resolve(null);
            return;
          }
          let total = 0;
          for (const val of samples) total += estimateJsonBytes(val);
          resolve(Math.round(total / samples.length));
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// ── Main stats collector ──

export async function collectDbStats(): Promise<DbStats> {
  const db = await openAlexQuantDB();
  const storeNames = Object.values(STORES);

  const [counts, avgSizes] = await Promise.all([
    Promise.all(storeNames.map((name) => countStore(db, name))),
    Promise.all(storeNames.map((name) => sampleAvgRecordSize(db, name))),
  ]);

  const stores: StoreStats[] = storeNames.map((name, i) => ({
    name,
    count: counts[i],
    estimatedSizeBytes: avgSizes[i] != null ? avgSizes[i]! * counts[i] : null,
  }));

  let estimatedOriginUsageBytes: number | null = null;
  if (navigator.storage?.estimate) {
    try {
      estimatedOriginUsageBytes =
        (await navigator.storage.estimate()).usage ?? null;
    } catch {
      // StorageManager not available or blocked
    }
  }

  const totalEstimatedSizeBytes =
    stores.reduce(
      (sum, s) =>
        s.estimatedSizeBytes != null ? sum + s.estimatedSizeBytes : sum,
      0,
    ) || null;

  return {
    dbName: DB_NAME,
    dbVersion: db.version,
    stores,
    totalRecords: counts.reduce((a, b) => a + b, 0),
    totalEstimatedSizeBytes,
    estimatedOriginUsageBytes,
  };
}

// ── On-demand detail loaders ──

/** KV store: list all keys with individual value sizes in bytes. */
async function kvDetails(db: IDBDatabase): Promise<StoreDetails> {
  const tx = db.transaction(STORES.KV, "readonly");
  const records = await txPromise<{ key: string; value: unknown }[]>(
    tx.objectStore(STORES.KV).getAll(),
  );
  const groups = records
    .map((r) => ({ key: String(r.key), count: estimateJsonBytes(r.value) }))
    .sort((a, b) => b.count - a.count);
  return { groups, groupUnit: "bytes" };
}

/** Account history: date range from oldest to newest record. */
async function accountHistoryDetails(
  db: IDBDatabase,
  storeName: string,
): Promise<StoreDetails> {
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);

  const [first, last] = await Promise.all([
    new Promise<{ ts: number } | null>((res) => {
      const req = store.openCursor();
      req.onsuccess = () => res(req.result?.value ?? null);
      req.onerror = () => res(null);
    }),
    new Promise<{ ts: number } | null>((res) => {
      const req = store.openCursor(null, "prev");
      req.onsuccess = () => res(req.result?.value ?? null);
      req.onerror = () => res(null);
    }),
  ]);

  return {
    groups: [],
    dateRange:
      first && last
        ? {
            oldest: new Date(first.ts).toISOString(),
            newest: new Date(last.ts).toISOString(),
          }
        : undefined,
    groupUnit: "records",
  };
}

/**
 * Per-symbol counts using a simple (non-compound) `symbol` index.
 * Works for monitor_openings, timestamp_openings.
 */
async function simpleSymbolGroups(
  db: IDBDatabase,
  storeName: string,
  indexName: string,
): Promise<StoreDetails> {
  const tx = db.transaction(storeName, "readonly");
  const index = tx.objectStore(storeName).index(indexName);

  // Collect unique symbol values via nextunique cursor
  const symbols: string[] = [];
  await new Promise<void>((resolve) => {
    const req = index.openKeyCursor(null, "nextunique");
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        symbols.push(String(cursor.key));
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => resolve();
  });

  // Count per symbol
  const groups: StoreDetailGroup[] = [];
  for (const sym of symbols) {
    const cTx = db.transaction(storeName, "readonly");
    const count = await txPromise(
      cTx.objectStore(storeName).index(indexName).count(sym),
    );
    groups.push({ key: sym, count });
  }

  return {
    groups: groups.sort((a, b) => b.count - a.count),
    groupUnit: "records",
  };
}

/**
 * Per-symbol counts using a compound index whose first element is `symbol`.
 * Works for options_opening_meta (symbolCaptured), options_opening_expiry_metrics (symbolDte).
 */
async function compoundSymbolGroups(
  db: IDBDatabase,
  storeName: string,
  indexName: string,
): Promise<StoreDetails> {
  const tx = db.transaction(storeName, "readonly");
  const index = tx.objectStore(storeName).index(indexName);

  // Jump between symbol boundaries: cursor at [sym, X] → continue to [sym, []]
  // Since Array > all other types in IDB ordering, [sym, []] sorts after [sym, anyValue].
  const symbols: string[] = [];
  await new Promise<void>((resolve) => {
    const req = index.openKeyCursor();
    let lastSym: string | null = null;
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      const sym = String((cursor.key as unknown[])[0]);
      if (sym !== lastSym) {
        symbols.push(sym);
        lastSym = sym;
      }
      cursor.continue([sym, []]);
    };
    req.onerror = () => resolve();
  });

  // Count per symbol using range [sym] .. [sym, []]
  const groups: StoreDetailGroup[] = [];
  for (const sym of symbols) {
    const cTx = db.transaction(storeName, "readonly");
    const range = IDBKeyRange.bound([sym], [sym, []]);
    const count = await txPromise(
      cTx.objectStore(storeName).index(indexName).count(range),
    );
    groups.push({ key: sym, count });
  }

  return {
    groups: groups.sort((a, b) => b.count - a.count),
    groupUnit: "records",
  };
}

/**
 * Per-symbol counts for child stores (strike_legs, strike_aggregates, feature_labels)
 * that only have an `openingId` index. Derives symbol mapping from the snapshot store.
 */
async function derivedSymbolGroups(
  db: IDBDatabase,
  childStoreName: string,
): Promise<StoreDetails> {
  const metaTx = db.transaction(STORES.SNAPSHOTS, "readonly");
  const metaRecords = await txPromise<{ openingId: string; symbol: string }[]>(
    metaTx.objectStore(STORES.SNAPSHOTS).getAll(),
  );

  const symbolOpenings = new Map<string, string[]>();
  for (const r of metaRecords) {
    const list = symbolOpenings.get(r.symbol) ?? [];
    list.push(r.openingId);
    symbolOpenings.set(r.symbol, list);
  }

  // Step 2: count child records per symbol by summing counts per openingId
  const groups: StoreDetailGroup[] = [];
  for (const [symbol, openingIds] of symbolOpenings) {
    const tx = db.transaction(childStoreName, "readonly");
    const index = tx.objectStore(childStoreName).index("openingId");
    const counts = await Promise.all(
      openingIds.map((id) => txPromise(index.count(id))),
    );
    groups.push({ key: symbol, count: counts.reduce((a, b) => a + b, 0) });
  }

  return {
    groups: groups.sort((a, b) => b.count - a.count),
    groupUnit: "records",
  };
}

/** Load per-store drill-down details on demand. */
export async function collectStoreDetails(
  storeName: string,
): Promise<StoreDetails | null> {
  const db = await openAlexQuantDB();

  try {
    switch (storeName) {
      case STORES.KV:
        return kvDetails(db);
      case STORES.ACCOUNT_SNAPSHOT_HISTORY:
        return accountHistoryDetails(db, STORES.ACCOUNT_SNAPSHOT_HISTORY);
      case STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE:
        return accountHistoryDetails(
          db,
          STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE,
        );
      case STORES.MONITOR_OPENINGS:
        return simpleSymbolGroups(db, STORES.MONITOR_OPENINGS, "symbol");
      case STORES.TIMESTAMP_OPENINGS:
        return simpleSymbolGroups(db, STORES.TIMESTAMP_OPENINGS, "symbol");
      case STORES.SNAPSHOTS:
        return compoundSymbolGroups(db, STORES.SNAPSHOTS, "symbolCaptured");
      case STORES.STRIKE_LEGS:
      case STORES.STRIKE_AGGREGATES:
      case STORES.FEATURE_LABELS:
        return derivedSymbolGroups(db, storeName);
      default:
        return null;
    }
  } catch {
    return null;
  }
}
