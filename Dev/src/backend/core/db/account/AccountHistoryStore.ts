import { STORES } from "../core/AlexQuantDB";
import { txPromise, txComplete } from "../core/idbUtils";
import type { AccountHistoryPoint } from "./accountHistoryTypes";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");

export class AccountHistoryStore {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async getAll(): Promise<AccountHistoryPoint[]> {
    const tx = this.db.transaction(STORES.ACCOUNT_SNAPSHOT_HISTORY, "readonly");
    return txPromise(tx.objectStore(STORES.ACCOUNT_SNAPSHOT_HISTORY).getAll());
  }

  async getRange(
    startTs: number,
    endTs: number,
  ): Promise<AccountHistoryPoint[]> {
    const tx = this.db.transaction(STORES.ACCOUNT_SNAPSHOT_HISTORY, "readonly");
    const range = IDBKeyRange.bound(startTs, endTs);
    return txPromise(
      tx.objectStore(STORES.ACCOUNT_SNAPSHOT_HISTORY).getAll(range),
    );
  }

  async put(point: AccountHistoryPoint): Promise<void> {
    const tx = this.db.transaction(
      STORES.ACCOUNT_SNAPSHOT_HISTORY,
      "readwrite",
    );
    tx.objectStore(STORES.ACCOUNT_SNAPSHOT_HISTORY).put(point);
    await txComplete(tx);
    log.debug("accountHistory.put", { ts: point.ts });
  }

  async putBatch(points: AccountHistoryPoint[]): Promise<void> {
    if (points.length === 0) return;
    const tx = this.db.transaction(
      STORES.ACCOUNT_SNAPSHOT_HISTORY,
      "readwrite",
    );
    const store = tx.objectStore(STORES.ACCOUNT_SNAPSHOT_HISTORY);
    for (const point of points) store.put(point);
    await txComplete(tx);
    log.debug("accountHistory.putBatch", { count: points.length });
  }

  async deleteOlderThan(cutoffTs: number): Promise<number> {
    const tx = this.db.transaction(
      STORES.ACCOUNT_SNAPSHOT_HISTORY,
      "readwrite",
    );
    const store = tx.objectStore(STORES.ACCOUNT_SNAPSHOT_HISTORY);
    const range = IDBKeyRange.upperBound(cutoffTs, true);
    const keys = await txPromise<IDBValidKey[]>(store.getAllKeys(range));
    for (const key of keys) store.delete(key);
    await txComplete(tx);
    log.debug("accountHistory.deleteOlderThan", {
      cutoffTs,
      deletedCount: keys.length,
    });
    return keys.length;
  }

  async count(): Promise<number> {
    const tx = this.db.transaction(STORES.ACCOUNT_SNAPSHOT_HISTORY, "readonly");
    return txPromise(tx.objectStore(STORES.ACCOUNT_SNAPSHOT_HISTORY).count());
  }
}
