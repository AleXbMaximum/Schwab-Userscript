import type { UnifiedNewsItem } from "./types";
import {
  getNewsItemSymbols,
  normalizeNewsSymbolTags,
  toEpochMs,
} from "./types";

// ── Cross-source similarity dedup ───────────────────────────────────────────
//
// When two outlets publish the same story (FJ aggregator + Yahoo wire, or
// Reuters + Barron's syndication, etc.) we want exactly one card on screen.
// Per-id dedup catches identical hashes; this layer catches near-identical
// titles whose ids differ because each source generates its own hash.

/** Jaccard threshold above which two titles are treated as the same story. */
const SIMILARITY_THRESHOLD = 0.75;

/**
 * How many previously-kept items to compare each new item against. Bounded
 * so cross-source dedup stays O(N · W) instead of O(N²) on large feeds.
 * 80 covers ~30–60 min of typical news flow.
 */
const DEDUP_WINDOW_SIZE = 80;

/** Below this token count Jaccard is too noisy — skip dedup entirely. */
const MIN_TOKENS_FOR_DEDUP = 3;

// Common English stopwords that drag Jaccard towards false positives on
// short headlines ("X says Y" vs "A says B" → both share "says").
const TITLE_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to", "for",
  "with", "from", "by", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "should",
  "could", "may", "might", "must", "can", "shall", "this", "that", "these",
  "those", "it", "its", "as", "if", "than", "then", "so", "too", "very",
  "just", "also", "into", "out", "about", "after", "before", "again",
  "more", "most", "some", "such", "not", "no", "said", "says", "say",
  "over", "up", "down", "off", "amid", "via",
]);

function tokenizeTitle(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)) {
    if (raw.length < 3) continue;
    if (TITLE_STOPWORDS.has(raw)) continue;
    out.add(raw);
  }
  return out;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  // Iterate the smaller set for the intersection scan.
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const t of small) if (big.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Drop later items whose title closely matches an earlier kept item.
 *
 * "Later" is determined by `publishedAt`: items sort ascending, so for any
 * pair the earlier-published wins and the later one is filtered out
 * wholesale (no metadata merge — that's an explicit request from the user).
 *
 * Comparison is title-only because summaries are noisy (CSS bleed-through,
 * length variance) and titles are the densest single-shot signal for
 * "same story". Tokens are lowercased, stopword-filtered, length ≥ 3 to
 * avoid common-word false positives.
 */
export function dedupSimilarNewsItems<T extends UnifiedNewsItem>(
  items: T[],
): T[] {
  if (items.length <= 1) return items.slice();

  const sorted = [...items].sort(
    (a, b) => toEpochMs(a.publishedAt) - toEpochMs(b.publishedAt),
  );
  const kept: T[] = [];
  const window: Set<string>[] = [];

  for (const item of sorted) {
    const tokens = tokenizeTitle(item.title);
    let duplicate = false;
    if (tokens.size >= MIN_TOKENS_FOR_DEDUP) {
      for (const seen of window) {
        if (jaccardSimilarity(tokens, seen) >= SIMILARITY_THRESHOLD) {
          duplicate = true;
          break;
        }
      }
    }
    if (duplicate) continue;
    kept.push(item);
    window.push(tokens);
    if (window.length > DEDUP_WINDOW_SIZE) window.shift();
  }

  return kept;
}

/** Compare two string arrays element-by-element. */
export function areSymbolsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Strict deep-equal on the UnifiedNewsItem fields that the UI actually shows. */
export function areItemsEqual(
  a: UnifiedNewsItem[],
  b: UnifiedNewsItem[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
    if (a[i].publishedAt !== b[i].publishedAt) return false;
    if (a[i].title !== b[i].title) return false;
    if (a[i].summary !== b[i].summary) return false;
    if (a[i].source !== b[i].source) return false;
    if (a[i].sourceType !== b[i].sourceType) return false;
    if ((a[i].provider ?? null) !== (b[i].provider ?? null)) return false;
    if (a[i].symbol !== b[i].symbol) return false;
    if (!areSymbolTagsEqual(a[i], b[i])) return false;
    if ((a[i].url ?? null) !== (b[i].url ?? null)) return false;
    if (!!a[i].isHeadline !== !!b[i].isHeadline) return false;
  }
  return true;
}

function areSymbolTagsEqual(a: UnifiedNewsItem, b: UnifiedNewsItem): boolean {
  const aSymbols = getNewsItemSymbols(a);
  const bSymbols = getNewsItemSymbols(b);
  if (aSymbols.length !== bSymbols.length) return false;
  for (let i = 0; i < aSymbols.length; i++) {
    if (aSymbols[i] !== bSymbols[i]) return false;
  }
  return true;
}

export function areSymbolArraysEqual(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

/** Re-normalize symbol tags so a stored item exposes a deduped, sorted list. */
export function normalizeNewsItemSymbols(
  item: UnifiedNewsItem,
): UnifiedNewsItem {
  const symbolTags = normalizeNewsSymbolTags(item.symbolTags, item.symbol);
  const primary = symbolTags[0] ?? null;
  if (
    item.symbol === primary &&
    areSymbolArraysEqual(item.symbolTags, symbolTags)
  ) {
    return item;
  }
  return {
    ...item,
    symbol: primary,
    symbolTags,
  };
}

/** Merge two duplicates into one canonical item. The newer publishedAt wins. */
export function mergeDuplicateNewsItems(
  existing: UnifiedNewsItem,
  incoming: UnifiedNewsItem,
): UnifiedNewsItem {
  const mergedSymbols = normalizeNewsSymbolTags([
    ...getNewsItemSymbols(existing),
    ...getNewsItemSymbols(incoming),
  ]);

  const existingTs = toEpochMs(existing.publishedAt);
  const incomingTs = toEpochMs(incoming.publishedAt);
  const primary = incomingTs > existingTs ? incoming : existing;
  const secondary = primary === existing ? incoming : existing;

  return {
    ...primary,
    summary: primary.summary || secondary.summary,
    url: primary.url ?? secondary.url,
    symbol: mergedSymbols[0] ?? null,
    symbolTags: mergedSymbols,
    isHeadline: !!primary.isHeadline || !!secondary.isHeadline,
  };
}

/**
 * Normalize an inbound symbol-list to a stable, deduped, sorted array.
 * Stable ordering avoids needless refresh churn from upstream order changes.
 */
export function normalizeSymbols(symbols: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of symbols) {
    const normalized = normalizeSymbol(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** Coerce a raw user-typed symbol string into a canonical ticker. */
export function normalizeSymbol(raw: string): string | null {
  const base = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!base) return null;

  // Option display symbols often look like "NVDA 03/20/2026 155.00 P".
  let candidate = base.split(/\s+/)[0] ?? "";

  // OCC compact options: AAPL250117C00225000 -> AAPL
  const occMatch = candidate.match(/^([A-Z]{1,6})\d{6}[CP]\d{8}$/);
  if (occMatch) candidate = occMatch[1];

  candidate = candidate.replace(/\//g, ".").replace(/[^A-Z0-9.$-]/g, "");

  if (!candidate || candidate.startsWith("$")) return null;
  if (!/^[A-Z0-9][A-Z0-9.-]{0,9}$/.test(candidate)) return null;
  return candidate;
}
