import { ui_createElement } from "../../components/core/builders/createElement";
import { createPillGroup } from "../../components/core/builders/pillGroup";
import { DS_COLORS } from "../../components/core/styles/theme";
import type { NewsSourceType } from "../../../backend/services/news/types";
import type {
  NewsFetchSource,
  NewsSourceEnabled,
} from "../../../backend/services/news/NewsService";
import {
  NEWS_FETCH_SOURCES,
  NEWS_SOURCE_LABELS,
} from "../../../backend/services/news/NewsService";
import { NEWS_FILTER_PILLS } from "../shared/newsConstants";
import { toolbarBtn } from "../components/toolbarButton";

export type NewsRefreshTarget = "all" | NewsFetchSource;

export interface NewsToolbarDeps {
  onFilterChange: (val: "all" | NewsSourceType) => void;
  onSymbolFilterChange: (val: "all" | string) => void;
  onSearchChange: (query: string) => void;
  onMarkAllRead: () => void;
  onRefresh: (target: NewsRefreshTarget) => Promise<void>;
  getSourceEnabled: () => NewsSourceEnabled;
  onCopy: () => void;
}

export interface NewsToolbarResult {
  toolbar: HTMLElement;
  symbolFilterSelect: HTMLSelectElement;
  searchInput: HTMLInputElement;
  markSelectedReadBtn: HTMLButtonElement;
  refreshBtn: HTMLButtonElement;
  copyBtn: HTMLButtonElement;
  cleanups: (() => void)[];
}

