import { ui_createElement } from "../../components/core/builders/createElement";
import { DS_COLORS } from "../../components/core/styles/theme";
import { getNewsItemSymbols } from "../../../backend/services/news/types";
import type {
  UnifiedNewsItem,
  NewsSourceType,
} from "../../../backend/services/news/types";
import { formatTimeAgo } from "shared/utils/time";
import { sourceColor } from "../shared/newsConstants";

// ── Badges ──────────────────────────────────────────────────────────────────

function sourceBadge(sourceType: NewsSourceType, source: string): HTMLElement {
  const c = sourceColor(sourceType);
  return ui_createElement("span", {
    text: source,
    styleString:
      `font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px;` +
      ` background: ${c.bg}; color: ${c.text}; white-space: nowrap;`,
  });
}

function newBadge(): HTMLElement {
  return ui_createElement("span", {
    text: "NEW",
    styleString:
      "font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px;" +
      ` background: ${DS_COLORS.bgNegative}; color: ${DS_COLORS.raw.negative};` +
      " letter-spacing: 0.3px;",
  });
}

function headlineBadge(): HTMLElement {
  return ui_createElement("span", {
    text: "HEADLINE",
    styleString:
      "font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px;" +
      ` background: ${DS_COLORS.bgNeutral}; color: ${DS_COLORS.raw.neutral};` +
      " letter-spacing: 0.3px;",
  });
}

function tagBadge(tag: string): HTMLElement {
  return ui_createElement("span", {
    text: tag,
    styleString:
      "font-size: 9px; font-weight: 600; padding: 1px 5px; border-radius: 4px;" +
      " background: rgba(0, 122, 255, 0.08); color: #007AFF;" +
      " white-space: nowrap;",
  });
}

// ── News Card ───────────────────────────────────────────────────────────────

export function renderNewsCard(
  item: UnifiedNewsItem & { tags?: string[] },
  options?: { onMarkRead?: (id: string) => void },
): HTMLElement {
  const hlBorder = item.isHeadline
    ? ` border-left: 3px solid ${DS_COLORS.raw.neutral};`
    : "";
  const hlBg = item.isHeadline
    ? " background: rgba(215, 129, 0, 0.04);"
    : " background: var(--ax-glass-2-bg);";
  const card = ui_createElement("div", {
    styleString:
      "border: 1px solid var(--ax-border); border-radius: var(--ax-radius-lg); padding: 11px 14px;" +
      hlBg +
      " display: flex; flex-direction: column; gap: 6px;" +
      " transition: background 0.15s;" +
      hlBorder +
      (item.url ? " cursor: pointer;" : ""),
  });

  const defaultBg = item.isHeadline
    ? "rgba(215, 129, 0, 0.04)"
    : "var(--ax-glass-2-bg)";
  const hoverBg = item.isHeadline
    ? "rgba(215, 129, 0, 0.08)"
    : "var(--ax-bg-card)";
  if (item.url) {
    card.addEventListener("mouseenter", () => {
      card.style.background = hoverBg;
    });
    card.addEventListener("mouseleave", () => {
      card.style.background = defaultBg;
    });
    card.addEventListener("click", () => window.open(item.url, "_blank"));
  }

  // Title row
  const titleRow = ui_createElement("div", {
    styleString: "display: flex; align-items: flex-start; gap: 6px;",
  });
  titleRow.appendChild(
    ui_createElement("span", {
      text: item.title,
      styleString:
        "font-size: 13px; font-weight: 600; color: var(--ios-text-primary); flex: 1; line-height: 1.4;",
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
        text: "\u2197",
        styleString:
          "font-size: 13px; color: var(--ios-blue); flex-shrink: 0; margin-top: 1px;",
      }),
    );
  }
  card.appendChild(titleRow);

  // Hover-to-mark-read
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

  // Meta row
  const metaRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 6px; flex-wrap: wrap;",
  });
  metaRow.appendChild(sourceBadge(item.sourceType, item.source));
  if (item.isHeadline) metaRow.appendChild(headlineBadge());
  metaRow.appendChild(
    ui_createElement("span", {
      text: formatTimeAgo(item.publishedAt),
      styleString: "font-size: 11px; color: var(--ios-text-secondary);",
    }),
  );
  const symbols = getNewsItemSymbols(item);
  for (const symbol of symbols) {
    metaRow.appendChild(
      ui_createElement("span", {
        text: symbol,
        styleString:
          "font-size: var(--ax-fs-xs); font-weight: var(--ax-fw-semibold); padding: 1px 5px; border-radius: var(--ax-radius-xs);" +
          " background: var(--ax-bg-glass-inset); color: var(--ax-fg-2);",
      }),
    );
  }
  if (item.tags && item.tags.length > 0) {
    for (const tag of item.tags) {
      metaRow.appendChild(tagBadge(tag));
    }
  }
  card.appendChild(metaRow);

  // Summary
  if (item.summary && item.summary !== item.title) {
    const preview = item.summary.slice(0, 160);
    card.appendChild(
      ui_createElement("div", {
        text: preview.length < item.summary.length ? preview + "..." : preview,
        styleString:
          "font-size: 11px; color: var(--ios-text-secondary); line-height: 1.4;",
      }),
    );
  }

  return card;
}
