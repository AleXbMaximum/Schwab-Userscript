import { ui_createElement } from "../../../components/core/builders/createElement";
import {
  DS_COMPONENTS,
  DS_TYPOGRAPHY,
  DS_COLORS,
  ds_signColorRaw,
  ds_severityColors,
} from "../../../components/core/styles/theme";
import { getLayoutMode } from "../../../components/core/behaviors/layoutMode";
import { ui_collapsible } from "../../../components/core/builders/ui_builders";
import type {
  RiskMetrics,
  BetaFactorScenarioResult,
  BetaFactorScenarioInput,
  ScenarioModelType,
} from "../../../../backend/computation/risk/RiskMetricsCalculator";
import type {
  ThreeFactorBundle,
  TickerBetaBundle,
  BetaHorizon,
} from "../../../../backend/computation/beta/types";
import type{ UnderlyingAggRow } from "../../../../shared/types/derived";
import { formatCurrencyLocale as fmtCurrencyLocale } from "shared/utils/format/formatters";
import { isShareMasked, shareScaleValue, SHARE_MASKED_TEXT } from "shared/utils/domain/globalShareMode";
import { createCustomScenarioBuilder } from "./CustomScenarioBuilder";
import { createPositionDrillDown } from "./PositionDrillDown";
import {
  createModelExplanation,
  createStabilityWarnings,
} from "./ModelExplanation";

export type ScenarioCardPayload = {
  riskMetrics: RiskMetrics;
  modelType: ScenarioModelType;
  horizon: BetaHorizon;
  byUnderlying: Record<string, UnderlyingAggRow>;
  threeFactorData: Map<string, ThreeFactorBundle> | null;
  allBenchmarkBetas: Map<string, Map<string, TickerBetaBundle>> | null;
  onModelTypeChange: (type: ScenarioModelType) => void;
  onHorizonChange: (horizon: BetaHorizon) => void;
  onCustomScenarioChange: (input: BetaFactorScenarioInput | null) => void;
};

type PanelElement = HTMLElement & {
  cleanup?: () => void;
  update?: (payload: ScenarioCardPayload) => void;
};

import { formatPct } from "shared/utils/format/formatters";
const fmtPnl = (v: number): string =>
  isShareMasked() ? SHARE_MASKED_TEXT : fmtCurrencyLocale(shareScaleValue(v) as number, 0);
const fmtPct = (v: number): string => formatPct(v, { showSign: true });
const fmtMove = (v: number): string => `${v >= 0 ? "+" : ""}${v}%`;
const CUSTOM_SCENARIO_NAME = "custom";

const HORIZON_LABELS: Record<BetaHorizon, string> = {
  ultraShort: "1D",
  week: "1W",
  short: "1M",
  medium: "6M",
  long: "2Y",
};

const CONFIDENCE_LABELS: Record<
  string,
  { label: string; severity: "critical" | "warning" | "info" }
> = {
  high: { label: "High", severity: "info" },
  medium: { label: "Medium", severity: "warning" },
  low: { label: "Low", severity: "critical" },
};

const PILL_STYLE =
  "padding: 3px 10px; font-size: 11px; font-weight: 600; border-radius: 6px; cursor: pointer;" +
  " border: 1px solid var(--ios-border); transition: all 0.15s;";
const PILL_ACTIVE =
  " background: var(--ax-blue); color: #fff; border-color: var(--ax-blue);";
const PILL_INACTIVE =
  " background: transparent; color: var(--ios-text-secondary);";

function getScenarioCardsInDisplayOrder(
  scenarioResults: BetaFactorScenarioResult[],
): BetaFactorScenarioResult[] {
  const customIndex = scenarioResults.findIndex((scenario) => {
    const inputName = scenario.input?.name?.trim().toLowerCase();
    const resultName = scenario.name?.trim().toLowerCase();
    return (
      inputName === CUSTOM_SCENARIO_NAME || resultName === CUSTOM_SCENARIO_NAME
    );
  });
  if (customIndex <= 0) return scenarioResults;

  const reordered = scenarioResults.slice();
  const [customScenario] = reordered.splice(customIndex, 1);
  if (!customScenario) return scenarioResults;
  reordered.unshift(customScenario);
  return reordered;
}

