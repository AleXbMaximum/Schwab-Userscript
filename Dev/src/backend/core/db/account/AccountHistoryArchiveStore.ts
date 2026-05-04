import { STORES } from "../core/AlexQuantDB";
import { readTx, writeTx } from "../core/idbUtils";
import type { AccountHistoryPoint } from "./accountHistoryTypes";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");
const STORE = STORES.ACCOUNT_SNAPSHOT_HISTORY_ARCHIVE;

export class AccountHistoryArchiveStore {
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

  async count(): Promise<number> {
    return readTx(this.db, STORE, (s) => s.count());
  }

  async putBatch(points: AccountHistoryPoint[]): Promise<void> {
    if (points.length === 0) return;
    await writeTx(this.db, STORE, (s) => {
      for (const point of points) s.put(point);
    });
    log.debug("accountHistoryArchive.putBatch", { count: points.length });
  }
}
