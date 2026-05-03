import { ui_createElement } from "../../components/core/builders/createElement";
import { DS_COLORS, DS_TYPOGRAPHY } from "../../components/core/styles/theme";
import type {
  AIFinalDecision,
  MarketDataBundle,
} from "../../../backend/services/ai/types";
import { formatTimeAgo } from "shared/utils/time";
import { renderMarkdown } from "shared/utils/format/markdown";

export function renderDecisionSummary(
  decision: AIFinalDecision,
  marketData: MarketDataBundle | null,
): HTMLElement {
  const isPositive =
    decision.action === "BUY" || decision.action === "STRONG_BUY";
  const isNegative =
    decision.action === "SELL" || decision.action === "STRONG_SELL";
  const actionColor = isPositive
    ? DS_COLORS.positive
    : isNegative
      ? DS_COLORS.negative
      : DS_COLORS.neutral;
  const actionColorRaw = isPositive
    ? DS_COLORS.raw.positive
    : isNegative
      ? DS_COLORS.raw.negative
      : DS_COLORS.raw.neutral;

  const panel = ui_createElement("div", {
    styleString:
      "background: var(--ax-glass-2-bg); border: 1px solid var(--ax-glass-2-border);" +
      " box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);" +
      " backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
      " -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
      " border-radius: var(--ax-radius-xl); padding: 16px; display: flex; flex-direction: column; gap: 16px;",
  });

  // Action badge row
  const badgeRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 12px; flex-wrap: wrap;",
  });

  const badge = ui_createElement("div", {
    styleString:
      `display: inline-flex; align-items: center; gap: 10px; padding: 8px 16px;` +
      ` border-radius: 12px; background: ${actionColorRaw}18; border: 1.5px solid ${actionColorRaw}55;`,
  });
  badge.appendChild(
    ui_createElement("span", {
      text: decision.action.replace("_", " "),
      styleString: DS_TYPOGRAPHY.largeValue + ` color: ${actionColor};`,
    }),
  );
  badge.appendChild(
    ui_createElement("span", {
      text: `Conviction: ${decision.conviction}/10`,
      styleString: "font-size: 12px; color: var(--ios-text-secondary);",
    }),
  );

  badgeRow.appendChild(badge);

  const metaBadge = (label: string, value: string) =>
    ui_createElement("div", {
      styleString:
        "padding: 5px 10px; background: var(--ios-light-gray); border-radius: 8px;" +
        " display: flex; flex-direction: column; align-items: center; gap: 1px;",
      children: [
        ui_createElement("span", {
          text: label,
          styleString:
            DS_TYPOGRAPHY.metricLabelMini + " letter-spacing: 0.3px;",
        }),
        ui_createElement("span", {
          text: value,
          styleString: DS_TYPOGRAPHY.metricValue + " font-size: 12px;",
        }),
      ],
    });

  badgeRow.appendChild(
    metaBadge("Horizon", decision.timeHorizon.replace("_", " ")),
  );
  badgeRow.appendChild(metaBadge("Risk", decision.riskLevel));
  if (decision.targetPrice != null) {
    badgeRow.appendChild(
      metaBadge("Target", "$" + decision.targetPrice.toFixed(2)),
    );
  }
  if (decision.stopLoss != null) {
    badgeRow.appendChild(metaBadge("Stop", "$" + decision.stopLoss.toFixed(2)));
  }
  if (marketData) {
    badgeRow.appendChild(
      metaBadge(
        "Data",
        formatTimeAgo(marketData.fetchedAt, { includeJustNow: false }),
      ),
    );
  }

  panel.appendChild(badgeRow);

  // Summary text (rendered as markdown)
  const summaryEl = ui_createElement("div", {
    styleString:
      "font-size: 13px; color: var(--ios-text-primary); line-height: 1.5; margin: 0;" +
      " padding: 10px 12px; background: var(--ax-bg-glass-inset); border-radius: 8px;",
  });
  summaryEl.innerHTML = renderMarkdown(decision.summary);
  panel.appendChild(summaryEl);

  // Bull / Bear / Risk point lists
  const addList = (title: string, points: string[], color: string) => {
    if (!points || points.length === 0) return;
    const section = ui_createElement("div", {
      styleString: "display: flex; flex-direction: column; gap: 6px;",
    });
    section.appendChild(
      ui_createElement("span", {
        text: title,
        styleString: `font-size: 11px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 0.3px;`,
      }),
    );
    const ul = ui_createElement("ul", {
      styleString:
        "margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 4px;",
    });
    for (const p of points) {
      ul.appendChild(
        ui_createElement("li", {
          text: p,
          styleString:
            "font-size: 12px; color: var(--ios-text-secondary); line-height: 1.4;",
        }),
      );
    }
    section.appendChild(ul);
    panel.appendChild(section);
  };

  addList("Bull Case", decision.keyBullPoints, DS_COLORS.positive);
  addList("Bear Case", decision.keyBearPoints, DS_COLORS.negative);
  addList("Risk Factors", decision.riskFactors, DS_COLORS.neutral);

  return panel;
}