function createControlsRow(payload: ScenarioCardPayload): HTMLElement {
  const row = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;",
  });

  // Model type pills
  const modelGroup = ui_createElement("div", {
    styleString: "display: flex; align-items: center; gap: 6px;",
  });
  modelGroup.appendChild(
    ui_createElement("span", {
      text: "Model:",
      styleString:
        "font-size: 11px; color: var(--ios-text-secondary); font-weight: 600;",
    }),
  );

  const models: { key: ScenarioModelType; label: string }[] = [
    { key: "anchor", label: "Anchor" },
    { key: "threeFactor", label: "3-Factor" },
  ];
  for (const m of models) {
    const active = m.key === payload.modelType;
    const btn = ui_createElement("button", {
      text: m.label,
      props: { type: "button" },
      styleString: PILL_STYLE + (active ? PILL_ACTIVE : PILL_INACTIVE),
    });
    btn.addEventListener("click", () => payload.onModelTypeChange(m.key));
    modelGroup.appendChild(btn);
  }
  row.appendChild(modelGroup);

  // Horizon pills
  const horizonGroup = ui_createElement("div", {
    styleString: "display: flex; align-items: center; gap: 6px;",
  });
  horizonGroup.appendChild(
    ui_createElement("span", {
      text: "Horizon:",
      styleString:
        "font-size: 11px; color: var(--ios-text-secondary); font-weight: 600;",
    }),
  );

  const horizons: BetaHorizon[] = ["ultraShort", "short", "medium", "long"];
  for (const h of horizons) {
    const active = h === payload.horizon;
    const btn = ui_createElement("button", {
      text: HORIZON_LABELS[h],
      props: { type: "button" },
      styleString: PILL_STYLE + (active ? PILL_ACTIVE : PILL_INACTIVE),
    });
    btn.addEventListener("click", () => payload.onHorizonChange(h));
    horizonGroup.appendChild(btn);
  }
  row.appendChild(horizonGroup);

  return row;
}

