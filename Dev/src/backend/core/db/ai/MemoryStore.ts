import { STORES } from "../core/AlexQuantDB";
import { txPromise, txComplete } from "../core/idbUtils";
import type { AIAnalysisRecord, MemoryEntry } from "backend/services/ai/types";

export class MemoryStore {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async save(entry: MemoryEntry): Promise<void> {
    const tx = this.db.transaction(STORES.AI_MEMORIES, "readwrite");
    tx.objectStore(STORES.AI_MEMORIES).put(entry);
    await txComplete(tx);
  }

  async getRecentForSymbol(symbol: string, limit = 5): Promise<MemoryEntry[]> {
    const tx = this.db.transaction(STORES.AI_MEMORIES, "readonly");
    const index = tx.objectStore(STORES.AI_MEMORIES).index("symbol");
    const entries = await txPromise<MemoryEntry[]>(index.getAll(symbol));
    return entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  }

  /** Persist a memory entry derived from a completed analysis record */
  async saveFromRecord(record: AIAnalysisRecord): Promise<void> {
    if (record.status !== "completed" || !record.finalDecision) return;
    const entry: MemoryEntry = {
      id: record.id,
      symbol: record.symbol,
      date: record.completedAt ?? record.requestedAt,
      action: record.finalDecision.action,
      conviction: record.finalDecision.conviction,
      summary: record.finalDecision.summary,
      keyBullPoints: record.finalDecision.keyBullPoints,
      keyBearPoints: record.finalDecision.keyBearPoints,
      priceAtAnalysis: record.marketData?.currentPrice ?? null,
    };
    await this.save(entry);
  }

  async clearForSymbol(symbol: string): Promise<void> {
    const tx = this.db.transaction(STORES.AI_MEMORIES, "readwrite");
    const store = tx.objectStore(STORES.AI_MEMORIES);
    const index = store.index("symbol");
    const keys = await txPromise<IDBValidKey[]>(index.getAllKeys(symbol));
    for (const key of keys) store.delete(key);
    await txComplete(tx);
  }

  async clearAll(): Promise<void> {
    const tx = this.db.transaction(STORES.AI_MEMORIES, "readwrite");
    tx.objectStore(STORES.AI_MEMORIES).clear();
    await txComplete(tx);
  }
}
