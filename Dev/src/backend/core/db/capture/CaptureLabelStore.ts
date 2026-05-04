import { STORES } from "../core/AlexQuantDB";
import { readTx, txPromise, writeTx } from "../core/idbUtils";
import type { OptionCaptureFeatureLabelRow } from "./optionMonitorTypes";

const STORE = STORES.FEATURE_LABELS;

export class CaptureLabelStore {
  constructor(private db: IDBDatabase) {}

  async put(row: OptionCaptureFeatureLabelRow): Promise<void> {
    await writeTx(this.db, STORE, (s) => {
      s.put(row);
    });
  }

  async get(
    openingId: string,
    symbol: string,
  ): Promise<OptionCaptureFeatureLabelRow | undefined> {
    return readTx(this.db, STORE, (s) => s.get([openingId, symbol]));
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
    await writeTx(this.db, STORE, async (s) => {
      const keys = await txPromise<IDBValidKey[]>(
        s.index("openingId").getAllKeys(openingId),
      );
      for (const key of keys) s.delete(key);
    });
  }

  async getOrCreate(
    openingId: string,
    symbol: string,
  ): Promise<OptionCaptureFeatureLabelRow> {
    const existing = await this.get(openingId, symbol);
    if (existing) return existing;
    const row: OptionCaptureFeatureLabelRow = {
      openingId,
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
