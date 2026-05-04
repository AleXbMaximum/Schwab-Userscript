import { STORES } from "../core/AlexQuantDB";
import { readTx, txPromise, writeTx } from "../core/idbUtils";
import type { OptionCaptureStrikeAggregateRow } from "./optionMonitorTypes";

const STORE = STORES.STRIKE_AGGREGATES;

export class CaptureStrikeAggregateStore {
  constructor(private db: IDBDatabase) {}

  async putBatch(rows: OptionCaptureStrikeAggregateRow[]): Promise<void> {
    if (rows.length === 0) return;
    await writeTx(this.db, STORE, (s) => {
      for (const row of rows) s.put(row);
    });
  }

  async getByOpeningId(
    openingId: string,
  ): Promise<OptionCaptureStrikeAggregateRow[]> {
    return readTx(this.db, STORE, (s) =>
      s.index("openingId").getAll(openingId),
    );
  }

  async getByOpeningIds(
    ids: string[],
  ): Promise<Map<string, OptionCaptureStrikeAggregateRow[]>> {
    if (ids.length === 0) return new Map();
    const tx = this.db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("openingId");
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
    await writeTx(this.db, STORE, (s) => {
      for (const row of rows) s.delete([row.openingId, row.strike]);
    });
  }
}
