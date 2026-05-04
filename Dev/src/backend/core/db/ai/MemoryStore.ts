import { STORES } from "../core/AlexQuantDB";
import { readTx, txPromise, writeTx } from "../core/idbUtils";
import type { AIAnalysisRecord, MemoryEntry } from "backend/services/ai/types";

const STORE = STORES.AI_MEMORIES;

export class MemoryStore {
  constructor(private db: IDBDatabase) {}

  async save(entry: MemoryEntry): Promise<void> {
    await writeTx(this.db, STORE, (s) => {
      s.put(entry);
    });
  }

  async getRecentForSymbol(symbol: string, limit = 5): Promise<MemoryEntry[]> {
    const entries = await readTx<MemoryEntry[]>(this.db, STORE, (s) =>
      s.index("symbol").getAll(symbol),
    );
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
    await writeTx(this.db, STORE, async (s) => {
      const keys = await txPromise<IDBValidKey[]>(
        s.index("symbol").getAllKeys(symbol),
      );
      for (const key of keys) s.delete(key);
    });
  }

  async clearAll(): Promise<void> {
    await writeTx(this.db, STORE, (s) => {
      s.clear();
    });
  }
}
