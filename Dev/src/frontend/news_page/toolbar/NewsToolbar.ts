import { ui_createElement } from "../../components/core/createElement";
import { createPillGroup } from "../../components/core/pillGroup";
import { DS_COLORS } from "../../components/core/theme";
import type { NewsSourceType } from "../../../backend/services/news/types";
import { NEWS_FILTER_PILLS } from "../shared/newsConstants";
import { toolbarBtn } from "../components/toolbarButton";

export interface NewsToolbarDeps {
  onFilterChange: (val: "all" | NewsSourceType) => void;
  onSymbolFilterChange: (val: "all" | string) => void;
  onSearchChange: (query: string) => void;
  onMarkAllRead: () => void;
  onRefresh: () => Promise<void>;
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

  const refreshBtn = toolbarBtn("Refresh", "\u21BB");
  const refreshBtnIdleHtml = refreshBtn.innerHTML;
  let refreshBtnResetTimer: ReturnType<typeof setTimeout> | null = null;

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

  const runManualRefresh = async () => {
    if (refreshBtn.disabled) return;
    if (refreshBtnResetTimer) {
      clearTimeout(refreshBtnResetTimer);
      refreshBtnResetTimer = null;
    }

    setRefreshButtonState("loading");
    try {
      await deps.onRefresh();
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

  refreshBtn.addEventListener("click", () => void runManualRefresh());
  cleanups.push(() => {
    if (refreshBtnResetTimer) {
      clearTimeout(refreshBtnResetTimer);
      refreshBtnResetTimer = null;
    }
  });
  toolbar.appendChild(refreshBtn);

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
