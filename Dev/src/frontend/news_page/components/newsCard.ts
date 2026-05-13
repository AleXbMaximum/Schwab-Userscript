import { ui_createElement } from "../../components/core/builders/createElement";
import { DS_COLORS } from "../../components/core/styles/theme";
import { getNewsItemSymbols } from "../../../backend/services/news/types";
import type {
  UnifiedNewsItem,
  NewsSourceType,
} from "../../../backend/services/news/types";
import { formatTimeAgo } from "shared/utils/time";
import { sourceColor } from "../shared/newsConstants";

// ── Density tokens ─────────────────────────────────────────────────────────
//
// One card renderer for both the news page (full) and the snapshot panel
// (compact). Density controls padding, font sizing and how title / summary
// overflow; the rest (badges, hover, click) stays identical so any future
// fix lands in one place.

export type NewsCardDensity = "full" | "compact";

/** How a multi-line text region collapses when its content is too long. */
type Overflow =
  | { kind: "wrap" }
  | { kind: "clamp"; lines: number }
  | { kind: "slice"; max: number };

type DensityTokens = {
  padding: string;
  gap: string;
  radius: string;
  titleFontSize: string;
  titleWeightNormal: string;
  titleOverflow: Overflow;
  summaryFontSize: string;
  summaryOverflow: Overflow;
  metaFontSize: string;
  urlArrowFontSize: string;
  headlineBorderWidth: string;
};

const DENSITY: Record<NewsCardDensity, DensityTokens> = {
  full: {
    padding: "11px 14px",
    gap: "6px",
    radius: "var(--ax-radius-lg)",
    titleFontSize: "13px",
    titleWeightNormal: "600",
    titleOverflow: { kind: "wrap" },
    summaryFontSize: "11px",
    summaryOverflow: { kind: "slice", max: 160 },
    metaFontSize: "11px",
    urlArrowFontSize: "13px",
    headlineBorderWidth: "3px",
  },
  compact: {
    padding: "6px 10px",
    gap: "4px",
    radius: "var(--ax-radius-md)",
    titleFontSize: "12px",
    titleWeightNormal: "500",
    titleOverflow: { kind: "clamp", lines: 2 },
    summaryFontSize: "11px",
    summaryOverflow: { kind: "clamp", lines: 2 },
    metaFontSize: "10px",
    urlArrowFontSize: "11px",
    headlineBorderWidth: "2px",
  },
};

// ── Colors ────────────────────────────────────────────────────────────────
//
// Headline tint stays hardcoded (not bound to a CSS var) so the alpha layer
// composites identically on both light and dark themes.

const HEADLINE_BG = "rgba(215, 129, 0, 0.04)";
const HEADLINE_BG_HOVER = "rgba(215, 129, 0, 0.08)";
const DEFAULT_BG = "var(--ax-glass-2-bg)";
const DEFAULT_BG_HOVER = "var(--ax-bg-card)";

// ── Overflow helpers ──────────────────────────────────────────────────────

function overflowCss(overflow: Overflow): string {
  if (overflow.kind !== "clamp") return "";
  return (
    " display: -webkit-box; -webkit-box-orient: vertical;" +
    ` -webkit-line-clamp: ${overflow.lines}; overflow: hidden;`
  );
}

function applyOverflowText(text: string, overflow: Overflow): string {
  if (overflow.kind !== "slice") return text;
  const preview = text.slice(0, overflow.max);
  return preview.length < text.length ? preview + "..." : preview;
}

// ── Badges ────────────────────────────────────────────────────────────────
//
// All news pills share the same geometry — only color / weight /
// letter-spacing change. Centralizing keeps shape adjustments to one edit.

type PillStyle = {
  text: string;
  bg: string;
  color: string;
  fontSize: string;
  fontWeight: string;
  padding?: string;
  radius?: string;
  letterSpacing?: string;
};

function pillBadge(p: PillStyle): HTMLElement {
  return ui_createElement("span", {
    text: p.text,
    styleString:
      `font-size: ${p.fontSize}; font-weight: ${p.fontWeight};` +
      ` padding: ${p.padding ?? "1px 6px"};` +
      ` border-radius: ${p.radius ?? "4px"};` +
      ` background: ${p.bg}; color: ${p.color}; white-space: nowrap;` +
      (p.letterSpacing ? ` letter-spacing: ${p.letterSpacing};` : ""),
  });
}

function sourceBadge(sourceType: NewsSourceType, source: string): HTMLElement {
  const c = sourceColor(sourceType);
  return pillBadge({
    text: source,
    bg: c.bg,
    color: c.text,
    fontSize: "10px",
    fontWeight: "600",
  });
}

function newBadge(): HTMLElement {
  return pillBadge({
    text: "NEW",
    bg: DS_COLORS.bgNegative,
    color: DS_COLORS.raw.negative,
    fontSize: "9px",
    fontWeight: "700",
    padding: "1px 5px",
    letterSpacing: "0.3px",
  });
}

function headlineBadge(): HTMLElement {
  return pillBadge({
    text: "HEADLINE",
    bg: DS_COLORS.bgNeutral,
    color: DS_COLORS.raw.neutral,
    fontSize: "9px",
    fontWeight: "700",
    padding: "1px 5px",
    letterSpacing: "0.3px",
  });
}

