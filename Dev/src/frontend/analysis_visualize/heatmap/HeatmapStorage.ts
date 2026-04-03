import { openAlexQuantDB } from "../../../backend/core/db/core/AlexQuantDB";
import { KVStore } from "../../../backend/core/db/core/KVStore";

const KV_ROW_TICKERS_KEY = "ui.crossAssetMatrixRowTickers";
const KV_COL_TICKERS_KEY = "ui.crossAssetMatrixColTickers";

export async function loadStoredAxes(
  defaultSymbols: string[],
): Promise<{ rows: string[]; cols: string[] }> {
  const db = await openAlexQuantDB();
  const kv = new KVStore(db);

  const rows = await kv.get<string[]>(KV_ROW_TICKERS_KEY);
  const cols = await kv.get<string[]>(KV_COL_TICKERS_KEY);

  return {
    rows: rows && rows.length > 0 ? rows : [...defaultSymbols],
    cols: cols && cols.length > 0 ? cols : [...defaultSymbols],
  };
}

export function saveStoredAxes(
  rowTickers: string[],
  colTickers: string[],
): void {
  openAlexQuantDB()
    .then((db) => {
      const kv = new KVStore(db);
      return Promise.all([
        kv.set(KV_ROW_TICKERS_KEY, rowTickers),
        kv.set(KV_COL_TICKERS_KEY, colTickers),
      ]);
    })
    .catch(() => {
      /* noop */
    });
}
