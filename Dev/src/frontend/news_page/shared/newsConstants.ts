import type { NewsSourceType } from "../../../backend/services/news/types";

// ── Source Colors (visual — stays in frontend) ─────────────────────────────
// Saturated brand backgrounds use 0.10 alpha and read on both themes.
// The neutral "press" tag uses the muted tone token so it remains visible
// against the dark canvas (a flat 0.10 gray tint disappears on dark bg).

export const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  yahoo: { bg: "rgba(103, 58, 183, 0.10)", text: "#673AB7" },
  barrons: { bg: "rgba(0, 122, 255, 0.10)", text: "#007AFF" },
  dowjones: { bg: "rgba(0, 150, 136, 0.10)", text: "#009688" },
  press: { bg: "var(--ax-tone-muted-soft-bg)", text: "#8E8E93" },
  financialjuice: { bg: "rgba(230, 81, 0, 0.10)", text: "#E65100" },
  schwab: { bg: "rgba(0, 114, 206, 0.10)", text: "#0072CE" },
};

export function sourceColor(type: NewsSourceType): { bg: string; text: string } {
  return (
    SOURCE_COLORS[type] ?? {
      bg: "var(--ax-tone-muted-soft-bg)",
      text: "var(--ax-fg-2)",
    }
  );
}

// ── Filter pills (shared between NewsToolbar and NewsPanel) ────────────────

export const NEWS_FILTER_PILLS: {
  label: string;
  value: "all" | NewsSourceType;
}[] = [
  { label: "All", value: "all" as const },
  { label: "Yahoo", value: "yahoo" as const },
  { label: "Barron's", value: "barrons" as const },
  { label: "FJ", value: "financialjuice" as const },
  { label: "Schwab", value: "schwab" as const },
];

// ── AI Placeholder ─────────────────────────────────────────────────────────

export const SUMMARY_PLACEHOLDER =
  'Run "Summarize All" or "Summarize New" to generate AI output for the current filter.';