function tagBadge(tag: string): HTMLElement {
  return pillBadge({
    text: tag,
    bg: "rgba(0, 122, 255, 0.08)",
    color: "#007AFF",
    fontSize: "9px",
    fontWeight: "600",
    padding: "1px 5px",
  });
}

function symbolBadge(symbol: string): HTMLElement {
  return pillBadge({
    text: symbol,
    bg: "var(--ax-bg-glass-inset)",
    color: "var(--ax-fg-2)",
    fontSize: "var(--ax-fs-xs)",
    fontWeight: "var(--ax-fw-semibold)",
    padding: "1px 5px",
    radius: "var(--ax-radius-xs)",
  });
}

// ── News Card ─────────────────────────────────────────────────────────────

export function renderNewsCard(
  item: UnifiedNewsItem & { tags?: string[] },
  options?: {
    onMarkRead?: (id: string) => void;
    density?: NewsCardDensity;
  },
): HTMLElement {
  const t = DENSITY[options?.density ?? "full"];
  const bg = item.isHeadline
    ? { idle: HEADLINE_BG, hover: HEADLINE_BG_HOVER }
    : { idle: DEFAULT_BG, hover: DEFAULT_BG_HOVER };
  const headlineRail = item.isHeadline
    ? ` border-left: ${t.headlineBorderWidth} solid ${DS_COLORS.raw.neutral};`
    : "";

  const card = ui_createElement("div", {
    styleString:
      `border: 1px solid var(--ax-border); border-radius: ${t.radius};` +
      ` padding: ${t.padding}; background: ${bg.idle};` +
      ` display: flex; flex-direction: column; gap: ${t.gap};` +
      " transition: background 0.15s;" +
      headlineRail +
      (item.url ? " cursor: pointer;" : ""),
  });

  if (item.url) {
    card.addEventListener("mouseenter", () => {
      card.style.background = bg.hover;
    });
    card.addEventListener("mouseleave", () => {
      card.style.background = bg.idle;
    });
    card.addEventListener("click", () => window.open(item.url, "_blank"));
  }

  // ── Title row ───────────────────────────────────────────────────────────
  const titleRow = ui_createElement("div", {
    styleString: "display: flex; align-items: flex-start; gap: 6px;",
  });
  const titleWeight = item.isHeadline ? "800" : t.titleWeightNormal;
  const titleColor = item.isHeadline
    ? DS_COLORS.negative
    : "var(--ios-text-primary)";
  titleRow.appendChild(
    ui_createElement("span", {
      text: item.title,
      styleString:
        `font-size: ${t.titleFontSize}; font-weight: ${titleWeight};` +
        ` color: ${titleColor}; flex: 1; min-width: 0; line-height: 1.4;` +
        overflowCss(t.titleOverflow),
    }),
  );
  let newBadgeEl: HTMLElement | null = null;
  if (item.isNew) {
    newBadgeEl = newBadge();
    titleRow.appendChild(newBadgeEl);
  }
  if (item.url) {
    titleRow.appendChild(
      ui_createElement("span", {
        text: "↗",
        styleString:
          `font-size: ${t.urlArrowFontSize}; color: var(--ios-blue);` +
          " flex-shrink: 0; margin-top: 1px;",
      }),
    );
  }
  card.appendChild(titleRow);

  // Hover-to-mark-read. Kept as a separate `once: true` listener so the
  // bg-hover handler keeps firing on subsequent hovers after the item is
  // marked read.
  if (item.isNew && options?.onMarkRead) {
    const onRead = options.onMarkRead;
    card.addEventListener(
      "mouseenter",
      () => {
        if (newBadgeEl) {
          newBadgeEl.remove();
          newBadgeEl = null;
        }
        item.isNew = false;
        onRead(item.id);
      },
      { once: true },
    );
  }

  // ── Meta row ────────────────────────────────────────────────────────────
  const metaRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 6px; flex-wrap: wrap;",
  });
  metaRow.appendChild(sourceBadge(item.sourceType, item.source));
  if (item.isHeadline) metaRow.appendChild(headlineBadge());
  metaRow.appendChild(
    ui_createElement("span", {
      text: formatTimeAgo(item.publishedAt),
      styleString: `font-size: ${t.metaFontSize}; color: var(--ios-text-secondary);`,
    }),
  );
  for (const symbol of getNewsItemSymbols(item)) {
    metaRow.appendChild(symbolBadge(symbol));
  }
  for (const tag of item.tags ?? []) {
    metaRow.appendChild(tagBadge(tag));
  }
  card.appendChild(metaRow);

  // ── Summary ─────────────────────────────────────────────────────────────
  if (item.summary && item.summary !== item.title) {
    card.appendChild(
      ui_createElement("div", {
        text: applyOverflowText(item.summary, t.summaryOverflow),
        styleString:
          `font-size: ${t.summaryFontSize}; color: var(--ios-text-secondary);` +
          " line-height: 1.4;" +
          overflowCss(t.summaryOverflow),
      }),
    );
  }

  return card;
}
