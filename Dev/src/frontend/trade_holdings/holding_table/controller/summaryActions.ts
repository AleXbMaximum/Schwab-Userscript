import type { TableActionsConfig } from "../types";

export const patchSummaryActionCell = (
  actionCell: HTMLTableCellElement,
  underlyingKey: string,
  actionsConfig: TableActionsConfig,
): void => {
  if (actionCell.getAttribute("data-actions-for") === underlyingKey) return;

  actionCell.innerHTML = "";
  actionCell.style.textAlign = "center";
  actionCell.style.whiteSpace = "nowrap";
  actionCell.style.padding = "2px 6px";
  actionCell.style.verticalAlign = "middle";
  actionCell.setAttribute("data-actions-for", underlyingKey);

  if (actionsConfig.onCompanyDetails) {
    const infoBtn = document.createElement("button");
    infoBtn.textContent = "Info";
    infoBtn.className = "table-action-btn table-action-btn--info";
    infoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      actionsConfig.onCompanyDetails!(underlyingKey);
    });
    actionCell.appendChild(infoBtn);
  }

  const newsBtn = document.createElement("button");
  newsBtn.textContent = "News";
  newsBtn.className = "table-action-btn table-action-btn--news";
  newsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    actionsConfig.onNews(underlyingKey);
  });
  actionCell.appendChild(newsBtn);

  if (actionsConfig.onAIAnalysis) {
    const aiBtn = document.createElement("button");
    aiBtn.textContent = "AI";
    aiBtn.className = "table-action-btn table-action-btn--ai";
    aiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      actionsConfig.onAIAnalysis!(underlyingKey);
    });
    actionCell.appendChild(aiBtn);
  }
};
