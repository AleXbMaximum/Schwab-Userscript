// Index symbols shared across the backend pipeline:
// streamer subscription, quote fetching, and streamer ingestion.
export const INDEX_SYMBOLS_ARRAY: string[] = ["$DJI", "$COMPX", "$SPX", "$RUT"];
export const INDEX_SYMBOLS_SET = new Set<string>(INDEX_SYMBOLS_ARRAY);
