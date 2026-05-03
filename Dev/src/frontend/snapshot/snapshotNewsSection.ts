import { ui_createElement } from "../components/core/builders/createElement";
import { DS_COLORS, DS_COMPONENTS, DS_SPACING, DS_TYPOGRAPHY } from "../components/core/styles/theme";
import { newsService } from "backend/services/news/NewsService";
import type { UnifiedNewsItem } from "../../backend/services/news/types";
import {
  NEWS_SOURCE_LABELS as SOURCE_LABELS,
  sortNewsItemsNewestFirst,
} from "../../backend/services/news/types";
import { formatTimeAgo } from "../../shared/utils/time";

const SNAPSHOT_NEWS_MAX_ITEMS = 8;

const NEWS_ACTION_BUTTON_STYLE =
  "padding:4px 8px; border:1px solid var(--ax-border); border-radius: var(--ax-radius-md);" +
  " background: var(--ax-bg-glass-inset); color: var(--ax-fg-2);" +
  " font-size: var(--ax-fs-xs); font-weight: var(--ax-fw-semibold); cursor:pointer;";

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

  const headerRow = ui_createElement("div", {
    styleString: "display:flex; align-items:center; gap:6px;",
  });
  const titleEl = ui_createElement("span", {
    text: "News",
    styleString: DS_TYPOGRAPHY.heading,
  });
  const newCountEl = ui_createElement("span", {
    text: "",
    styleString:
      "display:none; padding:1px 6px; border-radius:999px;" +
      ` background:${DS_COLORS.bgNegative}; color:${DS_COLORS.raw.negative};` +
      " font-size:10px; font-weight:700;",
  });

  const countEl = ui_createElement("span", {
    text: "0 shown",
    styleString:
      "padding:1px 6px; border-radius:999px;" +
      ` background:${DS_COLORS.bgInfo}; color:${DS_COLORS.raw.info};` +
      " font-size:10px; font-weight:700;",
  });

  let isCollapsed = false;
  const collapseBtn = ui_createElement("button", {
    text: "Collapse",
    props: { type: "button", title: "Collapse news list" },
    styleString: NEWS_ACTION_BUTTON_STYLE,
  }) as HTMLButtonElement;
  bindHoverBackground(
    collapseBtn,
    "var(--ax-bg-glass-inset)",
    "var(--ax-bg-row-hover)",
  );

  const markAllReadBtn = ui_createElement("button", {
    text: "Mark All Read",
    props: { type: "button" },
    styleString: NEWS_ACTION_BUTTON_STYLE,
  }) as HTMLButtonElement;
  bindHoverBackground(
    markAllReadBtn,
    "var(--ax-bg-glass-inset)",
    "var(--ax-bg-row-hover)",
  );
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

  const render = (items: UnifiedNewsItem[]) => {
    const sorted = sortNewsItemsNewestFirst(items);
    const display = sorted.slice(0, SNAPSHOT_NEWS_MAX_ITEMS);
    let newCount = display.filter((i) => i.isNew).length;
    updateHeader(display.length, newCount);

    listWrap.innerHTML = "";
    if (display.length === 0) {
      listWrap.appendChild(
        ui_createElement("div", {
          text: "No recent news.",
          styleString:
            DS_TYPOGRAPHY.caption +
            ` padding:${DS_SPACING.md} ${DS_SPACING.sm}; text-align:center;` +
            " border:1px dashed var(--ax-border-strong); border-radius: var(--ax-radius-md);",
        }),
      );
      return;
    }

    for (const item of display) {
      const sourceLabel = SOURCE_LABELS[item.sourceType] ?? item.source;
      const sourceType = String(item.sourceType).toLowerCase();
      const tone =
        sourceType === "financialjuice"
          ? { text: DS_COLORS.raw.neutral, bg: DS_COLORS.bgNeutral }
          : sourceType === "barrons" ||
              sourceType === "dowjones" ||
              sourceType === "press"
            ? { text: DS_COLORS.raw.positive, bg: DS_COLORS.bgPositive }
            : { text: DS_COLORS.raw.info, bg: DS_COLORS.bgInfo };

      const row = ui_createElement("div", {
        styleString:
          DS_COMPONENTS.newsItem +
          ` padding:${DS_SPACING.sm} ${DS_SPACING.md};` +
          " border:1px solid var(--ax-border-subtle);" +
          " transition:background .15s, border-color .15s, box-shadow .15s;" +
          (item.url ? " cursor:pointer;" : ""),
      });

      const metaRow = ui_createElement("div", {
        styleString: "display:flex; align-items:center; gap:6px; min-width:0;",
      });
      metaRow.appendChild(
        ui_createElement("span", {
          text: sourceLabel,
          styleString:
            "font-size:9px; font-weight:700; letter-spacing:0.25px; text-transform:uppercase;" +
            ` color:${tone.text}; background:${tone.bg}; border-radius:999px;` +
            " padding:1px 6px; line-height:1.4;",
        }),
      );
      let newMarkEl: HTMLElement | null = null;
      if (item.isNew) {
        newMarkEl = ui_createElement("span", {
          text: "NEW",
          styleString:
            "font-size:9px; font-weight:700; letter-spacing:0.2px; text-transform:uppercase;" +
            ` color:${DS_COLORS.raw.negative};`,
        });
        metaRow.appendChild(newMarkEl);
      }
      metaRow.appendChild(ui_createElement("div", { styleString: "flex:1;" }));
      metaRow.appendChild(
        ui_createElement("span", {
          text: formatTimeAgo(item.publishedAt),
          styleString: DS_TYPOGRAPHY.caption,
        }),
      );

      const title = ui_createElement("div", {
        text: item.title,
        styleString:
          "font-size:12px; color:var(--ios-text-primary); line-height:1.35; font-weight:500;" +
          " display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;",
      });

      row.appendChild(metaRow);
      row.appendChild(title);

      if (item.summary) {
        row.appendChild(
          ui_createElement("div", {
            text: item.summary,
            styleString:
              DS_TYPOGRAPHY.caption +
              " line-height:1.35; opacity:0.92;" +
              " display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;",
          }),
        );
      }

      if (item.url) {
        row.addEventListener("mouseenter", () => {
          row.style.background = "var(--ax-bg-row-hover)";
          row.style.borderColor = "var(--ax-tone-info-border)";
          row.style.boxShadow = "var(--ax-shadow-sm)";
        });
        row.addEventListener("mouseleave", () => {
          row.style.background = "";
          row.style.borderColor = "var(--ax-border-subtle)";
          row.style.boxShadow = "";
        });
        row.addEventListener("click", () => {
          window.open(item.url, "_blank");
        });
      }

      if (item.isNew) {
        row.addEventListener(
          "mouseenter",
          () => {
            if (newMarkEl) {
              newMarkEl.remove();
              newMarkEl = null;
            }
            item.isNew = false;
            if (newCount > 0) {
              newCount -= 1;
              updateHeader(display.length, newCount);
            }
            void newsService.markRead([item.id]);
          },
          { once: true },
        );
      }

      listWrap.appendChild(row);
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
