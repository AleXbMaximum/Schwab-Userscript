import { ui_createElement } from "../../components/core/createElement";
import { DS_BUTTONS } from "../../components/core/theme";
import type { AIAnalysisRecord } from "../../../backend/services/ai/types";
import { formatTimeAgo } from "shared/utils/time";
import { ui_copyTextToClipboard } from "../../components/core/clipboard";
import {
  buildReport,
  buildTranscript,
  decisionColor,
} from "../../../backend/services/ai/pipeline/reportBuilder";

// ── Copy button factory ──────────────────────────────────────────────────────

const copyBtnStyle =
  DS_BUTTONS.secondary +
  " padding: 3px 8px; font-size: 10px; border-radius: 6px;";

export function makeCopyBtn(
  label: string,
  buildFn: () => string,
): HTMLButtonElement {
  const btn = ui_createElement("button", {
    text: label,
    styleString: copyBtnStyle,
  }) as HTMLButtonElement;
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const orig = btn.textContent ?? label;
    try {
      await ui_copyTextToClipboard(buildFn());
      btn.textContent = "Copied!";
    } catch {
      btn.textContent = "Failed";
    }
    setTimeout(() => {
      btn.textContent = orig;
    }, 1500);
  });
  return btn;
}

// ── Report list rendering ────────────────────────────────────────────────────

export interface ReportListResult {
  element: HTMLElement;
  render(records: AIAnalysisRecord[]): void;
  getAllReports(): AIAnalysisRecord[];
}

export function createReportList(opts: {
  onSelectReport: (record: AIAnalysisRecord) => void;
  onDeleteReport: (symbol: string, recordId: string) => Promise<void>;
  statusLabel: HTMLElement;
  compareBtn: HTMLButtonElement;
}): ReportListResult {
  const { onSelectReport, onDeleteReport, statusLabel, compareBtn } = opts;
  let allReports: AIAnalysisRecord[] = [];

  const section = ui_createElement("div", {
    styleString: "display: flex; flex-direction: column; gap: 6px;",
  });

  const render = (records: AIAnalysisRecord[]) => {
    section.innerHTML = "";
    allReports = records;

    const completed = records.filter((r) => r.status === "completed");
    compareBtn.disabled = completed.length < 2;
    compareBtn.style.opacity = completed.length < 2 ? "0.45" : "1";

    if (records.length === 0) {
      section.appendChild(
        ui_createElement("div", {
          text: "No reports yet. Click \u25b6 New Report to run the first analysis.",
          styleString:
            "font-size: 12px; color: var(--ios-text-secondary); padding: 6px 0;",
        }),
      );
      return;
    }

    section.appendChild(
      ui_createElement("span", {
        text: `Reports (${records.length})`,
        styleString:
          "font-size: 11px; font-weight: 700; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;",
      }),
    );

    for (const rec of records) {
      const ts = new Date(rec.completedAt ?? rec.requestedAt).toLocaleString(
        "en-US",
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
      );

      const card = ui_createElement("div", {
        styleString:
          "border: 1px solid var(--ax-border); border-radius: var(--ax-radius-lg); padding: 8px 12px;" +
          " background: var(--ax-glass-2-bg); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;" +
          (rec.status === "completed" ? " cursor: pointer;" : "") +
          " transition: background 0.15s;",
      });

      if (rec.status === "completed") {
        card.addEventListener("mouseenter", () => {
          card.style.background = "var(--ax-bg-card)";
        });
        card.addEventListener("mouseleave", () => {
          card.style.background = "var(--ax-glass-2-bg)";
        });
      }

      const metaStyle =
        "font-size: 11px; color: var(--ios-text-secondary); white-space: nowrap; flex-shrink: 0;";
      const dotStyle =
        "font-size: 11px; color: var(--ios-border); flex-shrink: 0;";
      const dot = () =>
        ui_createElement("span", { text: "\u00b7", styleString: dotStyle });

      card.appendChild(
        ui_createElement("span", { text: ts, styleString: metaStyle }),
      );

      if (rec.finalDecision) {
        const d = rec.finalDecision;
        const color = decisionColor(d.action);

        card.appendChild(dot());
        card.appendChild(
          ui_createElement("span", {
            text: `${d.action} \u00b7 ${d.conviction}/10`,
            styleString: `font-size: 11px; font-weight: 700; color: ${color}; white-space: nowrap;`,
          }),
        );
        card.appendChild(dot());
        card.appendChild(
          ui_createElement("span", {
            text: d.timeHorizon.replace(/_/g, " "),
            styleString: metaStyle,
          }),
        );
        card.appendChild(dot());
        card.appendChild(
          ui_createElement("span", {
            text: d.riskLevel,
            styleString: metaStyle,
          }),
        );
        if (d.targetPrice != null) {
          card.appendChild(dot());
          card.appendChild(
            ui_createElement("span", {
              text: `\u2192$${d.targetPrice.toFixed(2)}`,
              styleString: metaStyle,
            }),
          );
        }
        if (d.stopLoss != null) {
          card.appendChild(dot());
          card.appendChild(
            ui_createElement("span", {
              text: `\u2715$${d.stopLoss.toFixed(2)}`,
              styleString: metaStyle,
            }),
          );
        }
        card.appendChild(dot());
        card.appendChild(
          ui_createElement("span", {
            text: formatTimeAgo(rec.completedAt ?? rec.requestedAt),
            styleString: metaStyle,
          }),
        );
      } else if (rec.status === "failed") {
        card.appendChild(dot());
        card.appendChild(
          ui_createElement("span", {
            text: "Failed",
            styleString: "font-size: 11px; color: var(--ios-red);",
          }),
        );
      } else if (rec.status === "in_progress") {
        card.appendChild(dot());
        card.appendChild(
          ui_createElement("span", {
            text: "In Progress",
            styleString: "font-size: 11px; color: var(--ios-orange);",
          }),
        );
      }

      if (rec.totalTokensUsed > 0) {
        card.appendChild(dot());
        card.appendChild(
          ui_createElement("span", {
            text: `${(rec.totalTokensUsed / 1000).toFixed(1)}K tok`,
            styleString: metaStyle,
          }),
        );
      }

      card.appendChild(ui_createElement("span", { styleString: "flex: 1;" }));

      if (rec.status === "completed") {
        card.appendChild(makeCopyBtn("Report", () => buildReport(rec)));
        card.appendChild(makeCopyBtn("Transcript", () => buildTranscript(rec)));
      }

      const delBtn = ui_createElement("button", {
        text: "\u00d7",
        styleString:
          "background: none; border: none; font-size: 18px; line-height: 1; cursor: pointer;" +
          " color: var(--ios-text-secondary); padding: 0 3px; font-weight: 300; flex-shrink: 0;",
      }) as HTMLButtonElement;
      delBtn.title = "Delete this report";
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          statusLabel.textContent = "";
          await onDeleteReport(rec.symbol, rec.id);
        } catch {
          /* ignore */
        }
      });
      card.appendChild(delBtn);

      if (rec.status === "completed") {
        card.addEventListener("click", (e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          onSelectReport(rec);
          statusLabel.textContent = `Showing report from ${ts}`;
        });
      }

      section.appendChild(card);
    }
  };

  return {
    element: section,
    render,
    getAllReports: () => allReports,
  };
}
