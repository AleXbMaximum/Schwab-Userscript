import { STORES } from "../core/AlexQuantDB";
import { txPromise, txComplete } from "../core/idbUtils";
import type { AccountHistoryPoint } from "./accountHistoryTypes";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");

export class AccountHistoryArchiveStore {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async getAll(): Promise<AccountHistoryPoint[]> {
    const tx = this.db.transaction(
      STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE,
      "readonly",
    );
    return txPromise(
      tx.objectStore(STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE).getAll(),
    );
  }

  async getRange(
    startTs: number,
    endTs: number,
  ): Promise<AccountHistoryPoint[]> {
    const tx = this.db.transaction(
      STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE,
      "readonly",
    );
    const range = IDBKeyRange.bound(startTs, endTs);
    return txPromise(
      tx.objectStore(STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE).getAll(range),
    );
  }

  async count(): Promise<number> {
    const tx = this.db.transaction(
      STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE,
      "readonly",
    );
    return txPromise(
      tx.objectStore(STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE).count(),
    );
  }

  async putBatch(points: AccountHistoryPoint[]): Promise<void> {
    if (points.length === 0) return;
    const tx = this.db.transaction(
      STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE,
      "readwrite",
    );
    const store = tx.objectStore(STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE);
    for (const point of points) store.put(point);
    await txComplete(tx);
    log.debug("accountHistoryArchive.putBatch", { count: points.length });
  }
}
