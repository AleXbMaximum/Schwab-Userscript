import { STORES } from "../core/AlexQuantDB";
import { txPromise, txComplete } from "../core/idbUtils";
import type { OptionCaptureFeatureLabelRow } from "./optionMonitorTypes";

export class CaptureLabelStore {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async put(row: OptionCaptureFeatureLabelRow): Promise<void> {
    const tx = this.db.transaction(STORES.FEATURE_LABELS, "readwrite");
    tx.objectStore(STORES.FEATURE_LABELS).put(row);
    await txComplete(tx);
  }

  async get(
    openingId: string,
    symbol: string,
  ): Promise<OptionCaptureFeatureLabelRow | undefined> {
    const tx = this.db.transaction(STORES.FEATURE_LABELS, "readonly");
    return txPromise(
      tx.objectStore(STORES.FEATURE_LABELS).get([openingId, symbol]),
    );
  }

  async patchField(
    openingId: string,
    symbol: string,
    field: keyof OptionCaptureFeatureLabelRow,
    value: number | boolean | string | null,
  ): Promise<void> {
    const existing = await this.get(openingId, symbol);
    if (!existing) return;
    (existing as any)[field] = value;
    await this.put(existing);
  }

  async deleteByOpeningId(openingId: string): Promise<void> {
    const tx = this.db.transaction(STORES.FEATURE_LABELS, "readwrite");
    const store = tx.objectStore(STORES.FEATURE_LABELS);
    const index = store.index("openingId");
    const keys = await txPromise<IDBValidKey[]>(index.getAllKeys(openingId));
    for (const key of keys) store.delete(key);
    await txComplete(tx);
  }

  async getOrCreate(
    openingId: string,
    symbol: string,
  ): Promise<OptionCaptureFeatureLabelRow> {
    const existing = await this.get(openingId, symbol);
    if (existing) return existing;
    const row: OptionCaptureFeatureLabelRow = {
      openingId: openingId,
      symbol,
      fwdRet10m: null,
      fwdRet30m: null,
      fwdRet60m: null,
      fwdAbsRet30m: null,
      fwdAbsRet60m: null,
      rv30m: null,
      rv60m: null,
      moveExceedsImplied30m: null,
      sessionSegment: null,
      eventFlag: null,
    };
    await this.put(row);
    return row;
  }
}
