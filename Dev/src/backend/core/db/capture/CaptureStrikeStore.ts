import { STORES } from "../core/AlexQuantDB";
import { txPromise, txComplete } from "../core/idbUtils";
import type { OptionCaptureStrikeLegRow } from "./optionMonitorTypes";

export class CaptureStrikeStore {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async putBatch(rows: OptionCaptureStrikeLegRow[]): Promise<void> {
    if (rows.length === 0) return;
    const tx = this.db.transaction(STORES.STRIKE_LEGS, "readwrite");
    const store = tx.objectStore(STORES.STRIKE_LEGS);
    for (const row of rows) store.put(row);
    await txComplete(tx);
  }

  async getByOpeningId(openingId: string): Promise<OptionCaptureStrikeLegRow[]> {
    const tx = this.db.transaction(STORES.STRIKE_LEGS, "readonly");
    const index = tx.objectStore(STORES.STRIKE_LEGS).index("openingId");
    return txPromise(index.getAll(openingId));
  }

  async deleteByOpeningId(openingId: string): Promise<void> {
    const rows = await this.getByOpeningId(openingId);
    if (rows.length === 0) return;
    const tx = this.db.transaction(STORES.STRIKE_LEGS, "readwrite");
    const store = tx.objectStore(STORES.STRIKE_LEGS);
    for (const row of rows) {
      store.delete([
        row.openingId,
        row.expiryLabel,
        row.strike,
        row.optionType,
      ]);
    }
    await txComplete(tx);
  }
}
