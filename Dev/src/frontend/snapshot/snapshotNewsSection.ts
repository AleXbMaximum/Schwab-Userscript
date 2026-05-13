import { ui_createElement } from "../components/core/builders/createElement";
import {
  DS_COLORS,
  DS_SPACING,
  DS_TYPOGRAPHY,
} from "../components/core/styles/theme";
import { newsService } from "backend/services/news/NewsService";
import type { UnifiedNewsItem } from "../../backend/services/news/types";
import {
  pinUnreadHeadlines,
  sortNewsItemsNewestFirst,
} from "../../backend/services/news/types";
import { renderNewsCard } from "../news_page/components/newsCard";

const SNAPSHOT_NEWS_MAX_ITEMS = 8;

const ACTION_BUTTON_STYLE =
  "padding:4px 8px; border:1px solid var(--ax-border); border-radius: var(--ax-radius-md);" +
  " background: var(--ax-bg-glass-inset); color: var(--ax-fg-2);" +
  " font-size: var(--ax-fs-xs); font-weight: var(--ax-fw-semibold); cursor:pointer;";

const ACTION_BUTTON_IDLE_BG = "var(--ax-bg-glass-inset)";
const ACTION_BUTTON_HOVER_BG = "var(--ax-bg-row-hover)";

function bindHoverBackground(
  el: HTMLElement,
  idle: string,
  hover: string,
): void {
  el.addEventListener("mouseenter", () => {
    el.style.background = hover;
  });
  el.addEventListener("mouseleave", () => {
    el.style.background = idle;
  });
}

function buildActionButton(text: string, title?: string): HTMLButtonElement {
  const btn = ui_createElement("button", {
    text,
    props: title ? { type: "button", title } : { type: "button" },
    styleString: ACTION_BUTTON_STYLE,
  }) as HTMLButtonElement;
  bindHoverBackground(btn, ACTION_BUTTON_IDLE_BG, ACTION_BUTTON_HOVER_BG);
  return btn;
}

function buildCountPill(
  bg: string,
  color: string,
  options: { hidden?: boolean } = {},
): HTMLElement {
  const prefix = options.hidden ? "display:none; " : "";
  return ui_createElement("span", {
    text: "",
    styleString:
      `${prefix}padding:1px 6px; border-radius:999px;` +
      ` background:${bg}; color:${color};` +
      " font-size:10px; font-weight:700;",
  });
}

export type SnapshotNewsSectionController = {
  element: HTMLElement;
  update: (items: UnifiedNewsItem[]) => void;
  destroy: () => void;
};

export function createSnapshotNewsSection(
  openNewsPage?: () => void,
): SnapshotNewsSectionController {
  const section = ui_createElement("div", {
    styleString:
      `display:flex; flex-direction:column; gap:${DS_SPACING.sm};` +
      ` margin-top:${DS_SPACING.md}; padding-top:${DS_SPACING.md};` +
      " border-top: 1px solid var(--ax-border);",
  });

  // ── Header ──────────────────────────────────────────────────────────────
  const headerRow = ui_createElement("div", {
    styleString: "display:flex; align-items:center; gap:6px;",
  });
  const titleEl = ui_createElement("span", {
    text: "News",
    styleString: DS_TYPOGRAPHY.heading,
  });
  const newCountEl = buildCountPill(
    DS_COLORS.bgNegative,
    DS_COLORS.raw.negative,
    { hidden: true },
  );
  const countEl = buildCountPill(DS_COLORS.bgInfo, DS_COLORS.raw.info);
  countEl.textContent = "0 shown";

  let isCollapsed = false;
  const collapseBtn = buildActionButton("Collapse", "Collapse news list");
  const markAllReadBtn = buildActionButton("Mark All Read");
  markAllReadBtn.addEventListener("click", () => {
    void newsService.markAllRead();
  });

  headerRow.appendChild(titleEl);
  headerRow.appendChild(newCountEl);
  headerRow.appendChild(countEl);
  headerRow.appendChild(ui_createElement("div", { styleString: "flex:1;" }));
  headerRow.appendChild(collapseBtn);
  headerRow.appendChild(markAllReadBtn);

  if (openNewsPage) {
    const openBtn = ui_createElement("button", {
      text: "Open News",
      props: { type: "button" },
      styleString:
        "padding:4px 8px; border:1px solid var(--ax-tone-info-border); border-radius: var(--ax-radius-md);" +
        ` background:${DS_COLORS.bgInfo}; color:${DS_COLORS.raw.info};` +
        " font-size: var(--ax-fs-xs); font-weight: var(--ax-fw-semibold); cursor:pointer;",
    });
    bindHoverBackground(openBtn, DS_COLORS.bgInfo, "var(--ax-tone-info-bg)");
    openBtn.addEventListener("click", () => openNewsPage());
    headerRow.appendChild(openBtn);
  }

  // ── Body ────────────────────────────────────────────────────────────────
  const listWrap = ui_createElement("div", {
    styleString: `display:flex; flex-direction:column; gap:${DS_SPACING.sm};`,
  });

  const syncCollapsedState = () => {
    listWrap.style.display = isCollapsed ? "none" : "flex";
    collapseBtn.textContent = isCollapsed ? "Expand" : "Collapse";
    collapseBtn.title = isCollapsed ? "Expand news list" : "Collapse news list";
  };
  collapseBtn.addEventListener("click", () => {
    isCollapsed = !isCollapsed;
    syncCollapsedState();
  });

  section.appendChild(headerRow);
  section.appendChild(listWrap);

  const updateHeader = (shownCount: number, newCount: number) => {
    countEl.textContent = `${shownCount} shown`;
    if (newCount > 0) {
      newCountEl.textContent = `${newCount} new`;
      newCountEl.style.display = "inline-block";
    } else {
      newCountEl.style.display = "none";
    }
  };

  const renderEmptyState = () => {
    listWrap.appendChild(
      ui_createElement("div", {
        text: "No recent news.",
        styleString:
          DS_TYPOGRAPHY.caption +
          ` padding:${DS_SPACING.md} ${DS_SPACING.sm}; text-align:center;` +
          " border:1px dashed var(--ax-border-strong); border-radius: var(--ax-radius-md);",
      }),
    );
  };

  const render = (items: UnifiedNewsItem[]) => {
    const sorted = sortNewsItemsNewestFirst(items);
    // Pin unread headlines so high-priority items survive the
    // SNAPSHOT_NEWS_MAX_ITEMS slice; ordering falls back to chronological
    // once the user marks them read.
    const display = pinUnreadHeadlines(sorted).slice(0, SNAPSHOT_NEWS_MAX_ITEMS);
    let newCount = display.filter((i) => i.isNew).length;
    updateHeader(display.length, newCount);

    listWrap.innerHTML = "";
    if (display.length === 0) {
      renderEmptyState();
      syncCollapsedState();
      return;
    }

    for (const item of display) {
      listWrap.appendChild(
        renderNewsCard(item, {
          density: "compact",
          onMarkRead: (id) => {
            if (newCount > 0) {
              newCount -= 1;
              updateHeader(display.length, newCount);
            }
            void newsService.markRead([id]);
          },
        }),
      );
    }

    syncCollapsedState();
  };

  render([]);
  return {
    element: section,
    update: render,
    destroy: () => {
      listWrap.innerHTML = "";
    },
  };
}
