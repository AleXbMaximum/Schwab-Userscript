import { ui_createElement } from "../../../components/core/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY } from "../../../components/core/theme";
import type { TradingInsightsData, TradingInsight } from "backend/computation/options/types";

const SIGNAL_COLORS: Record<
  TradingInsight["signal"],
  { text: string; bg: string; border: string; icon: string }
> = {
  bullish: {
    text: "#20a945",
    bg: "rgba(32, 169, 69, 0.06)",
    border: "#20a945",
    icon: "\u25B2",
  },
  bearish: {
    text: "#d73126",
    bg: "rgba(215, 49, 38, 0.06)",
    border: "#d73126",
    icon: "\u25BC",
  },
  neutral: {
    text: "#D78100",
    bg: "rgba(215, 129, 0, 0.06)",
    border: "#D78100",
    icon: "\u25C6",
  },
  info: {
    text: "#007AFF",
    bg: "rgba(0, 122, 255, 0.06)",
    border: "#007AFF",
    icon: "\u2139",
  },
};

const CATEGORY_LABELS: Record<TradingInsight["category"], string> = {
  regime: "REGIME",
  direction: "DIRECTION",
  volatility: "VOLATILITY",
  levels: "KEY LEVELS",
  flow: "ORDER FLOW",
};

function fmtLevel(v: number): string {
  return `$${v.toFixed(2)}`;
}

function renderBiasGauge(
  score: number,
  bias: "bullish" | "bearish" | "neutral",
): HTMLElement {
  const container = ui_createElement("div", {
    styleString: "flex: 1; min-width: 180px;",
  });

  const biasColor =
    bias === "bullish" ? "#20a945" : bias === "bearish" ? "#d73126" : "#D78100";
  const biasLabel = bias.charAt(0).toUpperCase() + bias.slice(1);

  const labelRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px;",
  });
  labelRow.appendChild(
    ui_createElement("div", {
      text: biasLabel,
      styleString: DS_TYPOGRAPHY.largeValue + ` color: ${biasColor};`,
    }),
  );
  labelRow.appendChild(
    ui_createElement("div", {
      text: `${score > 0 ? "+" : ""}${score}`,
      styleString:
        DS_TYPOGRAPHY.heading +
        ` color: ${biasColor}; font-variant-numeric: tabular-nums;`,
    }),
  );
  container.appendChild(labelRow);

  const barContainer = ui_createElement("div", {
    styleString:
      "height: 6px; background: var(--ax-bg-glass-inset); border-radius: 4px; position: relative; overflow: hidden;",
  });

  barContainer.appendChild(
    ui_createElement("div", {
      styleString:
        "position: absolute; left: 50%; top: 0; width: 1px; height: 100%; background: var(--ax-border); transform: translateX(-50%);",
    }),
  );

  const normalizedScore = (score + 100) / 200;
  const fillLeft = Math.min(normalizedScore, 0.5);
  const fillRight = Math.max(normalizedScore, 0.5);
  const fillColor = score > 0 ? "#20a945" : score < 0 ? "#d73126" : "#D78100";

  barContainer.appendChild(
    ui_createElement("div", {
      styleString:
        `position: absolute; top: 0; height: 100%; border-radius: 4px;` +
        ` left: ${fillLeft * 100}%; width: ${(fillRight - fillLeft) * 100}%;` +
        ` background: ${fillColor}; opacity: 0.6;` /* DS_OPACITY.dim */,
    }),
  );

  container.appendChild(barContainer);

  const scaleRow = ui_createElement("div", {
    styleString:
      "display: flex; justify-content: space-between; margin-top: 2px;",
  });
  scaleRow.appendChild(
    ui_createElement("span", {
      text: "Bearish",
      styleString: "font-size: 10px; color: #d73126; font-weight: 600;",
    }),
  );
  scaleRow.appendChild(
    ui_createElement("span", {
      text: "Bullish",
      styleString: "font-size: 10px; color: #20a945; font-weight: 600;",
    }),
  );
  container.appendChild(scaleRow);

  return container;
}

