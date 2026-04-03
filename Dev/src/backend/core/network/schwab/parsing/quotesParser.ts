// Normalize quote percent fields and derived IDs before the shared deep number pass.
import type{ QuoteItem, QuotesResponse, RegularQuote } from "shared/types/holdings";
import { normalizeNumbersDeepInPlace } from "shared/utils/numberNormalizer";
import { toFiniteNumberOrNull } from "./numberParsers";

function parseSerPdfIdFromDockey(dockey: string): number | null {
  const parts = dockey.split("-");
  if (parts.length < 2) return null;
  const n = Number(parts[1]);
  return Number.isFinite(n) ? n : null;
}

function extractSerPdfId(serPdf: unknown): number | null {
  if (typeof serPdf !== "string" || !serPdf) return null;

  try {
    const u = new URL(serPdf);
    const dockey = u.searchParams.get("Dockey");
    if (dockey) {
      const id = parseSerPdfIdFromDockey(dockey);
      if (id != null) return id;
    }
  } catch {}

  const match = /Dockey=([^&]+)/.exec(serPdf);
  if (match?.[1]) {
    const id = parseSerPdfIdFromDockey(match[1]);
    if (id != null) return id;
  }

  return null;
}

export function parseQuotesResponse(payload: unknown): QuotesResponse {
  const resp: any = payload && typeof payload === "object" ? payload : {};

  const rawQuotes = Array.isArray(resp.quotes) ? resp.quotes : [];
  const quotes: QuoteItem[] = [];

  for (const item of rawQuotes) {
    const reference = item?.reference;
    const quote = item?.quote;
    const regularQuote = item?.regularQuote as RegularQuote | undefined;
    const marketType = item?.marketType;

    const serPdfId = extractSerPdfId(item?.fundamental?.serPdf);

    if (!reference || typeof reference !== "object") continue;
    if (!quote || typeof quote !== "object") continue;

    const pct = toFiniteNumberOrNull((quote as any).netChangePercent);
    if (pct != null) {
      (quote as any).netChangePercent = pct / 100;
    }

    const pmPct = toFiniteNumberOrNull((quote as any).postMarketPercentChange);
    if (pmPct != null) {
      (quote as any).postMarketPercentChange = pmPct / 100;
    }

    if (regularQuote && typeof regularQuote === "object") {
      const rPct = toFiniteNumberOrNull((regularQuote as any).percentChange);
      if (rPct != null) {
        (regularQuote as any).percentChange = rPct / 100;
      }
    }

    quotes.push({
      reference,
      quote,
      regularQuote,
      marketType: typeof marketType === "string" ? marketType : undefined,
      serPdfId,
    } as QuoteItem);
  }

  const out: QuotesResponse = { quotes };

  normalizeNumbersDeepInPlace(out as any, 6);

  return out;
}
