import { STORES } from "../core/AlexQuantDB";
import { readTx, writeTx } from "../core/idbUtils";
import type { OptionCaptureStrikeLegRow } from "./optionMonitorTypes";

const STORE = STORES.STRIKE_LEGS;

export class CaptureStrikeStore {
  constructor(private db: IDBDatabase) {}

  async putBatch(rows: OptionCaptureStrikeLegRow[]): Promise<void> {
    if (rows.length === 0) return;
    await writeTx(this.db, STORE, (s) => {
      for (const row of rows) s.put(row);
    });
  }

  async getByOpeningId(openingId: string): Promise<OptionCaptureStrikeLegRow[]> {
    return readTx(this.db, STORE, (s) =>
      s.index("openingId").getAll(openingId),
    );
  }

  async deleteByOpeningId(openingId: string): Promise<void> {
    const rows = await this.getByOpeningId(openingId);
    if (rows.length === 0) return;
    await writeTx(this.db, STORE, (s) => {
      for (const row of rows) {
        s.delete([row.openingId, row.expiryLabel, row.strike, row.optionType]);
      }
    });
  }
}
