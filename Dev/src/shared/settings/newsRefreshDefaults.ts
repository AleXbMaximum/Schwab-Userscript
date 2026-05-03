export type NewsRefreshIntervals = {
  yahooMacroMs: number;
  yahooSymbolMs: number;
  barronsMs: number;
  financialJuiceMs: number;
  schwabMs: number;
};

export const DEFAULT_NEWS_REFRESH_INTERVALS: NewsRefreshIntervals = {
  yahooMacroMs: 120_000,
  yahooSymbolMs: 120_000,
  barronsMs: 180_000,
  financialJuiceMs: 45_000,
  schwabMs: 120_000,
};
