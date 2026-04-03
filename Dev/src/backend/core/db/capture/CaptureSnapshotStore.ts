import { STORES } from "../core/AlexQuantDB";
import { txPromise, txComplete } from "../core/idbUtils";
import type {
  OptionCaptureSnapshotRow,
  OptionCaptureMetaRow,
  OptionCaptureExpiryMetricsRow,
  EmbeddedExpiryMetrics,
} from "./optionMonitorTypes";
import { normalizeMarketTimeCT } from "shared/utils/time";

function normalizeSnapshot(row: OptionCaptureSnapshotRow): OptionCaptureSnapshotRow {
  if (!row) return row;
  row.marketTimeCt = normalizeMarketTimeCT(row.marketTimeCt);
  return row;
}

/** Extract the meta-only fields from a snapshot row. */
export function snapshotToMetaRow(snap: OptionCaptureSnapshotRow): OptionCaptureMetaRow {
  return {
    openingId: snap.openingId,
    symbol: snap.symbol,
    capturedAtUtc: snap.capturedAtUtc,
    marketTimeCt: snap.marketTimeCt,
    dataTimestamp: snap.dataTimestamp,
    underlyingPrice: snap.underlyingPrice,
    interestRate: snap.interestRate,
    dividendYield: snap.dividendYield,
    contractMultiplier: snap.contractMultiplier,
    expirationsCount: snap.expirationsCount,
    isDelayed: snap.isDelayed,
  };
}

/** Expand embedded expiry metrics back into standalone rows. */
export function snapshotToExpiryRows(
  snap: OptionCaptureSnapshotRow,
): OptionCaptureExpiryMetricsRow[] {
  return (snap.expiryMetrics ?? []).map((em) => ({
    openingId: snap.openingId,
    symbol: snap.symbol,
    ...em,
  }));
}

/** Merge meta and expiry rows into the persisted snapshot shape. */
export function buildSnapshotRow(
  meta: OptionCaptureMetaRow,
  expiryRows: OptionCaptureExpiryMetricsRow[],
): OptionCaptureSnapshotRow {
  const embedded: EmbeddedExpiryMetrics[] = expiryRows.map((r) => {
    const { openingId: _oid, symbol: _sym, ...rest } = r;
    return rest;
  });
  return {
    openingId: meta.openingId,
    symbol: meta.symbol,
    capturedAtUtc: meta.capturedAtUtc,
    marketTimeCt: meta.marketTimeCt,
    dataTimestamp: meta.dataTimestamp,
    underlyingPrice: meta.underlyingPrice,
    interestRate: meta.interestRate,
    dividendYield: meta.dividendYield,
    contractMultiplier: meta.contractMultiplier,
    expirationsCount: meta.expirationsCount,
    isDelayed: meta.isDelayed,
    expiryMetrics: embedded,
  };
}

export class CaptureSnapshotStore {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async put(row: OptionCaptureSnapshotRow): Promise<void> {
    const tx = this.db.transaction(STORES.SNAPSHOTS, "readwrite");
    tx.objectStore(STORES.SNAPSHOTS).put(row);
    await txComplete(tx);
  }

  async get(openingId: string): Promise<OptionCaptureSnapshotRow | undefined> {
    const tx = this.db.transaction(STORES.SNAPSHOTS, "readonly");
    const row = await txPromise(
      tx.objectStore(STORES.SNAPSHOTS).get(openingId),
    );
    return row ? normalizeSnapshot(row) : undefined;
  }

  async findByDataTimestamp(
    symbol: string,
    dataTimestamp: string,
  ): Promise<OptionCaptureSnapshotRow | undefined> {
    const tx = this.db.transaction(STORES.SNAPSHOTS, "readonly");
    const index = tx.objectStore(STORES.SNAPSHOTS).index("symbolDataTs");
    const row = await txPromise(index.get([symbol, dataTimestamp]));
    return row ? normalizeSnapshot(row) : undefined;
  }

  async getBySymbol(symbol: string): Promise<OptionCaptureSnapshotRow[]> {
    const tx = this.db.transaction(STORES.SNAPSHOTS, "readonly");
    const index = tx.objectStore(STORES.SNAPSHOTS).index("symbolCaptured");
    const range = IDBKeyRange.bound([symbol, ""], [symbol, "\uffff"]);
    const rows = await txPromise(index.getAll(range));
    return rows.map(normalizeSnapshot);
  }

  async getBySymbolAndDatePrefix(
    symbol: string,
    datePrefix: string,
  ): Promise<OptionCaptureSnapshotRow[]> {
    const rows = await this.getBySymbol(symbol);
    return rows.filter((r) => r.capturedAtUtc.startsWith(datePrefix));
  }

  async findNearestBefore(
    symbol: string,
    targetMs: number,
    toleranceMs: number,
  ): Promise<OptionCaptureSnapshotRow | null> {
    const rows = await this.getBySymbol(symbol);
    let best: OptionCaptureSnapshotRow | null = null;
    let bestDiff = Infinity;
    for (const row of rows) {
      const rowMs = new Date(row.capturedAtUtc).getTime();
      const diff = targetMs - rowMs;
      if (diff >= 0 && diff <= toleranceMs && diff < bestDiff) {
        bestDiff = diff;
        best = row;
      }
    }
    return best;
  }

  async delete(openingId: string): Promise<void> {
    const tx = this.db.transaction(STORES.SNAPSHOTS, "readwrite");
    tx.objectStore(STORES.SNAPSHOTS).delete(openingId);
    await txComplete(tx);
  }
}
