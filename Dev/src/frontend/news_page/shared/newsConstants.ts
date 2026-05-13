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

/**
 * Deterministic hash-based color for a provider name. Same name always
 * yields the same color across renders; different names land on different
 * hues. Fixed saturation/lightness keeps the palette visually coherent
 * with the curated primary-source palette above and readable on the dark
 * canvas. Use this so we don't need a hard-coded list of every outlet FJ /
 * Yahoo / Barron's might surface.
 */
export function providerBadgeColor(name: string): { bg: string; text: string } {
  // djb2-ish — fast, well-distributed enough for short publisher names.
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return {
    bg: `hsla(${hue}, 60%, 50%, 0.12)`,
    text: `hsl(${hue}, 65%, 65%)`,
  };
}

export function sourceColor(type: NewsSourceType): { bg: string; text: string } {
  // Barron's API splits its feed into three sub-channels (`barrons`,
  // `dowjones`, `press`) but UX-wise they're all "Barron's content" —
  // collapse the color so the primary badge looks identical across
  // them. The actual publisher lives on the secondary `provider` badge.
  const normalized =
    type === "dowjones" || type === "press" ? "barrons" : type;
  return (
    SOURCE_COLORS[normalized] ?? {
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
