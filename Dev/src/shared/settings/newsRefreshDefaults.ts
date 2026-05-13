export type NewsRefreshIntervals = {
  yahooMacroMs: number;
  yahooSymbolMs: number;
  barronsMs: number;
  financialJuiceRssMs: number;
  schwabMs: number;
};

export const DEFAULT_NEWS_REFRESH_INTERVALS: NewsRefreshIntervals = {
  yahooMacroMs: 120_000,
  yahooSymbolMs: 120_000,
  barronsMs: 180_000,
  financialJuiceRssMs: 45_000,
  schwabMs: 120_000,
};

/**
 * Cold-start grace period before the news service kicks the first fetch
 * (and starts polling + attaches the FJ streamer). The cached feed is
 * already on screen at this point — the delay lets login, auth, and other
 * critical init work finish before we burn bandwidth on news polls. Single
 * value governs every news source.
 */
export const DEFAULT_NEWS_INITIAL_FETCH_DELAY_MS = 5_000;
