import { STORES } from "../core/AlexQuantDB";
import { readTx, txPromise, writeTx } from "../core/idbUtils";
import type { AIAnalysisRecord } from "backend/services/ai/types";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");
const STORE = STORES.AI_ANALYSES;

export class AIAnalysisStore {
  constructor(private db: IDBDatabase) {}

  async save(record: AIAnalysisRecord): Promise<void> {
    await writeTx(this.db, STORE, (s) => {
      s.put(record);
    });
    log.debug("aiAnalysis.save", { symbol: record.symbol });
  }

  async getLatestForSymbol(symbol: string): Promise<AIAnalysisRecord | null> {
    const records = await this.getAllForSymbol(symbol);
    return records[0] ?? null;
  }

  async getAllForSymbol(symbol: string): Promise<AIAnalysisRecord[]> {
    const records = await readTx<AIAnalysisRecord[]>(this.db, STORE, (s) =>
      s.index("symbol").getAll(symbol),
    );
    return records.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  async deleteAnalysis(symbol: string, id: string): Promise<void> {
    await writeTx(this.db, STORE, (s) => {
      s.delete([symbol, id]);
    });
    log.debug("aiAnalysis.delete", { symbol, id });
  }

  async clearAllForSymbol(symbol: string): Promise<void> {
    let count = 0;
    await writeTx(this.db, STORE, async (s) => {
      const keys = await txPromise<IDBValidKey[]>(
        s.index("symbol").getAllKeys(symbol),
      );
      count = keys.length;
      for (const key of keys) s.delete(key);
    });
    log.debug("aiAnalysis.clearAll", { symbol, count });
  }
}
