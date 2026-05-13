import type { UnifiedNewsItem } from "./types";
import { generateNewsId } from "./types";
import type { NewsItem } from "shared/types/marketData";
import type { BarronsNewsStory } from "../../core/network/barrons/types";
import {
  fetchYahooNews,
  fetchYahooGlobalMacroNews,
} from "../../core/network/yahoo/news";
import { fetchBarronsNewsOnly } from "../../core/network/barrons/BarronsFetcher";
import { gmGetWithHeaders } from "../../core/network/yahoo/httpUtils";
import {
  fetchSchwabNewsHeadlines,
  type SchwabNewsHeadline,
} from "../../core/network/schwab/endpoints/news";
import { detectFjProvider } from "../../core/network/financialJuice/providerDetect";

// ── Yahoo: per-symbol news ──────────────────────────────────────────────────

export async function fetchYahooSymbolNews(
  symbol: string,
): Promise<UnifiedNewsItem[]> {
  const items = await fetchYahooNews(symbol);
  return items.map(mapYahoo(symbol));
}

// ── Yahoo: global macro news ────────────────────────────────────────────────

export async function fetchYahooMacroNews(): Promise<UnifiedNewsItem[]> {
  const items = await fetchYahooGlobalMacroNews();
  return items.map(mapYahoo(null));
}

function mapYahoo(symbol: string | null) {
  return (n: NewsItem): UnifiedNewsItem => {
    const provider = pickProvider(n.source, "Yahoo", ["Yahoo Finance"]);
    return {
      id: generateNewsId(n.title, n.source),
      title: n.title,
      summary: n.summary,
      publishedAt: n.publishedAt,
      source: "Yahoo",
      sourceType: "yahoo",
      ...(provider ? { provider } : {}),
      url: n.url,
      symbol,
      symbolTags: symbol ? [symbol] : [],
    };
  };
}

/**
 * Return the underlying publisher name to surface as a secondary badge,
 * or undefined when it would just duplicate the primary aggregator badge.
 */
function pickProvider(
  raw: string | null | undefined,
  primary: string,
  aliases: string[] = [],
): string | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;
  if (value === primary) return undefined;
  for (const alias of aliases) if (value === alias) return undefined;
  return value;
}

// ── Barron's: per-symbol news (all 3 channels) ─────────────────────────────

export async function fetchBarronsAllNews(
  symbol: string,
): Promise<UnifiedNewsItem[]> {
  const news = await fetchBarronsNewsOnly(symbol);

  const out: UnifiedNewsItem[] = [];
  for (const story of news.barrons) {
    const m = mapBarrons(story, "barrons", symbol);
    if (m) out.push(m);
  }
  for (const story of news.dowJones) {
    const m = mapBarrons(story, "dowjones", symbol);
    if (m) out.push(m);
  }
  for (const story of news.press) {
    const m = mapBarrons(story, "press", symbol);
    if (m) out.push(m);
  }
  return out;
}

function mapBarrons(
  s: BarronsNewsStory,
  sourceType: "barrons" | "dowjones" | "press",
  symbol: string,
): UnifiedNewsItem | null {
  // Require a parseable timestamp. An empty `timestampValue`/`timestamp` would
  // surface as "Invalid Date" in the UI and break newest-first ordering.
  const raw = s.timestampValue || s.timestamp;
  if (!raw) return null;
  const parsedMs = new Date(raw).getTime();
  if (!Number.isFinite(parsedMs)) return null;
  const provider = pickProvider(s.provider, "Barron's");
  return {
    id: generateNewsId(s.headline, s.provider || sourceType),
    title: s.headline,
    summary: s.summary,
    publishedAt: new Date(parsedMs).toISOString(),
    source: "Barron's",
    sourceType,
    ...(provider ? { provider } : {}),
    url: s.url,
    symbol,
    symbolTags: [symbol],
  };
}

// ── FinancialJuice: global macro news via RSS ──────────────────────────────

const FJ_FEED_URL = "https://www.financialjuice.com/feed.ashx?xy=rss";