export function buildNewsToolbar(deps: NewsToolbarDeps): NewsToolbarResult {
  const cleanups: (() => void)[] = [];

  const toolbar = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap;",
  });

  const filterPills = createPillGroup(
    NEWS_FILTER_PILLS,
    "all" as "all" | NewsSourceType,
    (val) => {
      deps.onFilterChange(val);
    },
  );
  toolbar.appendChild(filterPills.element);

  const symbolFilterSelect = ui_createElement("select", {
    styleString:
      "border: 1px solid var(--ax-border); border-radius: var(--ax-radius-md); padding: 5px 8px;" +
      " font-size: var(--ax-fs-md); outline: none; min-width: 120px; background: var(--ax-bg-input);" +
      " color: var(--ax-fg);",
  }) as HTMLSelectElement;
  symbolFilterSelect.addEventListener("change", () => {
    const next = symbolFilterSelect.value;
    deps.onSymbolFilterChange(next === "all" ? "all" : next);
  });
  toolbar.appendChild(symbolFilterSelect);

  const searchInput = ui_createElement("input", {
    props: { type: "text", placeholder: "Search headlines..." },
    styleString:
      "border: 1px solid var(--ax-border); border-radius: var(--ax-radius-md); padding: 5px 10px;" +
      " font-size: var(--ax-fs-md); outline: none; width: 180px; background: var(--ax-bg-input);" +
      " transition: border-color 0.15s;",
  }) as HTMLInputElement;
  searchInput.addEventListener("input", () => {
    deps.onSearchChange(searchInput.value.trim().toLowerCase());
  });
  searchInput.addEventListener("focus", () => {
    searchInput.style.borderColor = DS_COLORS.raw.info;
  });
  searchInput.addEventListener("blur", () => {
    searchInput.style.borderColor = "var(--ios-border)";
  });
  toolbar.appendChild(searchInput);

  toolbar.appendChild(ui_createElement("div", { styleString: "flex: 1;" }));

  const markAllReadBtn = toolbarBtn("Mark All Read", "\u2713");
  markAllReadBtn.addEventListener("click", () => {
    deps.onMarkAllRead();
  });
  toolbar.appendChild(markAllReadBtn);

  const markSelectedReadBtn = toolbarBtn("Mark Selected Read", "\u2714");
  markSelectedReadBtn.disabled = true;
  markSelectedReadBtn.style.opacity = "0.55";
  markSelectedReadBtn.style.cursor = "not-allowed";
  toolbar.appendChild(markSelectedReadBtn);

  const refreshWrap = ui_createElement("div", {
    styleString: "position: relative; display: inline-block; flex-shrink: 0;",
  });
  const refreshBtn = toolbarBtn("Refresh \u25BE", "\u21BB");
  const refreshBtnIdleHtml = refreshBtn.innerHTML;
  let refreshBtnResetTimer: ReturnType<typeof setTimeout> | null = null;
  let menuOpen = false;

  const setRefreshButtonState = (
    state: "idle" | "loading" | "done" | "error",
  ) => {
    if (state === "idle") {
      refreshBtn.innerHTML = refreshBtnIdleHtml;
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = "1";
      return;
    }
    if (state === "loading") {
      refreshBtn.innerHTML =
        '<span style="font-size:13px">\u23F3</span><span>Refreshing...</span>';
      refreshBtn.disabled = true;
      refreshBtn.style.opacity = "0.75";
      return;
    }
    if (state === "done") {
      refreshBtn.innerHTML =
        '<span style="font-size:13px">\u2705</span><span>Refreshed</span>';
      refreshBtn.disabled = true;
      refreshBtn.style.opacity = "0.9";
      return;
    }
    refreshBtn.innerHTML =
      '<span style="font-size:13px">\u26A0\uFE0F</span><span>Retry</span>';
    refreshBtn.disabled = false;
    refreshBtn.style.opacity = "1";
  };

  const runManualRefresh = async (target: NewsRefreshTarget) => {
    if (refreshBtn.disabled) return;
    if (refreshBtnResetTimer) {
      clearTimeout(refreshBtnResetTimer);
      refreshBtnResetTimer = null;
    }

    setRefreshButtonState("loading");
    try {
      await deps.onRefresh(target);
      setRefreshButtonState("done");
    } catch {
      setRefreshButtonState("error");
    } finally {
      refreshBtnResetTimer = setTimeout(() => {
        refreshBtnResetTimer = null;
        setRefreshButtonState("idle");
      }, 1200);
    }
  };

  const refreshMenu = ui_createElement("div", {
    styleString:
      "position: absolute; top: calc(100% + 4px); right: 0; z-index: 30;" +
      " min-width: 180px; padding: 4px 0; display: none; flex-direction: column;" +
      " background: var(--ax-bg-card); border: 1px solid var(--ax-border);" +
      " border-radius: var(--ax-radius-md); box-shadow: var(--ax-shadow-lg);" +
      " font-size: var(--ax-fs-sm);",
  });

  const setMenuOpen = (open: boolean): void => {
    menuOpen = open;
    refreshMenu.style.display = open ? "flex" : "none";
  };

  const buildMenuItem = (
    label: string,
    onPick: () => void,
    opts: { disabled?: boolean; separator?: boolean } = {},
  ): HTMLElement => {
    const item = ui_createElement("button", {
      props: { type: "button" },
      styleString:
        "background: transparent; border: 0; padding: 6px 12px; text-align: left;" +
        " font-size: var(--ax-fs-sm); cursor: pointer; color: var(--ax-fg);" +
        (opts.separator ? " border-top: 1px solid var(--ax-border-subtle);" : ""),
    }) as HTMLButtonElement;
    item.textContent = label;
    if (opts.disabled) {
      item.disabled = true;
      item.style.opacity = "0.45";
      item.style.cursor = "not-allowed";
    } else {
      item.addEventListener("mouseenter", () => {
        item.style.background = "var(--ax-bg-chip)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
      });
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        setMenuOpen(false);
        onPick();
      });
    }
    return item;
  };

  const rebuildMenu = (): void => {
    refreshMenu.innerHTML = "";
    const enabled = deps.getSourceEnabled();
    const anyEnabled = NEWS_FETCH_SOURCES.some((s) => enabled[s]);
    refreshMenu.appendChild(
      buildMenuItem(
        "Refresh All",
        () => void runManualRefresh("all"),
        { disabled: !anyEnabled },
      ),
    );
    let first = true;
    for (const source of NEWS_FETCH_SOURCES) {
      refreshMenu.appendChild(
        buildMenuItem(
          NEWS_SOURCE_LABELS[source],
          () => void runManualRefresh(source),
          { disabled: !enabled[source], separator: first },
        ),
      );
      first = false;
    }
  };

  refreshBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (refreshBtn.disabled) return;
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    rebuildMenu();
    setMenuOpen(true);
  });

  const onDocClick = (e: MouseEvent): void => {
    if (!menuOpen) return;
    const target = e.target as Node | null;
    if (target && refreshWrap.contains(target)) return;
    setMenuOpen(false);
  };
  document.addEventListener("mousedown", onDocClick);

  const onDocKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && menuOpen) setMenuOpen(false);
  };
  document.addEventListener("keydown", onDocKeydown);

  cleanups.push(() => {
    if (refreshBtnResetTimer) {
      clearTimeout(refreshBtnResetTimer);
      refreshBtnResetTimer = null;
    }
    document.removeEventListener("mousedown", onDocClick);
    document.removeEventListener("keydown", onDocKeydown);
  });

  refreshWrap.appendChild(refreshBtn);
  refreshWrap.appendChild(refreshMenu);
  toolbar.appendChild(refreshWrap);

  const copyBtn = toolbarBtn("Copy", "\uD83D\uDCCB");
  copyBtn.addEventListener("click", () => deps.onCopy());
  toolbar.appendChild(copyBtn);

  return {
    toolbar,
    symbolFilterSelect,
    searchInput,
    markSelectedReadBtn,
    refreshBtn,
    copyBtn,
    cleanups,
  };
}
