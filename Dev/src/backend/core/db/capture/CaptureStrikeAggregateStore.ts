import { STORES } from "../core/AlexQuantDB";
import { txPromise, txComplete } from "../core/idbUtils";
import type { OptionCaptureStrikeAggregateRow } from "./optionMonitorTypes";

export class CaptureStrikeAggregateStore {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async putBatch(rows: OptionCaptureStrikeAggregateRow[]): Promise<void> {
    if (rows.length === 0) return;
    const tx = this.db.transaction(STORES.STRIKE_AGGREGATES, "readwrite");
    const store = tx.objectStore(STORES.STRIKE_AGGREGATES);
    for (const row of rows) store.put(row);
    await txComplete(tx);
  }

  async getByOpeningId(
    openingId: string,
  ): Promise<OptionCaptureStrikeAggregateRow[]> {
    const tx = this.db.transaction(STORES.STRIKE_AGGREGATES, "readonly");
    const index = tx.objectStore(STORES.STRIKE_AGGREGATES).index("openingId");
    return txPromise(index.getAll(openingId));
  }

  async getByOpeningIds(
    ids: string[],
  ): Promise<Map<string, OptionCaptureStrikeAggregateRow[]>> {
    if (ids.length === 0) return new Map();
    const tx = this.db.transaction(STORES.STRIKE_AGGREGATES, "readonly");
    const index = tx.objectStore(STORES.STRIKE_AGGREGATES).index("openingId");
    const results = await Promise.all(
      ids.map((id) => txPromise(index.getAll(id))),
    );
    const map = new Map<string, OptionCaptureStrikeAggregateRow[]>();
    for (let i = 0; i < ids.length; i++) {
      map.set(ids[i], results[i]);
    }
    return map;
  }

  async deleteByOpeningId(openingId: string): Promise<void> {
    const rows = await this.getByOpeningId(openingId);
    if (rows.length === 0) return;
    const tx = this.db.transaction(STORES.STRIKE_AGGREGATES, "readwrite");
    const store = tx.objectStore(STORES.STRIKE_AGGREGATES);
    for (const row of rows) {
      store.delete([row.openingId, row.strike]);
    }
    await txComplete(tx);
  }
}
