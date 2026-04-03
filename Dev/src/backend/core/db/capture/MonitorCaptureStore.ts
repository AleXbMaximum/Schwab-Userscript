import { STORES } from "../core/AlexQuantDB";
import { txPromise, txComplete } from "../core/idbUtils";
import type { OptionCapture } from "./optionMonitorTypes";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");

export class MonitorCaptureStore {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async getBySymbol(symbol: string): Promise<OptionCapture[]> {
    const tx = this.db.transaction(STORES.MONITOR_OPENINGS, "readonly");
    const index = tx.objectStore(STORES.MONITOR_OPENINGS).index("symbol");
    return txPromise(index.getAll(symbol));
  }

  async put(capture: OptionCapture): Promise<void> {
    const tx = this.db.transaction(STORES.MONITOR_OPENINGS, "readwrite");
    tx.objectStore(STORES.MONITOR_OPENINGS).put(capture);
    await txComplete(tx);
    log.debug("monitorCaptures.put", { symbol: capture.symbol });
  }

  async putBatch(captures: OptionCapture[]): Promise<void> {
    if (captures.length === 0) return;
    const tx = this.db.transaction(STORES.MONITOR_OPENINGS, "readwrite");
    const store = tx.objectStore(STORES.MONITOR_OPENINGS);
    for (const capture of captures) store.put(capture);
    await txComplete(tx);
    log.debug("monitorCaptures.putBatch", { count: captures.length });
  }

  async deleteBySymbol(symbol: string): Promise<void> {
    const tx = this.db.transaction(STORES.MONITOR_OPENINGS, "readwrite");
    const store = tx.objectStore(STORES.MONITOR_OPENINGS);
    const index = store.index("symbol");
    const keys = await txPromise<IDBValidKey[]>(index.getAllKeys(symbol));
    for (const key of keys) store.delete(key);
    await txComplete(tx);
    log.debug("monitorCaptures.deleteBySymbol", {
      symbol,
      deletedCount: keys.length,
    });
  }

  async replaceSymbol(
    symbol: string,
    captures: OptionCapture[],
  ): Promise<void> {
    const tx = this.db.transaction(STORES.MONITOR_OPENINGS, "readwrite");
    const store = tx.objectStore(STORES.MONITOR_OPENINGS);
    const index = store.index("symbol");
    const existingKeys = await txPromise<IDBValidKey[]>(
      index.getAllKeys(symbol),
    );
    for (const key of existingKeys) store.delete(key);
    for (const capture of captures) store.put(capture);
    await txComplete(tx);
    log.debug("monitorCaptures.replaceSymbol", {
      symbol,
      removed: existingKeys.length,
      added: captures.length,
    });
  }

  async countBySymbol(symbol: string): Promise<number> {
    const tx = this.db.transaction(STORES.MONITOR_OPENINGS, "readonly");
    const index = tx.objectStore(STORES.MONITOR_OPENINGS).index("symbol");
    return txPromise(index.count(symbol));
  }
}
