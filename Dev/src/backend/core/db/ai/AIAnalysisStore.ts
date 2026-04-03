import { STORES } from "../core/AlexQuantDB";
import { txPromise, txComplete } from "../core/idbUtils";
import type { AIAnalysisRecord } from "backend/services/ai/types";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");

export class AIAnalysisStore {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async save(record: AIAnalysisRecord): Promise<void> {
    const tx = this.db.transaction(STORES.AI_ANALYSES, "readwrite");
    tx.objectStore(STORES.AI_ANALYSES).put(record);
    await txComplete(tx);
    log.debug("aiAnalysis.save", { symbol: record.symbol });
  }

  async getLatestForSymbol(symbol: string): Promise<AIAnalysisRecord | null> {
    const records = await this.getAllForSymbol(symbol);
    return records[0] ?? null;
  }

  async getAllForSymbol(symbol: string): Promise<AIAnalysisRecord[]> {
    const tx = this.db.transaction(STORES.AI_ANALYSES, "readonly");
    const index = tx.objectStore(STORES.AI_ANALYSES).index("symbol");
    const records = await txPromise<AIAnalysisRecord[]>(index.getAll(symbol));
    return records.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  async deleteAnalysis(symbol: string, id: string): Promise<void> {
    const tx = this.db.transaction(STORES.AI_ANALYSES, "readwrite");
    tx.objectStore(STORES.AI_ANALYSES).delete([symbol, id]);
    await txComplete(tx);
    log.debug("aiAnalysis.delete", { symbol, id });
  }

  async clearAllForSymbol(symbol: string): Promise<void> {
    const tx = this.db.transaction(STORES.AI_ANALYSES, "readwrite");
    const store = tx.objectStore(STORES.AI_ANALYSES);
    const index = store.index("symbol");
    const keys = await txPromise<IDBValidKey[]>(index.getAllKeys(symbol));
    for (const key of keys) store.delete(key);
    await txComplete(tx);
    log.debug("aiAnalysis.clearAll", { symbol, count: keys.length });
  }
}
