export type NewsSourceType =
  | "yahoo"
  | "barrons"
  | "dowjones"
  | "press"
  | "financialjuice"
  | "schwab"
  | string;

export type UnifiedNewsItem = {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  source: string;
  sourceType: NewsSourceType;
  url?: string;
  /** null = global / macro news, otherwise the ticker symbol */
  symbol: string | null;
  /** Normalized ticker tags associated with this news item (deduped, uppercase) */
  symbolTags?: string[];
  /** Set at render-time by NewsMemoryStore */
  isNew?: boolean;
  /** Headline / featured news (e.g. FJ items with TradingView charts) */
  isHeadline?: boolean;
  /**
   * Secondary publisher attribution. For FinancialJuice items this carries
   * the underlying outlet (FXStreet / Reuters / OilPrice / Bloomberg …) so
   * the UI can render an FJ + provider badge pair. `source` stays as the
   * aggregator name ("FinancialJuice") and `sourceType` stays as
   * "financialjuice" so filters still group everything together.
   */
  provider?: string;
};

export type StoredNewsRecord = {
  id: string;
  title: string;
  source: string;
  sourceType: NewsSourceType;
  url?: string;
  publishedAt: string;
  firstSeenAt: string;
  symbol: string | null;
  symbolTags?: string[];
};

export interface NewsSourceAdapter {
  readonly sourceType: NewsSourceType;
  fetchNews(symbol?: string): Promise<UnifiedNewsItem[]>;
}

export function generateNewsId(title: string, source: string): string {
  let hash = 0;
  const str = `${title}::${source}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `news_${(hash >>> 0).toString(36)}`;
}

function normalizeSymbolTag(raw: string | null | undefined): string | null {
  const value = String(raw ?? "")
    .trim()
    .toUpperCase();
  return value || null;
}

export function normalizeNewsSymbolTags(
  symbolTags: readonly string[] | null | undefined,
  fallbackSymbol?: string | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string | null | undefined): void => {
    const normalized = normalizeSymbolTag(raw);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  for (const symbol of symbolTags ?? []) {
    push(symbol);
  }
  push(fallbackSymbol);

  return out;
}

export function getNewsItemSymbols(
  item: Pick<UnifiedNewsItem, "symbol" | "symbolTags">,
): string[] {
  return normalizeNewsSymbolTags(item.symbolTags, item.symbol);
}

export function toEpochMs(value: string): number {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

export function sortNewsItemsNewestFirst<T extends UnifiedNewsItem>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) => toEpochMs(b.publishedAt) - toEpochMs(a.publishedAt),
  );
}

export const NEWS_SOURCE_LABELS: Record<string, string> = {
  yahoo: "Yahoo",
  barrons: "Barron's",
  dowjones: "DJ",
  press: "Press",
  financialjuice: "FJ",
  schwab: "Schwab",
};

/**
 * Check whether a news item matches a source-type filter.
 * "barrons" filter includes barrons, dowjones, and press sub-types.
 */
export function matchesNewsSourceFilter(
  item: Pick<UnifiedNewsItem, "sourceType">,
  filter: "all" | NewsSourceType,
): boolean {
  if (filter === "all") return true;
  if (filter === "barrons") {
    return (
      item.sourceType === "barrons" ||
      item.sourceType === "dowjones" ||
      item.sourceType === "press"
    );
  }
  return item.sourceType === filter;
}

export function formatNewsItemsForExport(
  items: UnifiedNewsItem[],
  formatTimeAgo: (dateStr: string) => string,
): string {
  return items
    .map((n) => {
      const symbols = getNewsItemSymbols(n);
      return (
        `${n.title}\n` +
        `Source: ${n.source} (${n.sourceType})` +
        (symbols.length > 0 ? ` | ${symbols.join(", ")}` : "") +
        ` | ${formatTimeAgo(n.publishedAt)}` +
        (n.isNew ? " [NEW]" : "") +
        (n.summary ? `\n${n.summary}` : "")
      );
    })
    .join("\n\n");
}
