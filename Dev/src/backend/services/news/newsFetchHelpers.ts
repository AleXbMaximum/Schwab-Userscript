import type { UnifiedNewsItem } from "./types";
import type { NewsFetchSource } from "./NewsService";

const SYMBOL_SCOPED_FETCH_CONCURRENCY = 6;
const MIN_REFRESH_INTERVAL_MS = 1_000;

/** Coerce a raw interval value to a sane positive ms (or 0 to mean off). */
export function normalizeIntervalMs(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  if (n === 0) return 0;
  return Math.max(MIN_REFRESH_INTERVAL_MS, Math.round(n));
}

/** Render a refresh interval for the settings UI ("Off", "30s", "5m", "1.5m"). */
export function formatInterval(ms: number): string {
  if (ms <= 0) return "Off";
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds % 60 === 0) return `${totalSeconds / 60}m`;
  return `${(totalSeconds / 60).toFixed(1)}m`;
}

/**
 * Run `fetcher` against each `symbol` with a small worker pool. Per-symbol
 * failures are swallowed so one bad symbol does not abort the batch.
 */
export async function fetchPerSymbol(
  symbols: readonly string[],
  fetcher: (symbol: string) => Promise<UnifiedNewsItem[]>,
): Promise<UnifiedNewsItem[]> {
  if (symbols.length === 0) return [];

  const merged: UnifiedNewsItem[] = [];
  const workerCount = Math.min(SYMBOL_SCOPED_FETCH_CONCURRENCY, symbols.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < symbols.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const symbol = symbols[currentIndex];
      try {
        const items = await fetcher(symbol);
        merged.push(...items);
      } catch {
        // Fail-soft per symbol: keep processing remaining symbols.
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return merged;
}

/**
 * Decide whether to use the freshly-fetched batch or fall back to the
 * previously-cached `previous` batch on a transient empty pull. Empty pulls
 * for symbol-scoped sources only matter when symbols are non-empty.
 */
export function resolveSourceItems(
  source: NewsFetchSource,
  fetched: UnifiedNewsItem[],
  previous: UnifiedNewsItem[],
  hasSymbols: boolean,
): UnifiedNewsItem[] {
  // Keep previous symbol-scoped batch on transient empty pulls.
  if (
    (source === "yahooSymbol" || source === "barrons") &&
    hasSymbols &&
    fetched.length === 0 &&
    previous.length > 0
  ) {
    return previous;
  }

  // Keep previous global-source batch on transient empty pull.
  if (
    (source === "financialJuice" || source === "schwab") &&
    fetched.length === 0 &&
    previous.length > 0
  ) {
    return previous;
  }
  return fetched;
}
