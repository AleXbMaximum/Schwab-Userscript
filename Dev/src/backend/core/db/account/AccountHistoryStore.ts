import { STORES } from "../core/AlexQuantDB";
import { readTx, txPromise, writeTx, writeTxResult } from "../core/idbUtils";
import type { AccountHistoryPoint } from "./accountHistoryTypes";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");
const STORE = STORES.ACCOUNT_SNAPSHOT_HISTORY;

export class AccountHistoryStore {
  constructor(private db: IDBDatabase) {}

  async getAll(): Promise<AccountHistoryPoint[]> {
    return readTx(this.db, STORE, (s) => s.getAll());
  }

  async getRange(
    startTs: number,
    endTs: number,
  ): Promise<AccountHistoryPoint[]> {
    const range = IDBKeyRange.bound(startTs, endTs);
    return readTx(this.db, STORE, (s) => s.getAll(range));
  }

  async put(point: AccountHistoryPoint): Promise<void> {
    await writeTx(this.db, STORE, (s) => {
      s.put(point);
    });
    log.debug("accountHistory.put", { ts: point.ts });
  }

  async putBatch(points: AccountHistoryPoint[]): Promise<void> {
    if (points.length === 0) return;
    await writeTx(this.db, STORE, (s) => {
      for (const point of points) s.put(point);
    });
    log.debug("accountHistory.putBatch", { count: points.length });
  }

  async deleteOlderThan(cutoffTs: number): Promise<number> {
    const deleted = await writeTxResult(this.db, STORE, async (s) => {
      const range = IDBKeyRange.upperBound(cutoffTs, true);
      const keys = await txPromise<IDBValidKey[]>(s.getAllKeys(range));
      for (const key of keys) s.delete(key);
      return keys.length;
    });
    log.debug("accountHistory.deleteOlderThan", {
      cutoffTs,
      deletedCount: deleted,
    });
    return deleted;
  }

  async count(): Promise<number> {
    return readTx(this.db, STORE, (s) => s.count());
  }
}
