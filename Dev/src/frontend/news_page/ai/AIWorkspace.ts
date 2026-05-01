import { ui_createElement } from "../../components/core/createElement";
import { DS_BUTTONS, DS_COMPONENTS } from "../../components/core/theme";
import { newsService } from "backend/services/news/NewsService";
import type { UnifiedNewsItem } from "../../../backend/services/news/types";
import { sortNewsItemsNewestFirst } from "../../../backend/services/news/types";
import type { SummarizeMode } from "../../../backend/services/news/NewsSummarizer";
import { copyWithFlash } from "../shared/newsUtils";
import { SUMMARY_PLACEHOLDER } from "../shared/newsConstants";
import { toolbarBtn } from "../components/toolbarButton";

type SummaryScope = SummarizeMode | "selected";

export interface AIWorkspaceDeps {
  getFiltered: () => (UnifiedNewsItem & { tags?: string[] })[];
  getSelectedItems: () => (UnifiedNewsItem & { tags?: string[] })[];
  getAllItems: () => (UnifiedNewsItem & { tags?: string[] })[];
  setAllItems: (items: (UnifiedNewsItem & { tags?: string[] })[]) => void;
  renderList: () => void;
}

export interface AIWorkspaceResult {
  aiShell: HTMLElement;
  syncAIScope: (filtered: (UnifiedNewsItem & { tags?: string[] })[]) => void;
  isSummaryInFlight: () => boolean;
  isTagInFlight: () => boolean;
}