// Reuse a single DOMParser instance across all parse calls.
// DOMParser is stateless and safe to reuse — avoids ~100 constructor calls
// per FinancialJuice refresh.
const sharedDOMParser = new DOMParser();

// Reuse a textarea element for fast HTML entity decoding.
// Setting innerHTML on a textarea decodes entities via the browser's native
// parser without triggering script execution or layout.
const entityDecoderTextarea = document.createElement("textarea");

function decodeHtmlEntities(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    entityDecoderTextarea.innerHTML = text;
    return entityDecoderTextarea.value;
  } catch {
    return text;
  }
}

export function htmlToPlainText(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) return "";

  // Strip <style> / <script> blocks before any further processing — DOMParser
  // preserves their textContent, which surfaces raw CSS / JS in the summary
  // (e.g. FXStreet embeds `.fxs-faq-module-wrapper{...}` inside FJ items).
  const stripped = text
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const withBreaks = stripped
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n");

  let plain: string;
  try {
    const doc = sharedDOMParser.parseFromString(withBreaks, "text/html");
    plain = doc.body.textContent ?? "";
  } catch {
    plain = withBreaks.replace(/<[^>]+>/g, " ");
  }

  // Defensive: some upstream feeds (or proxies) hand us pre-flattened text
  // where the <style> wrapper was stripped but the CSS rule bodies remain
  // verbatim (e.g. ".fxs-faq-module-wrapper{border:1px solid #ddd;...}").
  // The selector portion `[^{}<\n]*?` is permissive enough to cover real
  // FXStreet rules — descendant / child / pseudo / attribute / multi-
  // selector forms — that a narrower pattern misses. Iterate until stable
  // so nested @media wrappers also collapse after their inner rules go.
  let cssStripped = plain;
  let previous: string;
  do {
    previous = cssStripped;
    cssStripped = cssStripped.replace(/[.#@][^{}<\n]*?\{[^{}]*\}/g, "");
  } while (cssStripped !== previous);

  return cssStripped
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeFinancialJuiceSymbol(
  raw: string | null | undefined,
): string | null {
  const base = String(raw ?? "").trim();
  if (!base) return null;

  let value = base.toUpperCase();
  if (value.includes(":")) value = value.split(":").pop() ?? value;
  if (value.includes("/")) value = value.replace(/\//g, ".");
  if (value.startsWith("$")) value = value.slice(1);
  value = value.split(/\s+/)[0] ?? "";
  value = value.replace(/[^A-Z0-9.!$-]/g, "");
  if (!value) return null;
  if (!/^[A-Z0-9][A-Z0-9.!$-]{0,14}$/.test(value)) return null;
  return value;
}

function extractUSTreasurySymbol(text: string): string | null {
  const source = String(text ?? "");
  const yearPatterns = [
    /\bUS\s+(\d{1,2})\s*-\s*Year\b/i,
    /\bTreasury\s+(\d{1,2})\s*-\s*Year\b/i,
    /\b(\d{1,2})\s*-\s*Year\s+(?:Note|Bond)\b/i,
  ];

  for (const pattern of yearPatterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const year = Number.parseInt(match[1], 10);
    if (!Number.isFinite(year) || year <= 0 || year > 50) continue;
    return `US${String(year).padStart(2, "0")}Y`;
  }
  return null;
}

function extractSymbolsFromUrl(
  link: string | undefined,
  push: (value: string) => void,
): void {
  if (!link) return;
  try {
    const url = new URL(link);
    const keys = ["symbol", "symbols", "ticker", "tickers", "tvwidgetsymbol"];
    for (const key of keys) {
      const raw = url.searchParams.get(key);
      if (!raw) continue;
      for (const part of raw.split(/[,\s]+/)) {
        const normalized = normalizeFinancialJuiceSymbol(part);
        if (normalized) push(normalized);
      }
    }
  } catch {
    // Ignore malformed links.
  }
}

function extractFinancialJuiceSymbolTags(
  title: string,
  rawDescription: string,
  link?: string,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined): void => {
    const normalized = normalizeFinancialJuiceSymbol(raw);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  const decodedDescription = decodeHtmlEntities(rawDescription);
  const combined = `${title}\n${decodedDescription}`;

  // 1) TradingView embed scripts often contain `"symbol":"TVC:US07Y"`.
  for (const match of decodedDescription.matchAll(
    /["']symbol["']\s*:\s*["']([^"']+)["']/gi,
  )) {
    push(match[1]);
  }

  // 2) Pull explicit ticker-like hints from URL query params.
  extractSymbolsFromUrl(link, push);

  // 3) Extract explicit dollar-prefixed tickers from text.
  for (const match of combined.matchAll(/\$([A-Z][A-Z0-9.-]{0,12})\b/g)) {
    push(match[1]);
  }

  // 4) Macro fallback for Treasury auction/yield items.
  const usTreasury = extractUSTreasurySymbol(combined);
  if (usTreasury) push(usTreasury);

  return out;
}

// ── Schwab: global headlines ────────────────────────────────────────────────

export async function fetchSchwabNews(): Promise<UnifiedNewsItem[]> {
  try {
    const items = await fetchSchwabNewsHeadlines(null, { limit: 25 });
    const out: UnifiedNewsItem[] = [];
    for (const raw of items) {
      if (!raw.date) continue;
      const parsedMs = new Date(raw.date).getTime();
      if (!Number.isFinite(parsedMs)) continue;
      out.push(mapSchwabHeadline(raw, parsedMs));
    }
    return out;
  } catch {
    return [];
  }
}

function mapSchwabHeadline(
  n: SchwabNewsHeadline,
  parsedMs: number,
): UnifiedNewsItem {
  const provider = pickProvider(n.source, "Schwab");
  return {
    id: generateNewsId(n.headline, "schwab"),
    title: n.headline,
    summary: String(n.teaser ?? ""),
    publishedAt: new Date(parsedMs).toISOString(),
    source: "Schwab",
    sourceType: "schwab",
    ...(provider ? { provider } : {}),
    url: undefined,
    symbol: null,
    symbolTags: [],
  };
}

// ── FinancialJuice: global macro news via RSS ──────────────────────────────

export async function fetchFinancialJuiceNews(): Promise<UnifiedNewsItem[]> {
  try {
    const xml = await gmGetWithHeaders(
      FJ_FEED_URL,
      { Accept: "application/xml, text/xml, */*" },
      15_000,
    );

    const doc = sharedDOMParser.parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) return [];

    const items: UnifiedNewsItem[] = [];
    for (const entry of doc.querySelectorAll("item")) {
      const rawTitle = entry.querySelector("title")?.textContent?.trim() ?? "";
      const title = rawTitle.replace(/^FinancialJuice:\s*/i, "");
      if (!title) continue;

      const link =
        entry.querySelector("link")?.textContent?.trim() || undefined;
      const pubDate = entry.querySelector("pubDate")?.textContent?.trim() ?? "";
      if (!pubDate) continue;
      const pubDateMs = new Date(pubDate).getTime();
      if (!Number.isFinite(pubDateMs)) continue;
      const rawDesc =
        entry.querySelector("description")?.textContent?.trim() ?? "";
      const isHeadline = /<script\b/i.test(rawDesc);
      const descriptionHtml = rawDesc
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .trim();
      const description = htmlToPlainText(descriptionHtml);
      const symbolTags = extractFinancialJuiceSymbolTags(title, rawDesc, link);
      const provider = detectFjProvider({
        url: link,
        descriptionHtml: rawDesc,
        title,
      });

      items.push({
        id: generateNewsId(title, "financialjuice"),
        title,
        summary: description,
        publishedAt: new Date(pubDateMs).toISOString(),
        source: "FJ",
        sourceType: "financialjuice",
        ...(provider && provider !== "FJ" && provider !== "FinancialJuice"
          ? { provider }
          : {}),
        url: link,
        symbol: symbolTags[0] ?? null,
        symbolTags,
        ...(isHeadline && { isHeadline: true }),
      });
    }

    return items;
  } catch {
    return [];
  }
}
