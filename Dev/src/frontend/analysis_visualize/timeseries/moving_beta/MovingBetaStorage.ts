import { openAlexQuantDB } from "../../../../backend/core/db/core/AlexQuantDB";
import { KVStore } from "../../../../backend/core/db/core/KVStore";

const KV_WATCHLIST_KEY = "ui.movingBetaWatchlist";
const KV_INDICATORS_KEY = "ui.movingBetaIndicators";

export const DEFAULT_INDICATORS = ["$SPX", "$COMPX", "$DJI"];

export async function loadMovingBetaAxes(
  defaultSymbols: string[],
): Promise<{ watchlist: string[]; indicators: string[] }> {
  const db = await openAlexQuantDB();
  const kv = new KVStore(db);

  const watchlist = await kv.get<string[]>(KV_WATCHLIST_KEY);
  const indicators = await kv.get<string[]>(KV_INDICATORS_KEY);

  return {
    watchlist:
      watchlist && watchlist.length > 0 ? watchlist : [...defaultSymbols],
    indicators:
      indicators && indicators.length > 0
        ? indicators
        : [...DEFAULT_INDICATORS],
  };
}

export function saveMovingBetaAxes(
  watchlistTickers: string[],
  indicatorTickers: string[],
): void {
  openAlexQuantDB()
    .then((db) => {
      const kv = new KVStore(db);
      return Promise.all([
        kv.set(KV_WATCHLIST_KEY, watchlistTickers),
        kv.set(KV_INDICATORS_KEY, indicatorTickers),
      ]);
    })
    .catch(() => {
      /* noop */
    });
}