export function buildAIWorkspace(deps: AIWorkspaceDeps): AIWorkspaceResult {
  let summaryInFlight = false;
  let tagInFlight = false;

  const aiShell = ui_createElement("div", {
    className: "alexquant-news-ai-shell",
    styleString:
      DS_COMPONENTS.panel +
      " display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0;",
  });

  aiShell.appendChild(
    ui_createElement("span", {
      text: "AI Workspace",
      styleString:
        "font-size: 15px; font-weight: 700; color: var(--ios-text-primary);",
    }),
  );
  aiShell.appendChild(
    ui_createElement("span", {
      text: "Use AI tools on the current news filter.",
      styleString:
        "font-size: 11px; color: var(--ios-text-secondary); margin-top: -4px;",
    }),
  );

  const aiScopeLabel = ui_createElement("span", {
    text: "",
    styleString:
      "font-size: 11px; color: var(--ios-text-secondary); padding: 5px 8px; border-radius: 8px;" +
      " background: rgba(0,122,255,0.07); border: 1px solid rgba(0,122,255,0.16);",
  });
  aiShell.appendChild(aiScopeLabel);

  const aiActionRow = ui_createElement("div", {
    styleString: "display: flex; flex-wrap: wrap; gap: 6px;",
  });

  const summarizeAllBtn = ui_createElement("button", {
    text: "Summarize All",
    styleString:
      DS_BUTTONS.primary +
      " padding: 6px 12px; font-size: 11px; border-radius: 8px;",
  }) as HTMLButtonElement;

  const summarizeNewBtn = ui_createElement("button", {
    text: "Summarize New",
    styleString:
      DS_BUTTONS.secondary +
      " padding: 6px 12px; font-size: 11px; border-radius: 8px;",
  }) as HTMLButtonElement;

  const summarizeSelectedBtn = ui_createElement("button", {
    text: "Summarize Selected",
    styleString:
      DS_BUTTONS.secondary +
      " padding: 6px 12px; font-size: 11px; border-radius: 8px;",
  }) as HTMLButtonElement;

  const aiTagBtn = ui_createElement("button", {
    text: "AI Tag",
    styleString:
      DS_BUTTONS.secondary +
      " padding: 6px 12px; font-size: 11px; border-radius: 8px;",
  }) as HTMLButtonElement;

  const copySummaryBtn = toolbarBtn("Copy Summary", "\uD83D\uDCCB");
  copySummaryBtn.style.marginLeft = "auto";

  aiActionRow.appendChild(summarizeAllBtn);
  aiActionRow.appendChild(summarizeNewBtn);
  aiActionRow.appendChild(summarizeSelectedBtn);
  aiActionRow.appendChild(aiTagBtn);
  aiActionRow.appendChild(copySummaryBtn);
  aiShell.appendChild(aiActionRow);

  const aiResultArea = ui_createElement("div", {
    text: SUMMARY_PLACEHOLDER,
    styleString:
      "font-size: var(--ax-fs-md); color: var(--ax-fg); line-height: 1.5; white-space: pre-wrap;" +
      " flex: 1; min-height: 140px; overflow-y: auto; background: var(--ax-bg-glass-inset);" +
      " border-radius: var(--ax-radius-md); padding: 10px 12px; border: 1px solid var(--ax-border);",
  });
  aiShell.appendChild(aiResultArea);

  const setCopySummaryEnabled = (enabled: boolean): void => {
    copySummaryBtn.disabled = !enabled;
    copySummaryBtn.style.opacity = enabled ? "1" : "0.55";
    copySummaryBtn.style.cursor = enabled ? "pointer" : "not-allowed";
  };
  setCopySummaryEnabled(false);

  const syncAIScope = (filtered: (UnifiedNewsItem & { tags?: string[] })[]) => {
    const newCount = filtered.filter((i) => i.isNew).length;
    const selectedCount = deps.getSelectedItems().length;
    aiScopeLabel.textContent =
      `${filtered.length} article${filtered.length === 1 ? "" : "s"} in scope` +
      (newCount > 0 ? ` · ${newCount} new` : "") +
      (selectedCount > 0 ? ` · ${selectedCount} selected` : "");

    const hasItems = filtered.length > 0;
    if (!summaryInFlight) {
      summarizeAllBtn.disabled = !hasItems;
      summarizeNewBtn.disabled = !hasItems;
      summarizeSelectedBtn.disabled = !hasItems || selectedCount === 0;
      summarizeAllBtn.style.opacity = hasItems ? "1" : "0.55";
      summarizeNewBtn.style.opacity = hasItems ? "1" : "0.55";
      summarizeSelectedBtn.style.opacity =
        hasItems && selectedCount > 0 ? "1" : "0.55";
    }

    if (!tagInFlight) {
      aiTagBtn.disabled = !hasItems;
      aiTagBtn.style.opacity = hasItems ? "1" : "0.55";
    }
  };

  const runSummary = async (scope: SummaryScope) => {
    const filtered = deps.getFiltered();
    const selectedItems = deps.getSelectedItems();
    const targetItems = scope === "selected" ? selectedItems : filtered;
    if (scope === "selected" && targetItems.length === 0) {
      aiResultArea.textContent = "No selected articles to summarize.";
      setCopySummaryEnabled(false);
      return;
    }
    if (scope !== "selected" && targetItems.length === 0) {
      aiResultArea.textContent = "No articles match current filter.";
      setCopySummaryEnabled(false);
      return;
    }

    summaryInFlight = true;
    summarizeAllBtn.disabled = true;
    summarizeNewBtn.disabled = true;
    summarizeSelectedBtn.disabled = true;
    summarizeAllBtn.style.opacity = "0.7";
    summarizeNewBtn.style.opacity = "0.7";
    summarizeSelectedBtn.style.opacity = "0.7";
    aiResultArea.textContent = "Generating summary...";
    setCopySummaryEnabled(false);

    try {
      const summarizeMode: SummarizeMode = scope === "new" ? "new" : "all";
      const result = await newsService.summarizeItems(
        targetItems,
        summarizeMode,
      );
      const normalized = result.trim();
      if (normalized.length > 0) {
        aiResultArea.textContent = normalized;
        setCopySummaryEnabled(true);
      } else {
        aiResultArea.textContent =
          "AI returned an empty summary. Please retry.";
        setCopySummaryEnabled(false);
      }
    } catch (err) {
      aiResultArea.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
      setCopySummaryEnabled(false);
    } finally {
      summaryInFlight = false;
      syncAIScope(deps.getFiltered());
    }
  };

  const handleAITag = async () => {
    const filtered = deps.getFiltered();
    if (filtered.length === 0) {
      aiResultArea.textContent = "No articles to tag for current filter.";
      return;
    }

    const origText = aiTagBtn.textContent ?? "AI Tag";
    tagInFlight = true;
    aiTagBtn.disabled = true;
    aiTagBtn.textContent = "Tagging...";

    try {
      const tagged = await newsService.tagItems(filtered.slice(0, 50));

      const tagMap = new Map<string, string[]>();
      for (const item of tagged) {
        if (item.tags) tagMap.set(item.id, item.tags);
      }

      let allItems = deps.getAllItems().map((item) => {
        const tags = tagMap.get(item.id);
        return tags ? { ...item, tags } : item;
      });
      allItems = sortNewsItemsNewestFirst(allItems);
      deps.setAllItems(allItems);

      aiResultArea.textContent = `Tagged ${tagMap.size} article${tagMap.size === 1 ? "" : "s"} with AI labels.`;
      setCopySummaryEnabled(false);
      deps.renderList();
    } catch {
      aiResultArea.textContent = "AI tagging failed. Please retry.";
      setCopySummaryEnabled(false);
    } finally {
      tagInFlight = false;
      aiTagBtn.textContent = origText;
      syncAIScope(deps.getFiltered());
    }
  };

  summarizeAllBtn.addEventListener("click", () => void runSummary("all"));
  summarizeNewBtn.addEventListener("click", () => void runSummary("new"));
  summarizeSelectedBtn.addEventListener(
    "click",
    () => void runSummary("selected"),
  );
  aiTagBtn.addEventListener("click", () => void handleAITag());
  copySummaryBtn.addEventListener("click", () => {
    if (copySummaryBtn.disabled) return;
    void copyWithFlash(copySummaryBtn, () => aiResultArea.textContent ?? "");
  });

  return {
    aiShell,
    syncAIScope,
    isSummaryInFlight: () => summaryInFlight,
    isTagInFlight: () => tagInFlight,
  };
}
