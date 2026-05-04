import { STORES } from "../core/AlexQuantDB";
import { readTx, txPromise, writeTx } from "../core/idbUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");
const STORE = STORES.TIMESTAMP_OPENINGS;

export interface TimestampCaptureRecord {
  symbol: string;
  savedAt: string;
  version: number;
  dataTimestamp: string;
  response: any;
  view: any;
}

export class TimestampCaptureStore {
  constructor(private db: IDBDatabase) {}

  async getBySymbol(symbol: string): Promise<TimestampCaptureRecord[]> {
    return readTx(this.db, STORE, (s) => s.index("symbol").getAll(symbol));
  }

  async put(record: TimestampCaptureRecord): Promise<void> {
    await writeTx(this.db, STORE, (s) => {
      s.put(record);
    });
    log.debug("timestampCaptures.put", { symbol: record.symbol });
  }

  async replaceSymbol(
    symbol: string,
    records: TimestampCaptureRecord[],
  ): Promise<void> {
    let removed = 0;
    await writeTx(this.db, STORE, async (s) => {
      const keys = await txPromise<IDBValidKey[]>(
        s.index("symbol").getAllKeys(symbol),
      );
      removed = keys.length;
      for (const key of keys) s.delete(key);
      for (const record of records) s.put(record);
    });
    log.debug("timestampCaptures.replaceSymbol", {
      symbol,
      removed,
      added: records.length,
    });
  }

  async deleteBySymbol(symbol: string): Promise<void> {
    let count = 0;
    await writeTx(this.db, STORE, async (s) => {
      const keys = await txPromise<IDBValidKey[]>(
        s.index("symbol").getAllKeys(symbol),
      );
      count = keys.length;
      for (const key of keys) s.delete(key);
    });
    log.debug("timestampCaptures.deleteBySymbol", {
      symbol,
      deletedCount: count,
    });
  }
}
