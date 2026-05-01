import { ui_createElement } from "../../components/core/createElement";
import { DS_BUTTONS } from "../../components/core/theme";
import { newsService } from "backend/services/news/NewsService";
import type { UnifiedNewsItem } from "../../../backend/services/news/types";
import type { SummarizeMode } from "../../../backend/services/news/NewsSummarizer";
import { copyWithFlash } from "../shared/newsUtils";
import { toolbarBtn } from "../components/toolbarButton";

export interface AISummaryMenuDeps {
  getFiltered: () => UnifiedNewsItem[];
  aiSummaryArea: HTMLElement;
}

export function buildAISummaryMenu(deps: AISummaryMenuDeps): void {
  const { aiSummaryArea, getFiltered } = deps;

  aiSummaryArea.style.display = "flex";
  aiSummaryArea.innerHTML = "";
  aiSummaryArea.style.padding = "10px 18px";
  aiSummaryArea.style.borderBottom = "1px solid var(--ios-border)";

  const btnRow = ui_createElement("div", {
    styleString: "display: flex; gap: 6px; align-items: center;",
  });

  const allSumBtn = ui_createElement("button", {
    text: "Summarize All",
    styleString:
      DS_BUTTONS.primary +
      " padding: 6px 14px; font-size: 11px; border-radius: 8px;",
  }) as HTMLButtonElement;

  const newSumBtn = ui_createElement("button", {
    text: "Summarize New",
    styleString:
      DS_BUTTONS.secondary +
      " padding: 6px 14px; font-size: 11px; border-radius: 8px;",
  }) as HTMLButtonElement;

  const copyAiBtn = toolbarBtn("Copy Summary", "\uD83D\uDCCB");
  copyAiBtn.style.display = "none";

  const closeAiBtn = ui_createElement("button", {
    text: "\u00d7",
    styleString:
      "background: none; border: none; font-size: 15px; cursor: pointer;" +
      " color: var(--ios-text-secondary); padding: 2px 6px; margin-left: auto;",
  }) as HTMLButtonElement;
  closeAiBtn.addEventListener("click", () => {
    aiSummaryArea.style.display = "none";
    aiSummaryArea.innerHTML = "";
    aiSummaryArea.style.padding = "0";
    aiSummaryArea.style.borderBottom = "none";
  });

  btnRow.appendChild(allSumBtn);
  btnRow.appendChild(newSumBtn);
  btnRow.appendChild(copyAiBtn);
  btnRow.appendChild(closeAiBtn);
  aiSummaryArea.appendChild(btnRow);

  const resultArea = ui_createElement("div", {
    styleString:
      "font-size: var(--ax-fs-md); color: var(--ax-fg); line-height: 1.5;" +
      " max-height: 200px; overflow-y: auto; white-space: pre-wrap; display: none;" +
      " background: var(--ax-bg-glass-inset); border-radius: var(--ax-radius-md); padding: 10px 12px;",
  });
  aiSummaryArea.appendChild(resultArea);

  const runSummary = async (mode: SummarizeMode) => {
    resultArea.style.display = "block";
    resultArea.textContent = "Generating summary...";
    allSumBtn.disabled = true;
    newSumBtn.disabled = true;

    try {
      const result = await newsService.summarizeItems(getFiltered(), mode);
      const normalized = result.trim();
      if (normalized.length > 0) {
        resultArea.textContent = normalized;
        copyAiBtn.style.display = "flex";
      } else {
        resultArea.textContent =
          "AI returned an empty summary. Please retry.";
        copyAiBtn.style.display = "none";
      }
    } catch (err) {
      resultArea.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
      copyAiBtn.style.display = "none";
    } finally {
      allSumBtn.disabled = false;
      newSumBtn.disabled = false;
    }
  };

  allSumBtn.addEventListener("click", () => void runSummary("all"));
  newSumBtn.addEventListener("click", () => void runSummary("new"));
  copyAiBtn.addEventListener("click", () => {
    void copyWithFlash(copyAiBtn, () => resultArea.textContent ?? "");
  });
}
