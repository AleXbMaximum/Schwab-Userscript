import { openAlexQuantDB } from "../../../backend/core/db/core/AlexQuantDB";
import { TimestampCaptureStore } from "../../../backend/core/db/capture/TimestampCaptureStore";
import type { TimestampSavedView } from "./savedViewTypes";

export async function readTimestampSavedViews(
  symbol: string,
): Promise<TimestampSavedView[]> {
  if (!symbol) return [];
  try {
    const db = await openAlexQuantDB();
    const store = new TimestampCaptureStore(db);
    const records = await store.getBySymbol(symbol.trim().toUpperCase());
    const views = records.filter(
      (item) =>
        item &&
        item.version === 1 &&
        typeof item.symbol === "string" &&
        item.response &&
        Array.isArray(item.response.expirations) &&
        item.view,
    ) as unknown as TimestampSavedView[];
    views.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
    return views;
  } catch {
    return [];
  }
}

export async function writeTimestampSavedViews(
  symbol: string,
  views: TimestampSavedView[],
): Promise<void> {
  const db = await openAlexQuantDB();
  const store = new TimestampCaptureStore(db);
  const limited = views.slice(0, 32).map((o) => ({
    symbol: o.symbol,
    savedAt: o.savedAt,
    version: o.version,
    dataTimestamp: o.dataTimestamp,
    response: o.response,
    view: o.view,
  }));
  await store.replaceSymbol(symbol.trim().toUpperCase(), limited);
}