function renderKeyLevelsBar(
  levels: TradingInsightsData["keyLevels"],
): HTMLElement {
  const container = ui_createElement("div", {
    styleString: "flex: 1.5; min-width: 250px;",
  });

  const entries: { label: string; value: number; color: string }[] = [];
  if (levels.putWall != null)
    entries.push({
      label: "Put Wall",
      value: levels.putWall,
      color: "#d73126",
    });
  if (levels.maxPain != null)
    entries.push({
      label: "Max Pain",
      value: levels.maxPain,
      color: "#D78100",
    });
  if (levels.gammaFlip != null)
    entries.push({
      label: "\u03B3 Flip",
      value: levels.gammaFlip,
      color: "#8E44AD",
    });
  if (levels.spot != null)
    entries.push({ label: "Spot", value: levels.spot, color: "#007AFF" });
  if (levels.callWall != null)
    entries.push({
      label: "Call Wall",
      value: levels.callWall,
      color: "#20a945",
    });

  if (entries.length === 0) return container;

  entries.sort((a, b) => a.value - b.value);

  const min = entries[0].value;
  const max = entries[entries.length - 1].value;
  const range = max - min || 1;

  const MIN_GAP_PCT = 12;
  const positioned = entries.map((entry) => ({
    ...entry,
    pct: ((entry.value - min) / range) * 100,
    above: false,
  }));

  for (let i = 1; i < positioned.length; i++) {
    const overlapsLevel = (level: boolean) =>
      positioned
        .slice(0, i)
        .some(
          (p) =>
            p.above === level &&
            Math.abs(p.pct - positioned[i].pct) < MIN_GAP_PCT,
        );
    if (overlapsLevel(false)) {
      positioned[i].above = true;
      if (overlapsLevel(true)) {
        const minGapAt = (level: boolean) =>
          Math.min(
            ...positioned
              .slice(0, i)
              .filter((p) => p.above === level)
              .map((p) => Math.abs(p.pct - positioned[i].pct)),
          );
        positioned[i].above = minGapAt(true) > minGapAt(false);
      }
    }
  }

  const hasAbove = positioned.some((p) => p.above);
  const lineTop = hasAbove ? 30 : 12;
  const barHeight = hasAbove ? 62 : 40;

  container.appendChild(
    ui_createElement("div", {
      text: "KEY PRICE LEVELS",
      styleString:
        "font-size: 10px; font-weight: 700; color: var(--ios-text-secondary); letter-spacing: 0.5px; margin-bottom: 8px;",
    }),
  );

  const barWrapper = ui_createElement("div", {
    styleString: `position: relative; height: ${barHeight}px; margin: 0 24px;`,
  });

  barWrapper.appendChild(
    ui_createElement("div", {
      styleString: `position: absolute; top: ${lineTop}px; left: 0; right: 0; height: 2px; background: var(--ax-border); border-radius: 1px;`,
    }),
  );

  for (const p of positioned) {
    const isSpot = p.label === "Spot";
    const dotSize = isSpot ? 10 : 7;

    if (p.above) {
      const marker = ui_createElement("div", {
        styleString: `position: absolute; top: ${lineTop}px; left: ${p.pct}%; transform: translate(-50%, -100%); text-align: center;`,
      });

      marker.appendChild(
        ui_createElement("div", {
          text: `${p.label}\n${fmtLevel(p.value)}`,
          styleString: `font-size: 10px; font-weight: 600; color: ${p.color}; white-space: pre; line-height: 1.2; margin-bottom: 2px;`,
        }),
      );

      marker.appendChild(
        ui_createElement("div", {
          styleString:
            `width: ${dotSize}px; height: ${dotSize}px;` +
            ` border-radius: 50%; background: ${p.color}; margin: 0 auto;` +
            (isSpot ? " box-shadow: 0 0 0 2px rgba(0,122,255,0.3);" : ""),
        }),
      );

      barWrapper.appendChild(marker);
    } else {
      const marker = ui_createElement("div", {
        styleString: `position: absolute; top: ${lineTop - 8}px; left: ${p.pct}%; transform: translateX(-50%); text-align: center;`,
      });

      marker.appendChild(
        ui_createElement("div", {
          styleString:
            `width: ${dotSize}px; height: ${dotSize}px;` +
            ` border-radius: 50%; background: ${p.color}; margin: 0 auto 2px;` +
            (isSpot ? " box-shadow: 0 0 0 2px rgba(0,122,255,0.3);" : ""),
        }),
      );

      marker.appendChild(
        ui_createElement("div", {
          text: `${p.label}\n${fmtLevel(p.value)}`,
          styleString: `font-size: 10px; font-weight: 600; color: ${p.color}; white-space: pre; line-height: 1.2;`,
        }),
      );

      barWrapper.appendChild(marker);
    }
  }

  container.appendChild(barWrapper);

  return container;
}

