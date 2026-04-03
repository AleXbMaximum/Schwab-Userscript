import { STORES } from "../core/AlexQuantDB";
import { txPromise, txComplete } from "../core/idbUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");

export interface TimestampCaptureRecord {
  symbol: string;
  savedAt: string;
  version: number;
  dataTimestamp: string;
  response: any;
  view: any;
}

export class TimestampCaptureStore {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async getBySymbol(symbol: string): Promise<TimestampCaptureRecord[]> {
    const tx = this.db.transaction(STORES.TIMESTAMP_OPENINGS, "readonly");
    const index = tx.objectStore(STORES.TIMESTAMP_OPENINGS).index("symbol");
    return txPromise(index.getAll(symbol));
  }

  async put(record: TimestampCaptureRecord): Promise<void> {
    const tx = this.db.transaction(STORES.TIMESTAMP_OPENINGS, "readwrite");
    tx.objectStore(STORES.TIMESTAMP_OPENINGS).put(record);
    await txComplete(tx);
    log.debug("timestampCaptures.put", { symbol: record.symbol });
  }

  async replaceSymbol(
    symbol: string,
    records: TimestampCaptureRecord[],
  ): Promise<void> {
    const tx = this.db.transaction(STORES.TIMESTAMP_OPENINGS, "readwrite");
    const store = tx.objectStore(STORES.TIMESTAMP_OPENINGS);
    const index = store.index("symbol");
    const existingKeys = await txPromise<IDBValidKey[]>(
      index.getAllKeys(symbol),
    );
    for (const key of existingKeys) store.delete(key);
    for (const record of records) store.put(record);
    await txComplete(tx);
    log.debug("timestampCaptures.replaceSymbol", {
      symbol,
      removed: existingKeys.length,
      added: records.length,
    });
  }

  async deleteBySymbol(symbol: string): Promise<void> {
    const tx = this.db.transaction(STORES.TIMESTAMP_OPENINGS, "readwrite");
    const store = tx.objectStore(STORES.TIMESTAMP_OPENINGS);
    const index = store.index("symbol");
    const keys = await txPromise<IDBValidKey[]>(index.getAllKeys(symbol));
    for (const key of keys) store.delete(key);
    await txComplete(tx);
    log.debug("timestampCaptures.deleteBySymbol", {
      symbol,
      deletedCount: keys.length,
    });
  }
}
