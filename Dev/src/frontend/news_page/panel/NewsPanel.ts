import { ui_createElement } from "../../components/core/builders/createElement";
import { createPillGroup } from "../../components/core/builders/pillGroup";
import { newsService } from "backend/services/news/NewsService";
import {
  getNewsItemSymbols,
  matchesNewsSourceFilter,
  formatNewsItemsForExport,
  sortNewsItemsNewestFirst,
} from "../../../backend/services/news/types";
import type {
  UnifiedNewsItem,
  NewsSourceType,
} from "../../../backend/services/news/types";
import { formatTimeAgo } from "shared/utils/time";
import { renderNewsCard } from "../components/newsCard";
import { toolbarBtn } from "../components/toolbarButton";
import { NEWS_FILTER_PILLS } from "../shared/newsConstants";
import { copyWithFlash } from "../shared/newsUtils";
import { buildAISummaryMenu } from "../ai/AISummaryMenu";

// ── Main panel ──────────────────────────────────────────────────────────────

export function openNewsPanel(symbol?: string | null): void {
  const existing = document.getElementById("alexquant-news-panel");
  if (existing) existing.remove();

  const selectedSymbol = String(symbol ?? "")
    .trim()
    .toUpperCase();
  let allItems: UnifiedNewsItem[] = [];
  let activeFilter: "all" | NewsSourceType = "all";

  // ── Overlay ─────────────────────────────────────────────────────────────
  const overlay = ui_createElement("div", {
    props: { id: "alexquant-news-panel" },
    styleString:
      "position: fixed; inset: 0; z-index: var(--ax-z-modal-backdrop); background: var(--ax-modal-backdrop-bg);" +
      " display: flex; align-items: center; justify-content: center;" +
      " -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);",
  });

  // Glass tier-3 + rim makes the modal float properly on top of Schwab's
  // dimmed/inverted backdrop.
  const modal = ui_createElement("div", {
    className: "ax-glass-3 ax-glass-rim",
    styleString:
      "border-radius: var(--ax-radius-2xl); width: min(650px, 93vw);" +
      " max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;" +
      " color: var(--ax-fg);" +
      " transform: scale(0.96); opacity: 0; transition: transform 0.25s ease, opacity 0.25s ease;",
  });

  // ── Header ──────────────────────────────────────────────────────────────
  const header = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; padding: 14px 18px;" +
      " border-bottom: 1px solid var(--ios-border); flex-shrink: 0; gap: 8px;",
  });
  header.appendChild(
    ui_createElement("span", {
      text: "News",
      styleString:
        "font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ios-text-secondary);",
    }),
  );
  header.appendChild(
    ui_createElement("span", {
      text: selectedSymbol || "ALL",
      styleString:
        "font-size: 20px; font-weight: 700; color: var(--ios-text-primary); flex: 1;",
    }),
  );

  const closeBtn = ui_createElement("button", {
    text: "\u00d7",
    styleString:
      "background: none; border: none; font-size: 22px; cursor: pointer; color: var(--ios-text-secondary);" +
      " padding: 0 4px; line-height: 1; font-weight: 300;",
  }) as HTMLButtonElement;
  header.appendChild(closeBtn);

  // ── Toolbar (filter pills + action buttons) ─────────────────────────────
  const toolbar = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; padding: 8px 18px;" +
      " border-bottom: 1px solid var(--ios-border); flex-shrink: 0; flex-wrap: wrap;",
  });

  const filterPills = createPillGroup(
    NEWS_FILTER_PILLS,
    "all" as "all" | NewsSourceType,
    (val) => {
      activeFilter = val;
      renderList();
    },
  );
  toolbar.appendChild(filterPills.element);

  // Spacer
  toolbar.appendChild(ui_createElement("div", { styleString: "flex: 1;" }));

  // Mark All Read button
  const markAllReadBtn = toolbarBtn("Mark All Read", "\u2713");
  markAllReadBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    void newsService.markAllRead();
  });
  toolbar.appendChild(markAllReadBtn);

  // Copy button
  const copyBtn = toolbarBtn("Copy", "\uD83D\uDCCB");
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    void copyWithFlash(copyBtn, () => {
      const filtered = getFiltered();
      if (filtered.length === 0) return "";
      return formatNewsItemsForExport(filtered, formatTimeAgo);
    });
  });
  toolbar.appendChild(copyBtn);

  // AI Check button
  const aiBtn = toolbarBtn("AI Check", "\u2728");
  aiBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    buildAISummaryMenu({ getFiltered, aiSummaryArea });
  });
  toolbar.appendChild(aiBtn);

  // ── Content area ────────────────────────────────────────────────────────
  const content = ui_createElement("div", {
    styleString:
      "flex: 1; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 8px;",
  });

  // ── AI summary area (hidden by default) ─────────────────────────────────
  const aiSummaryArea = ui_createElement("div", {
    styleString:
      "display: none; flex-direction: column; gap: 8px; flex-shrink: 0;",
  });

  modal.appendChild(header);
  modal.appendChild(toolbar);
  modal.appendChild(aiSummaryArea);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    modal.style.transform = "scale(1)";
    modal.style.opacity = "1";
  });

  let unsubNews: (() => void) | null = null;

  const closeModal = () => {
    if (unsubNews) unsubNews();
    modal.style.transform = "scale(0.96)";
    modal.style.opacity = "0";
    setTimeout(() => overlay.remove(), 250);
  };

  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e: MouseEvent) => {
    if (e.target === overlay) closeModal();
  });

  // ── Render helpers ──────────────────────────────────────────────────────
  const getFiltered = (): UnifiedNewsItem[] => {
    let filtered = selectedSymbol
      ? allItems.filter((i) => getNewsItemSymbols(i).includes(selectedSymbol))
      : allItems;

    filtered = filtered.filter((i) => matchesNewsSourceFilter(i, activeFilter));

    return sortNewsItemsNewestFirst(filtered);
  };

  const renderList = () => {
    content.innerHTML = "";
    const filtered = getFiltered();
    if (filtered.length === 0) {
      content.appendChild(
        ui_createElement("div", {
          text:
            allItems.length === 0
              ? "Loading..."
              : selectedSymbol
                ? `No tagged articles for ${selectedSymbol}.`
                : "No articles for this filter.",
          styleString:
            "font-size: 13px; color: var(--ios-text-secondary); text-align: center; padding: 24px;",
        }),
      );
      return;
    }

    const newCount = filtered.filter((i) => i.isNew).length;
    const countEl = ui_createElement("div", {
      text:
        `${filtered.length} articles` +
        (newCount > 0 ? ` \u00b7 ${newCount} new` : "") +
        ` \u00b7 as of ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`,
      styleString: "font-size: 11px; color: var(--ios-text-secondary);",
    });
    countEl.setAttribute("data-news-count", "");
    content.appendChild(countEl);

    const handleItemRead = (id: string) => {
      void newsService.markRead([id]);
      // Update the count display inline
      const newCount = filtered.filter((i) => i.isNew).length;
      const countEl = content.querySelector("[data-news-count]");
      if (countEl) {
        countEl.textContent =
          `${filtered.length} articles` +
          (newCount > 0 ? ` \u00b7 ${newCount} new` : "") +
          ` \u00b7 as of ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`;
      }
    };
    for (const item of filtered) {
      content.appendChild(renderNewsCard(item, { onMarkRead: handleItemRead }));
    }
  };

  // ── Subscribe to newsService (after renderList is defined) ────────────────
  unsubNews = newsService.subscribe((newItems) => {
    allItems = sortNewsItemsNewestFirst(newItems);
    renderList();
  });

  // If subscribe didn't fire synchronously (no cached items), show placeholder
  if (allItems.length === 0) {
    content.appendChild(
      ui_createElement("div", {
        text: "Waiting for news data...",
        styleString:
          "font-size: 13px; color: var(--ios-text-secondary); text-align: center; padding: 24px;",
      }),
    );
  }
}
