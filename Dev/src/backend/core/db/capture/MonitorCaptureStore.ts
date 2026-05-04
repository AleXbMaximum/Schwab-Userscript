import { STORES } from "../core/AlexQuantDB";
import { readTx, txPromise, writeTx } from "../core/idbUtils";
import type { OptionCapture } from "./optionMonitorTypes";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");
const STORE = STORES.MONITOR_OPENINGS;

export class MonitorCaptureStore {
  constructor(private db: IDBDatabase) {}

  async getBySymbol(symbol: string): Promise<OptionCapture[]> {
    return readTx(this.db, STORE, (s) => s.index("symbol").getAll(symbol));
  }

  async put(capture: OptionCapture): Promise<void> {
    await writeTx(this.db, STORE, (s) => {
      s.put(capture);
    });
    log.debug("monitorCaptures.put", { symbol: capture.symbol });
  }

  async putBatch(captures: OptionCapture[]): Promise<void> {
    if (captures.length === 0) return;
    await writeTx(this.db, STORE, (s) => {
      for (const capture of captures) s.put(capture);
    });
    log.debug("monitorCaptures.putBatch", { count: captures.length });
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
    log.debug("monitorCaptures.deleteBySymbol", {
      symbol,
      deletedCount: count,
    });
  }

  async replaceSymbol(
    symbol: string,
    captures: OptionCapture[],
  ): Promise<void> {
    let removed = 0;
    await writeTx(this.db, STORE, async (s) => {
      const keys = await txPromise<IDBValidKey[]>(
        s.index("symbol").getAllKeys(symbol),
      );
      removed = keys.length;
      for (const key of keys) s.delete(key);
      for (const capture of captures) s.put(capture);
    });
    log.debug("monitorCaptures.replaceSymbol", {
      symbol,
      removed,
      added: captures.length,
    });
  }

  async countBySymbol(symbol: string): Promise<number> {
    return readTx(this.db, STORE, (s) => s.index("symbol").count(symbol));
  }
}