function createScenarioCard(
  scenario: BetaFactorScenarioResult,
  modelType: ScenarioModelType,
): HTMLElement {
  const isPositive = scenario.portfolioPnl >= 0;
  const borderColor = isPositive
    ? "rgba(32,169,69,0.3)"
    : "rgba(215,49,38,0.3)";
  const bgColor = isPositive ? "rgba(32,169,69,0.04)" : "rgba(215,49,38,0.04)";

  const card = ui_createElement("div", {
    styleString:
      `padding: 10px 12px; border-radius: 10px; border: 1px solid ${borderColor};` +
      ` background: ${bgColor}; min-width: 200px;`,
  });

  // Header
  const header = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px;",
  });
  header.appendChild(
    ui_createElement("div", {
      text: scenario.name,
      styleString:
        "font-size: 13px; font-weight: 700; color: var(--ios-text-primary);",
    }),
  );
  // Confidence badge
  const conf =
    CONFIDENCE_LABELS[scenario.confidenceLevel] ?? CONFIDENCE_LABELS.medium;
  const confColors = ds_severityColors(conf.severity);
  header.appendChild(
    ui_createElement("span", {
      text: conf.label,
      styleString:
        `font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px;` +
        ` background: ${confColors.bg}; color: ${confColors.text}; border: 1px solid ${confColors.border};`,
    }),
  );
  card.appendChild(header);

  // Assumptions
  const { input } = scenario;
  card.appendChild(
    ui_createElement("div", {
      text: `SPX ${fmtMove(input.spxMove)} · NDX ${fmtMove(input.ndxMove)} · DJI ${fmtMove(input.djiMove)}`,
      styleString:
        "font-size: 11px; color: var(--ios-text-secondary); margin-bottom: 2px;",
    }),
  );
  card.appendChild(
    ui_createElement("div", {
      text: `Vol ${fmtMove(input.volShift)}pt · ${input.horizonDays}D`,
      styleString:
        "font-size: 11px; color: var(--ios-text-secondary); margin-bottom: 6px;",
    }),
  );

  // P&L
  card.appendChild(
    ui_createElement("div", {
      text: `${fmtPnl(scenario.portfolioPnl)}  (${fmtPct(scenario.portfolioPnlPct)})`,
      styleString: `font-size: 15px; font-weight: 800; color: ${ds_signColorRaw(scenario.portfolioPnl)}; margin-bottom: 6px; font-variant-numeric: tabular-nums;`,
    }),
  );

  // Top contributors (top 3 by positive P&L)
  const topContrib = scenario.positions
    .filter((p) => p.totalPnl > 0)
    .sort((a, b) => b.totalPnl - a.totalPnl)
    .slice(0, 3);
  if (topContrib.length > 0) {
    card.appendChild(
      ui_createElement("div", {
        text: "Top contributors",
        styleString:
          "font-size: 11px; font-weight: 600; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;",
      }),
    );
    for (const p of topContrib) {
      card.appendChild(
        ui_createElement("div", {
          text: `${p.underlyingKey}  ${fmtPnl(p.totalPnl)}  (${fmtPct(p.predictedReturn)})`,
          styleString: `font-size: 11px; color: ${DS_COLORS.positive}; font-variant-numeric: tabular-nums; line-height: 1.4;`,
        }),
      );
    }
  }

  // Worst offenders (top 3 by negative P&L)
  const worstOffend = scenario.positions
    .filter((p) => p.totalPnl < 0)
    .sort((a, b) => a.totalPnl - b.totalPnl)
    .slice(0, 3);
  if (worstOffend.length > 0) {
    card.appendChild(
      ui_createElement("div", {
        text: "Worst offenders",
        styleString:
          "font-size: 11px; font-weight: 600; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; margin-bottom: 3px;",
      }),
    );
    for (const p of worstOffend) {
      card.appendChild(
        ui_createElement("div", {
          text: `${p.underlyingKey}  ${fmtPnl(p.totalPnl)}  (${fmtPct(p.predictedReturn)})`,
          styleString: `font-size: 11px; color: ${DS_COLORS.negative}; font-variant-numeric: tabular-nums; line-height: 1.4;`,
        }),
      );
    }
  }

  // Residual / unexplained row
  const residualPct = scenario.weightedResidualPct;
  card.appendChild(
    ui_createElement("div", {
      text: `Unexplained: ${(residualPct * 100).toFixed(0)}% idiosyncratic`,
      styleString:
        `font-size: 11px; color: ${residualPct > 0.50 ? DS_COLORS.raw.neutral : "var(--ios-text-secondary)"};` +
        " margin-top: 4px; font-weight: 500;",
    }),
  );

  // Confidence footer: coverage + actual model distribution
  const tfCount = scenario.positions.filter(
    (p) => p.modelUsed === "threeFactor",
  ).length;
  const ancCount = scenario.positions.filter(
    (p) => p.modelUsed === "anchor",
  ).length;

  const footerRow = ui_createElement("div", {
    styleString:
      "display: flex; justify-content: space-between; flex-wrap: wrap; gap: 2px;" +
      " font-size: 11px; color: var(--ios-text-secondary);" +
      " margin-top: 6px; padding-top: 5px; border-top: 1px solid var(--ax-border-subtle);",
  });
  footerRow.appendChild(
    ui_createElement("span", {
      text: `Coverage: ${scenario.coveredCount}/${scenario.totalCount} (${(scenario.coveredPct * 100).toFixed(0)}%)`,
    }),
  );
  if (modelType === "threeFactor") {
    const modelDistText =
      tfCount > 0
        ? `3F: ${tfCount} · Anc: ${ancCount} · R²: ${(scenario.modelExplainedPct * 100).toFixed(0)}%`
        : `All anchor fallback · R²: ${(scenario.modelExplainedPct * 100).toFixed(0)}%`;
    footerRow.appendChild(
      ui_createElement("span", {
        text: modelDistText,
        styleString: tfCount === 0 ? `color: ${DS_COLORS.raw.neutral};` : "",
      }),
    );
  } else {
    footerRow.appendChild(
      ui_createElement("span", {
        text: `Anchor (SPX β) · R²: ${(scenario.modelExplainedPct * 100).toFixed(0)}%`,
      }),
    );
  }
  card.appendChild(footerRow);

  // Collapsible drill-down
  const drillDownBody = createPositionDrillDown(scenario.positions);
  const drillDown = ui_collapsible({
    headerChildren: [
      ui_createElement("span", {
        text: "Position Breakdown",
        styleString:
          "font-size: 11px; font-weight: 600; color: var(--ios-text-secondary); flex: 1;",
      }),
    ],
    body: drillDownBody,
    defaultExpanded: false,
  });
  drillDown.style.marginTop = "6px";
  card.appendChild(drillDown);

  return card;
}