function renderInsightCard(insight: TradingInsight): HTMLElement {
  const colors = SIGNAL_COLORS[insight.signal];
  const catLabel = CATEGORY_LABELS[insight.category];

  const card = ui_createElement("div", {
    styleString:
      `padding: 8px 12px; border-radius: 8px; border-left: 3px solid ${colors.border};` +
      ` background: ${colors.bg}; margin-bottom: 5px; cursor: pointer;`,
  });

  const header = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 6px;",
  });

  header.appendChild(
    ui_createElement("span", {
      text: catLabel,
      styleString:
        "font-size: 9px; font-weight: 700; letter-spacing: 0.5px; padding: 2px 6px; border-radius: 4px;" +
        ` background: ${colors.border}; color: #fff;`,
    }),
  );

  header.appendChild(
    ui_createElement("span", {
      text: `${colors.icon} ${insight.title}`,
      styleString: `font-size: 13px; font-weight: 700; color: ${colors.text};`,
    }),
  );

  card.appendChild(header);

  const descEl = ui_createElement("div", {
    text: insight.description,
    styleString:
      "font-size: 12px; color: var(--ios-text-secondary); line-height: 1.4; margin-top: 4px;" +
      " display: none;",
  });
  card.appendChild(descEl);

  card.addEventListener("click", () => {
    const isHidden = descEl.style.display === "none";
    descEl.style.display = isHidden ? "" : "none";
  });

  return card;
}

export function renderTradingInsights(
  data: TradingInsightsData,
): HTMLElement & {
  cleanup?: () => void;
  update?: (d: TradingInsightsData) => void;
} {
  const panel = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (d: TradingInsightsData) => void;
  };

  panel.appendChild(
    ui_createElement("h3", {
      text: "Option Insights",
      styleString: DS_TYPOGRAPHY.panelTitle,
    }),
  );
  panel.appendChild(
    ui_createElement("div", {
      text: "Automated analysis based on options positioning, flow, and volatility structure. Not financial advice.",
      styleString: DS_TYPOGRAPHY.panelDesc,
    }),
  );

  const contentEl = ui_createElement("div", {});
  panel.appendChild(contentEl);

  const render = (d: TradingInsightsData) => {
    contentEl.innerHTML = "";

    const topRow = ui_createElement("div", {
      styleString:
        "display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 8px;",
    });
    topRow.appendChild(renderBiasGauge(d.biasScore, d.overallBias));
    topRow.appendChild(renderKeyLevelsBar(d.keyLevels));
    contentEl.appendChild(topRow);

    const cardsContainer = ui_createElement("div", {
      styleString: "margin-top: 8px;",
    });
    for (const insight of d.insights) {
      cardsContainer.appendChild(renderInsightCard(insight));
    }
    contentEl.appendChild(cardsContainer);
  };

  render(data);

  panel.update = (d: TradingInsightsData) => render(d);

  return panel;
}
