import type { NewsItem } from "shared/types/marketData";
import { gmGet } from "./httpUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

export async function fetchYahooNews(symbol: string): Promise<NewsItem[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=15&quotesCount=0`;
    const text = await gmGet(url);
    const data = JSON.parse(text) as any;
    const newsArr: any[] = data?.news ?? [];
    const items = newsArr.map((n) => ({
      title: String(n.title ?? ""),
      summary: String(n.summary ?? n.title ?? ""),
      publishedAt: new Date((n.providerPublishTime ?? 0) * 1000).toISOString(),
      source: String(n.publisher ?? "Unknown"),
      url: n.link ?? undefined,
    }));
    log.debug("news.fetch.yahoo", { symbol, itemCount: items.length });
    return items;
  } catch (err) {
    log.warn("news.fetch.yahoo", {
      symbol,
      error: (err as Error)?.message ?? String(err),
    });
    return [];
  }
}

export async function fetchYahooGlobalMacroNews(): Promise<NewsItem[]> {
  const queries = ["%5EGSPC", "market+economy+fed"];
  const results = await Promise.allSettled(
    queries.map((q) =>
      gmGet(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${q}&newsCount=8&quotesCount=0`,
      ),
    ),
  );

  const allNews: NewsItem[] = [];
  const seenTitles = new Set<string>();

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    try {
      const data = JSON.parse(result.value) as any;
      for (const n of (data?.news ?? []) as any[]) {
        if (!seenTitles.has(n.title)) {
          seenTitles.add(n.title);
          allNews.push({
            title: String(n.title ?? ""),
            summary: String(n.summary ?? n.title ?? ""),
            publishedAt: new Date(
              (n.providerPublishTime ?? 0) * 1000,
            ).toISOString(),
            source: String(n.publisher ?? "Unknown"),
            url: n.link ?? undefined,
          });
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  const sorted = allNews
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 12);
  log.debug("news.fetch.yahooMacro", { itemCount: sorted.length });
  return sorted;
}
