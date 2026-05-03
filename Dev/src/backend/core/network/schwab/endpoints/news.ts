import { generateUUID } from "shared/utils/data/uuid";
import { throw401, withTokenRefresh } from "../infra/httpUtils";
import { fetchMarkitToken } from "../infra/auth";
import { gmGetWithHeaders } from "../../yahoo/httpUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SchwabNewsHeadline {
  headline: string;
  source: string;
  dateTime: string;
  docKey: string;
  [key: string]: unknown;
}

export interface SchwabNewsSearchResult {
  headline: string;
  source: string;
  dateTime: string;
  docKey: string;
  summary: string;
}

// ── News Headlines (ausgateway — native fetch) ───────────────────────────────

const NEWS_HEADLINES_URL =
  "https://ausgateway.schwab.com/api/is.ResearchExperience/v1/news/headlines";

export function fetchSchwabNewsHeadlines(
  token?: string | null,
  opts?: { limit?: number; start?: number },
): Promise<SchwabNewsHeadline[]> {
  const limit = opts?.limit ?? 25;
  const start = opts?.start ?? 0;
  const span = log.span("fetchSchwabNewsHeadlines", { limit, start });

  const url = `${NEWS_HEADLINES_URL}?newsType=Market&limit=${limit}&start=${start}&language=en-US`;

  const doRequest = async (bearerToken: string): Promise<unknown> => {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + bearerToken,
        correlatorid: generateUUID(),
        "schwab-client-correlid": generateUUID(),
        "schwab-client-appid": "AD00007800",
        "schwab-client-channel": "IO",
        "schwab-resource-version": "1",
        markit: "true",
        origin: "https://client.schwab.com",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
    });

    if (response.status === 401) {
      await throw401(response);
    }

    return response.json() as Promise<unknown>;
  };

  return withTokenRefresh(doRequest, token)
    .then((data: unknown) => {
      const payload = data as { news?: SchwabNewsHeadline[] };
      const items = payload?.news ?? [];
      span.end("ok", { itemCount: items.length }, "debug");
      return items;
    })
    .catch((err) => {
      span.end(
        "error",
        { error: (err as Error)?.message ?? String(err) },
        "error",
      );
      throw err;
    });
}

// ── News Story (wallst.com — GM.xmlHttpRequest) ──────────────────────────────

const NEWS_STORY_URL =
  "https://schwab.wallst.com/tradesource/News/LoadNewsStory";

export async function fetchSchwabNewsStory(docKey: string): Promise<string> {
  const span = log.span("fetchSchwabNewsStory", { docKey });

  try {
    const markitToken = await fetchMarkitToken();
    const url = `${NEWS_STORY_URL}?docKey=${encodeURIComponent(docKey)}&token=${encodeURIComponent(markitToken)}`;
    const html = await gmGetWithHeaders(url, { Accept: "text/html" }, 15_000);
    span.end("ok", { length: html.length }, "debug");
    return html;
  } catch (err) {
    span.end(
      "error",
      { error: (err as Error)?.message ?? String(err) },
      "error",
    );
    throw err;
  }
}

// ── News Search (wallst.com — GM.xmlHttpRequest) ─────────────────────────────

const NEWS_SEARCH_URL =
  "https://schwab.wallst.com/tradesource/News/SearchNewsAdvancedV2";

export async function fetchSchwabNewsSearch(opts?: {
  rows?: number;
  start?: number;
  source?: string;
  keyword?: string;
}): Promise<SchwabNewsSearchResult[]> {
  const rows = opts?.rows ?? 10;
  const start = opts?.start ?? 0;
  const source = opts?.source ?? "All";
  const keyword = opts?.keyword ?? "";
  const span = log.span("fetchSchwabNewsSearch", { rows, start, source });

  try {
    const markitToken = await fetchMarkitToken();
    const params = new URLSearchParams({
      row: String(rows),
      start: String(start),
      source,
      keyword,
      token: markitToken,
    });
    const url = `${NEWS_SEARCH_URL}?${params.toString()}`;
    const html = await gmGetWithHeaders(url, { Accept: "text/html" }, 15_000);
    const results = parseNewsSearchHtml(html);
    span.end("ok", { itemCount: results.length }, "debug");
    return results;
  } catch (err) {
    span.end(
      "error",
      { error: (err as Error)?.message ?? String(err) },
      "error",
    );
    throw err;
  }
}

// ── HTML parsing for News Search ─────────────────────────────────────────────

const sharedDOMParser = new DOMParser();

function parseNewsSearchHtml(html: string): SchwabNewsSearchResult[] {
  const results: SchwabNewsSearchResult[] = [];
  try {
    const doc = sharedDOMParser.parseFromString(html, "text/html");
    const rows = doc.querySelectorAll(".news-item, .newsItem, tr[data-dockey]");

    for (const row of rows) {
      const headline =
        row.querySelector(".headline, .title, a")?.textContent?.trim() ?? "";
      if (!headline) continue;

      const source =
        row.querySelector(".source, .provider")?.textContent?.trim() ?? "";
      const dateTime =
        row.querySelector(".date, .dateTime, time")?.textContent?.trim() ?? "";
      const docKey =
        row.getAttribute("data-dockey") ??
        row.querySelector("a")?.getAttribute("data-dockey") ??
        row.querySelector("a")?.getAttribute("href") ??
        "";
      const summary =
        row.querySelector(".summary, .snippet, .desc")?.textContent?.trim() ??
        "";

      results.push({ headline, source, dateTime, docKey, summary });
    }
  } catch {
    // Fail-soft: return empty on parse error
  }
  return results;
}