export function renderScenarioCardPanel(
  payload: ScenarioCardPayload,
): PanelElement {
  const panel = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as PanelElement;

  // Title
  panel.appendChild(
    ui_createElement("h3", {
      text: "Scenarios",
      styleString: DS_TYPOGRAPHY.panelTitle,
    }),
  );

  // Description
  panel.appendChild(
    ui_createElement("div", {
      text: "Three-index factor scenarios with full Greek decomposition (Δ + Γ + Vega + Θ).",
      styleString: DS_TYPOGRAPHY.panelDesc,
    }),
  );

  const scenarioResults = payload.riskMetrics.betaFactorScenarios;
  const isMobileLayout = getLayoutMode() === "mobile";

  const contentLayout = ui_createElement("div", {
    styleString: isMobileLayout
      ? "display: flex; flex-direction: column; gap: 10px;"
      : "display: grid; grid-template-columns: minmax(360px, 460px) minmax(0, 1fr); gap: 12px; align-items: start;",
  });

  const leftColumn = ui_createElement("div", {
    styleString:
      "display: flex; flex-direction: column; gap: 10px; min-width: 0;",
  });
  leftColumn.appendChild(createControlsRow(payload));
  leftColumn.appendChild(createCustomScenarioBuilder(payload));
  leftColumn.appendChild(
    createModelExplanation(
      scenarioResults,
      payload.modelType,
      payload.threeFactorData,
    ),
  );
  const stabilityEl = createStabilityWarnings(
    scenarioResults,
    payload.modelType,
  );
  if (stabilityEl) leftColumn.appendChild(stabilityEl);
  contentLayout.appendChild(leftColumn);

  const rightColumn = ui_createElement("div", {
    styleString: "min-width: 0;",
  });
  const cardsGrid = ui_createElement("div", {
    styleString: isMobileLayout
      ? "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;"
      : "display: grid; grid-auto-flow: column; grid-auto-columns: minmax(220px, 1fr); gap: 10px; overflow-x: auto; padding-bottom: 2px;",
  });
  const cardResults = getScenarioCardsInDisplayOrder(scenarioResults);
  for (const result of cardResults) {
    cardsGrid.appendChild(createScenarioCard(result, payload.modelType));
  }
  rightColumn.appendChild(cardsGrid);
  contentLayout.appendChild(rightColumn);

  panel.appendChild(contentLayout);

  panel.update = (next: ScenarioCardPayload) => {
    const parent = panel.parentElement;
    if (!parent) return;
    const newPanel = renderScenarioCardPanel(next);
    parent.replaceChild(newPanel, panel);
    (panel as any).__replaced = newPanel;
  };

  return panel;
}
