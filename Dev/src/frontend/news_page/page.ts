import { ui_createElement } from "../components/core/builders/createElement";
import { DS_COLORS, DS_TYPOGRAPHY, DS_COMPONENTS } from "../components/core/styles/theme";
import { newsService } from "backend/services/news/NewsService";
import {
  getNewsItemSymbols,
  matchesNewsSourceFilter,
  formatNewsItemsForExport,
  sortNewsItemsNewestFirst,
} from "../../backend/services/news/types";
import type {
  UnifiedNewsItem,
  NewsSourceType,
} from "../../backend/services/news/types";
import type { TaggedNewsItem } from "../../backend/services/news/NewsTagging";
import { formatTimeAgo } from "shared/utils/time";
import { renderNewsCard } from "./components/newsCard";
import { createNewsSettingsPanel } from "./settings/settingsPanel";
import { buildNewsToolbar } from "./toolbar/NewsToolbar";
import { buildAIWorkspace } from "./ai/AIWorkspace";
import { ensureNewsLayoutStyles, copyWithFlash } from "./shared/newsUtils";
import { logService } from "../../shared/log/core/LogService";

const log = logService.namespace("render");

// ── Page ────────────────────────────────────────────────────────────────────

export function news_renderPage(
  _ctx: unknown,
): HTMLElement & { cleanup?: () => void } {
  log.info("news.renderPage");
  let allItems: (UnifiedNewsItem & { tags?: string[] })[] =
    sortNewsItemsNewestFirst(newsService.getItems());
  let activeFilter: "all" | NewsSourceType = "all";
  let activeSymbolFilter: "all" | string = "all";
  let searchQuery = "";
  const selectedIds = new Set<string>();

  const cleanups: (() => void)[] = [];
  const ctx = (_ctx ?? {}) as {
    settings?: Record<string, unknown>;
    onUpdateSettings?: (newSettings: Record<string, unknown>) => void;
  };
  const settings = (ctx.settings ?? {}) as Record<string, unknown>;
  const onUpdateSettings =
    typeof ctx.onUpdateSettings === "function" ? ctx.onUpdateSettings : null;

  ensureNewsLayoutStyles();

  // ── Root wrapper ────────────────────────────────────────────────────────
  const wrapper = ui_createElement("div", {
    styleString:
      "padding: 20px 24px; display: flex; flex-direction: column; gap: 16px;" +
      " height: 100%; overflow: hidden;",
  }) as HTMLElement & { cleanup?: () => void };

  const autoRefreshLabel = ui_createElement("span", {
    text: newsService.getAutoRefreshLabel(),
  });
  // ── Header ──────────────────────────────────────────────────────────────
  const headerRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 12px; flex-shrink: 0; flex-wrap: wrap;",
  });

  headerRow.appendChild(
    ui_createElement("span", {
      text: "News",
      styleString: DS_TYPOGRAPHY.pageTitle,
    }),
  );

  const headerRight = ui_createElement("div", {
    styleString:
      "margin-left: auto; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;",
  });
  const statusLabel = ui_createElement("span", {
    text: "",
    styleString: "font-size: 11px; color: var(--ios-text-secondary);",
  });
  headerRight.appendChild(statusLabel);

  const newsSettingsPanel = createNewsSettingsPanel({
    settings,
    onUpdateSettings,
    autoRefreshLabel,
    getAutoRefreshLabel: () => newsService.getAutoRefreshLabel(),
  });
  headerRight.appendChild(newsSettingsPanel.root);
  headerRow.appendChild(headerRight);
  wrapper.appendChild(headerRow);
  cleanups.push(() => newsSettingsPanel.cleanup());

  // ── 2/3 + 1/3 Layout ────────────────────────────────────────────────────
  const mainLayout = ui_createElement("div", {
    className: "alexquant-news-layout",
  });
  wrapper.appendChild(mainLayout);

  const newsCol = ui_createElement("div", {
    className: "alexquant-news-col",
    styleString:
      "display: flex; flex-direction: column; min-width: 0; min-height: 0;",
  });
  const aiCol = ui_createElement("div", {
    className: "alexquant-news-col",
    styleString:
      "display: flex; flex-direction: column; min-width: 0; min-height: 0;",
  });

  mainLayout.appendChild(newsCol);
  mainLayout.appendChild(aiCol);

  const newsShell = ui_createElement("div", {
    styleString:
      DS_COMPONENTS.panel +
      " display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0;",
  });
  newsCol.appendChild(newsShell);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getAvailableTickerSymbols = (): string[] => {
    const symbols = new Set<string>();
    for (const item of allItems) {
      for (const symbol of getNewsItemSymbols(item)) {
        symbols.add(symbol);
      }
    }
    return Array.from(symbols).sort((a, b) => a.localeCompare(b));
  };

  const getFiltered = (): (UnifiedNewsItem & { tags?: string[] })[] => {
    let filtered = allItems;

    if (activeSymbolFilter !== "all") {
      filtered = filtered.filter((i) =>
        getNewsItemSymbols(i).includes(activeSymbolFilter),
      );
    }

    filtered = filtered.filter((i) => matchesNewsSourceFilter(i, activeFilter));

    if (searchQuery) {
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(searchQuery) ||
          (i.summary && i.summary.toLowerCase().includes(searchQuery)),
      );
    }

    const timeSorted = sortNewsItemsNewestFirst(filtered);
    const newFirst: (UnifiedNewsItem & { tags?: string[] })[] = [];
    const oldAfter: (UnifiedNewsItem & { tags?: string[] })[] = [];
    for (const item of timeSorted) {
      if (item.isNew) newFirst.push(item);
      else oldAfter.push(item);
    }
    return [...newFirst, ...oldAfter];
  };

  const getSelectedItems = (): (UnifiedNewsItem & { tags?: string[] })[] =>
    allItems.filter((item) => selectedIds.has(item.id));

  const syncSelectionValidity = (): void => {
    const validIds = new Set(allItems.map((item) => item.id));
    for (const id of Array.from(selectedIds)) {
      if (!validIds.has(id)) selectedIds.delete(id);
    }
  };

  // ── AI workspace (right rail) ───────────────────────────────────────────
  const aiWorkspace = buildAIWorkspace({
    getFiltered,
    getSelectedItems,
    getAllItems: () => allItems,
    setAllItems: (items) => {
      allItems = items;
    },
    renderList: () => renderList(),
  });
  aiCol.appendChild(aiWorkspace.aiShell);

  // ── Toolbar ─────────────────────────────────────────────────────────────
  const toolbarResult = buildNewsToolbar({
    onFilterChange: (val) => {
      activeFilter = val;
      renderList();
    },
    onSymbolFilterChange: (val) => {
      activeSymbolFilter = val;
      renderList();
    },
    onSearchChange: (query) => {
      searchQuery = query;
      renderList();
    },
    onMarkAllRead: () => {
      void newsService.markAllRead();
    },
    onRefresh: () => newsService.refresh(),
    onCopy: () => {
      void copyWithFlash(toolbarResult.copyBtn, () => {
        const filtered = getFiltered();
        if (filtered.length === 0) return "";
        return formatNewsItemsForExport(filtered, formatTimeAgo);
      });
    },
  });
  cleanups.push(...toolbarResult.cleanups);
  newsShell.appendChild(toolbarResult.toolbar);

  const { symbolFilterSelect, markSelectedReadBtn } = toolbarResult;

  const syncSymbolFilterOptions = (): void => {
    const symbols = getAvailableTickerSymbols();
    const previous = activeSymbolFilter;

    symbolFilterSelect.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All Stocks";
    symbolFilterSelect.appendChild(allOption);

    for (const symbol of symbols) {
      const option = document.createElement("option");
      option.value = symbol;
      option.textContent = symbol;
      symbolFilterSelect.appendChild(option);
    }

    if (previous !== "all" && !symbols.includes(previous)) {
      activeSymbolFilter = "all";
    }
    symbolFilterSelect.value = activeSymbolFilter;
    symbolFilterSelect.disabled = symbols.length === 0;
  };

  const syncAIScope = (filtered: (UnifiedNewsItem & { tags?: string[] })[]) => {
    aiWorkspace.syncAIScope(filtered);

    const selectedCount = selectedIds.size;
    markSelectedReadBtn.disabled = selectedCount === 0;
    markSelectedReadBtn.style.opacity = selectedCount > 0 ? "1" : "0.55";
    markSelectedReadBtn.style.cursor =
      selectedCount > 0 ? "pointer" : "not-allowed";
  };

  const updateStatus = () => {
    const total = allItems.length;
    const newCount = allItems.filter((i) => i.isNew).length;
    const lastFetched = newsService.getLastFetchedAt();
    const selectedCount = selectedIds.size;
    const timeStr = lastFetched ? `Updated ${formatTimeAgo(lastFetched)}` : "";

    statusLabel.textContent = timeStr;
    articleCount.textContent =
      `${total} articles` +
      (newCount > 0 ? ` · ${newCount} new` : "") +
      (selectedCount > 0 ? ` · ${selectedCount} selected` : "");
  };

  // ── Status bar ──────────────────────────────────────────────────────────
  const statusBar = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; flex-shrink: 0;" +
      " font-size: 11px; color: var(--ios-text-secondary);",
  });

  const articleCount = ui_createElement("span", { text: "" });
  statusBar.appendChild(articleCount);

  const refreshDot = ui_createElement("span", {
    styleString:
      `width: 6px; height: 6px; border-radius: 50%; background: ${DS_COLORS.raw.positive};` +
      " animation: pulse 2s infinite; flex-shrink: 0;",
  });
  statusBar.appendChild(refreshDot);
  statusBar.appendChild(autoRefreshLabel);
  newsShell.appendChild(statusBar);

  // ── News content ────────────────────────────────────────────────────────
  const content = ui_createElement("div", {
    styleString:
      "flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;" +
      " padding-right: 4px;",
  });
  newsShell.appendChild(content);

  const renderList = () => {
    content.innerHTML = "";
    const filtered = getFiltered();
    syncAIScope(filtered);

    if (filtered.length === 0) {
      content.appendChild(
        ui_createElement("div", {
          text:
            allItems.length === 0
              ? "Waiting for news data..."
              : "No articles match your filter.",
          styleString:
            "font-size: 13px; color: var(--ios-text-secondary); text-align: center; padding: 40px;",
        }),
      );
      return;
    }

    const handleItemRead = (id: string) => {
      void newsService.markRead([id]);
      updateStatus();
    };

    for (const item of filtered) {
      const row = ui_createElement("div", {
        styleString: "display: flex; align-items: flex-start; gap: 8px;",
      });

      const selectBox = ui_createElement("input", {
        props: { type: "checkbox" },
        styleString:
          "width: 14px; height: 14px; margin-top: 9px; cursor: pointer; flex-shrink: 0;",
      }) as HTMLInputElement;
      selectBox.checked = selectedIds.has(item.id);
      selectBox.addEventListener("click", (e) => e.stopPropagation());
      selectBox.addEventListener("change", () => {
        if (selectBox.checked) selectedIds.add(item.id);
        else selectedIds.delete(item.id);
        syncAIScope(getFiltered());
        updateStatus();
      });

      const card = renderNewsCard(item, { onMarkRead: handleItemRead });
      card.style.flex = "1";

      row.appendChild(selectBox);
      row.appendChild(card);
      content.appendChild(row);
    }
  };

  const markSelectedAsRead = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    allItems = allItems.map((item) =>
      idSet.has(item.id) ? { ...item, isNew: false } : item,
    );
    selectedIds.clear();
    void newsService.markRead(ids);
    updateStatus();
    renderList();
  };

  markSelectedReadBtn.addEventListener("click", () => {
    markSelectedAsRead();
  });

  // ── Subscribe to newsService ────────────────────────────────────────────
  const unsub = newsService.subscribe((newItems) => {
    const tagMap = new Map<string, string[]>();
    for (const item of allItems) {
      if ((item as TaggedNewsItem).tags) {
        tagMap.set(item.id, (item as TaggedNewsItem).tags!);
      }
    }

    allItems = newItems.map((item) => {
      const tags = tagMap.get(item.id);
      return tags ? { ...item, tags } : item;
    });
    allItems = sortNewsItemsNewestFirst(allItems);
    syncSelectionValidity();

    syncSymbolFilterOptions();
    updateStatus();
    renderList();
  });
  cleanups.push(unsub);

  // Initial render
  syncSymbolFilterOptions();
  updateStatus();
  renderList();

  // ── Cleanup ─────────────────────────────────────────────────────────────
  wrapper.cleanup = () => {
    for (const fn of cleanups) fn();
  };

  return wrapper;
}
