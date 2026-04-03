import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { MonitorCaptureStore } from "backend/core/db/capture/MonitorCaptureStore";
import type { OptionCapture } from "backend/core/db/capture/optionMonitorTypes";

/** Load all OptionCapture snapshots for a symbol (for historical percentile ranking). */
export async function loadMonitorHistory(
  symbol: string,
): Promise<OptionCapture[]> {
  const db = await openAlexQuantDB();
  const store = new MonitorCaptureStore(db);
  return store.getBySymbol(symbol);
}

/** Load OptionCapture history for multiple symbols in parallel (one DB connection). */
export async function loadMultiSymbolHistory(
  symbols: string[],
): Promise<Map<string, OptionCapture[]>> {
  const db = await openAlexQuantDB();
  const store = new MonitorCaptureStore(db);
  const results = new Map<string, OptionCapture[]>();
  const promises = symbols.map(async (sym) => {
    const history = await store.getBySymbol(sym);
    results.set(sym, history);
  });
  await Promise.all(promises);
  return results;
}
