// Heuristic provider attribution for FinancialJuice items.
//
// FJ aggregates squawks from many real publishers (Reuters, FXStreet,
// ForexLive, ZeroHedge …) but the RSS / WS payloads don't always label
// the provider explicitly. We extract it from whatever surface gives us
// the strongest signal:
//   1. The story link's domain (most reliable — `/news/reuters/...`)
//   2. CSS class fingerprints in the description HTML (`fxs-*` => FXStreet)
//   3. Inline mentions of provider domains in description / title
//
// Returns `undefined` when no provider can be identified; callers fall
// back to "FinancialJuice".

type DetectInput = {
  url?: string;
  descriptionHtml?: string;
  title?: string;
};

// Domain → display name. Match either the host itself or a subdomain.
const DOMAIN_PROVIDERS: Array<readonly [RegExp, string]> = [
  [/(?:^|\.)fxstreet\.com$/i, "FXStreet"],
  [/(?:^|\.)forexlive\.com$/i, "ForexLive"],
  [/(?:^|\.)reuters\.com$/i, "Reuters"],
  [/(?:^|\.)ft\.com$/i, "FT"],
  [/(?:^|\.)bloomberg\.com$/i, "Bloomberg"],
  [/(?:^|\.)cnbc\.com$/i, "CNBC"],
  [/(?:^|\.)investing\.com$/i, "Investing.com"],
  [/(?:^|\.)marketwatch\.com$/i, "MarketWatch"],
  [/(?:^|\.)wsj\.com$/i, "WSJ"],
  [/(?:^|\.)tradingeconomics\.com$/i, "Trading Economics"],
  [/(?:^|\.)dailyfx\.com$/i, "DailyFX"],
  [/(?:^|\.)businessinsider\.com$/i, "Business Insider"],
  [/(?:^|\.)zerohedge\.com$/i, "ZeroHedge"],
  [/(?:^|\.)nasdaq\.com$/i, "Nasdaq"],
  [/(?:^|\.)seekingalpha\.com$/i, "Seeking Alpha"],
  [/(?:^|\.)benzinga\.com$/i, "Benzinga"],
  [/(?:^|\.)kitco\.com$/i, "Kitco"],
  [/(?:^|\.)mining\.com$/i, "Mining.com"],
  // NOTE: do NOT match `financialjuice.com` here. FJ's WS payloads carry
  // EURL pointing at their own article page (e.g. www.financialjuice.com/
  // News/<id>/...), which would otherwise short-circuit the lookup before
  // we ever consult `FCName` / content fingerprints. The caller defaults
  // to "FinancialJuice" when nothing matches.
];

// Content-fingerprint patterns when the URL doesn't pin a provider.
// These match either CSS class prefixes embedded by the publisher's
// widget, brand-specific markup, or distinctive boilerplate.
const CONTENT_FINGERPRINTS: Array<readonly [RegExp, string]> = [
  [/\bfxs-[a-z-]+\b/i, "FXStreet"],
  [/tradingview-widget-container/i, "TradingView"],
  [/data-tv-widget/i, "TradingView"],
  [/forexlive\.com/i, "ForexLive"],
  [/zerohedge\.com/i, "ZeroHedge"],
  [/dailyfx\.com/i, "DailyFX"],
  [/seekingalpha\.com/i, "Seeking Alpha"],
];

// Final fallback: in-text attribution like "Bloomberg reported today" /
// "according to Reuters". Strict enough to avoid catching incidental
// mentions ("Reuters covered the Bloomberg event" — we'd still pick the
// first match, which is usually the source the story is built on).
const ATTRIBUTION_PUBLISHERS: Array<readonly [RegExp, string]> = [
  [/\bBloomberg\b/i, "Bloomberg"],
  [/\bReuters\b/i, "Reuters"],
  [/\bFinancial Times\b|\bthe FT\b/i, "FT"],
  [/\bWall Street Journal\b|\bWSJ\b/i, "WSJ"],
  [/\bCNBC\b/i, "CNBC"],
  [/\bMarketWatch\b/i, "MarketWatch"],
  [/\bDow Jones\b/i, "Dow Jones"],
  [/\bAssociated Press\b|\bAP News\b/i, "Associated Press"],
  [/\bAFP\b/i, "AFP"],
  [/\bXinhua\b/i, "Xinhua"],
  [/\bNikkei\b/i, "Nikkei"],
  [/\bSouth China Morning Post\b|\bSCMP\b/i, "South China Morning Post"],
  [/\bFXStreet\b/i, "FXStreet"],
  [/\bForexLive\b/i, "ForexLive"],
  [/\bZeroHedge\b/i, "ZeroHedge"],
];

const ATTRIBUTION_VERBS =
  "(?:reported|reports|reporting|said|says|saying|noted|notes|writes|wrote|cited|cites|according to)";

export function detectFjProvider(input: DetectInput): string | undefined {
  const url = input.url?.trim() ?? "";
  if (url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      for (const [pattern, name] of DOMAIN_PROVIDERS) {
        if (pattern.test(host)) return name;
      }
    } catch {
      // ignore malformed url
    }
  }
  const haystack = `${input.descriptionHtml ?? ""}\n${input.title ?? ""}`;
  for (const [pattern, name] of CONTENT_FINGERPRINTS) {
    if (pattern.test(haystack)) return name;
  }
  // In-text attribution — only count it when the publisher's name appears
  // adjacent to a reporting verb so we don't misattribute incidental
  // mentions ("the Bloomberg event covered by Reuters …").
  for (const [namePattern, name] of ATTRIBUTION_PUBLISHERS) {
    const matched = matchAttribution(haystack, namePattern);
    if (matched) return name;
  }
  return undefined;
}

function matchAttribution(haystack: string, namePattern: RegExp): boolean {
  const src = namePattern.source;
  const combined = new RegExp(
    `(?:${src})\\s+${ATTRIBUTION_VERBS}|${ATTRIBUTION_VERBS}\\s+(?:by\\s+)?(?:${src})`,
    "i",
  );
  return combined.test(haystack);
}
