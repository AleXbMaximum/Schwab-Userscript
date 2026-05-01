import { ui_createElement } from "../../../components/core/createElement";
import { ds_severityColors } from "../../../components/core/theme";
import type {
  BetaFactorScenarioResult,
  ScenarioModelType,
} from "../../../../backend/computation/risk/RiskMetricsCalculator";
import type { ThreeFactorBundle } from "../../../../backend/computation/beta/types";

export function createModelExplanation(
  scenarios: BetaFactorScenarioResult[],
  modelType: ScenarioModelType,
  threeFactorData?: Map<string, ThreeFactorBundle> | null,
): HTMLElement {
  const avgR2 =
    scenarios.length > 0
      ? scenarios.reduce((s, sc) => s + sc.modelExplainedPct, 0) /
        scenarios.length
      : 0;
  const avgCovered =
    scenarios.length > 0
      ? scenarios.reduce((s, sc) => s + sc.coveredPct, 0) / scenarios.length
      : 0;
  const avgResidual = Math.max(0, 1 - avgR2);
  const avgConf =
    scenarios.length > 0 ? scenarios[0].confidenceLevel : "medium";

  // Count actual model usage across first scenario's positions
  const positions = scenarios.length > 0 ? scenarios[0].positions : [];
  const tfUsed = positions.filter((p) => p.modelUsed === "threeFactor").length;
  const ancUsed = positions.filter((p) => p.modelUsed === "anchor").length;
  const allFallback = modelType === "threeFactor" && tfUsed === 0;

  const container = ui_createElement("div", {
    styleString:
      "font-size: 11px; color: var(--ios-text-secondary); line-height: 1.5;" +
      " padding: 8px 10px; border-radius: 8px; background: var(--ax-bg-glass-inset);" +
      " border: 1px dashed var(--ax-border); margin-top: 10px;",
  });

  if (modelType === "threeFactor") {
    container.appendChild(
      ui_createElement("div", {
        text: "3-Factor Orthogonal Model",
        styleString:
          "font-weight: 700; font-size: 12px; color: var(--ios-text-primary); margin-bottom: 3px;",
      }),
    );

    if (allFallback && threeFactorData === null) {
      // Data hasn't been computed yet — show loading status
      const infoColors = ds_severityColors("info");
      container.appendChild(
        ui_createElement("div", {
          text: "Computing three-factor betas — results will appear after the next beta refresh cycle.",
          styleString:
            `padding: 5px 8px; border-radius: 6px; margin-bottom: 4px; font-weight: 500;` +
            ` background: ${infoColors.bg}; color: ${infoColors.text}; border: 1px solid ${infoColors.border};`,
        }),
      );
    } else if (allFallback) {
      // Data was computed but all positions fell back to anchor
      const warnColors = ds_severityColors("warning");
      container.appendChild(
        ui_createElement("div", {
          text:
            "Three-factor data not yet available — all positions using anchor (SPX β) fallback. " +
            'Try clicking "Recalculate Now" in Beta Calculation settings, or wait for the next beta refresh cycle.',
          styleString:
            `padding: 5px 8px; border-radius: 6px; margin-bottom: 4px; font-weight: 500;` +
            ` background: ${warnColors.bg}; color: ${warnColors.text}; border: 1px solid ${warnColors.border};`,
        }),
      );
    } else {
      container.appendChild(
        ui_createElement("div", {
          text: `r_stock = α + β₁·r_SPX + β₂·(r_NDX-r_SPX) + β₃·(r_DJI-r_SPX) + ε`,
          styleString:
            "font-family: ui-monospace, monospace; font-size: 11px; margin-bottom: 4px; color: var(--ios-text-primary);",
        }),
      );
      container.appendChild(
        ui_createElement("div", {
          text:
            `Explains ${(avgR2 * 100).toFixed(0)}% of portfolio variance (${(avgResidual * 100).toFixed(0)}% idiosyncratic). ` +
            `3F: ${tfUsed}, Anchor fallback: ${ancUsed}. Coverage: ${(avgCovered * 100).toFixed(0)}%. Confidence: ${avgConf}.`,
        }),
      );
    }
    container.appendChild(
      ui_createElement("div", {
        text: "Three orthogonal factors decompose moves into broad market direction (SPX), tech tilt (NDX-SPX), and cyclical tilt (DJI-SPX).",
        styleString: "margin-top: 3px; font-style: italic;",
      }),
    );
  } else {
    container.appendChild(
      ui_createElement("div", {
        text: "Anchor Model (SPX β)",
        styleString:
          "font-weight: 700; font-size: 12px; color: var(--ios-text-primary); margin-bottom: 3px;",
      }),
    );
    container.appendChild(
      ui_createElement("div", {
        text: `r_stock = α + β·r_SPX + ε`,
        styleString:
          "font-family: ui-monospace, monospace; font-size: 11px; margin-bottom: 4px; color: var(--ios-text-primary);",
      }),
    );
    container.appendChild(
      ui_createElement("div", {
        text: `Single-factor SPX beta. R²: ${(avgR2 * 100).toFixed(0)}%. Coverage: ${(avgCovered * 100).toFixed(0)}%.`,
      }),
    );
    container.appendChild(
      ui_createElement("div", {
        text: "Simple and robust but ignores sector/style tilts. Switch to 3-Factor for richer multi-index decomposition.",
        styleString: "margin-top: 3px; font-style: italic;",
      }),
    );
  }

  return container;
}

export function createStabilityWarnings(
  scenarios: BetaFactorScenarioResult[],
  modelType: ScenarioModelType,
): HTMLElement | null {
  if (modelType !== "threeFactor") return null;
  if (scenarios.length === 0) return null;

  const warnings: string[] = [];

  const allPositions = scenarios[0].positions;
  const tfPositions = allPositions.filter((p) => p.modelUsed === "threeFactor");
  const ancFallback = allPositions.filter((p) => p.modelUsed === "anchor");

  if (tfPositions.length === 0) {
    // No 3-factor positions are active — primary warning is shown in banner.
    return null;
  }

  if (ancFallback.length > 0 && tfPositions.length > 0) {
    warnings.push(
      `${ancFallback.length} position(s) fell back to anchor β (no 3-factor data).`,
    );
  }

  if (tfPositions.length > 0) {
    const smallSample = tfPositions.filter((p) => p.sampleSize < 30);
    if (smallSample.length > 0) {
      warnings.push(
        `${smallSample.length} position(s) with <30 data points — factor estimates may be unstable.`,
      );
    }
    const lowR2 = tfPositions.filter((p) => p.rSquared < 0.15);
    if (lowR2.length > 0) {
      warnings.push(
        `${lowR2.length} position(s) with R²<15% — model explains little variance.`,
      );
    }
    const highResidual = tfPositions.filter((p) => p.residualStd > 0.05);
    if (highResidual.length > 0) {
      warnings.push(
        `${highResidual.length} position(s) with high residual volatility (>5%/day).`,
      );
    }
  }

  if (scenarios[0].coveredPct < 0.70) {
    warnings.push(
      `Only ${(scenarios[0].coveredPct * 100).toFixed(0)}% of notional is covered by the model.`,
    );
  }

  if (warnings.length === 0) return null;

  const warnColors = ds_severityColors("warning");
  const container = ui_createElement("div", {
    styleString:
      `font-size: 11px; line-height: 1.4; padding: 6px 10px; border-radius: 8px;` +
      ` background: ${warnColors.bg}; border: 1px solid ${warnColors.border};` +
      ` color: ${warnColors.text}; margin-top: 8px;`,
  });
  container.appendChild(
    ui_createElement("div", {
      text: "Stability Warnings",
      styleString: "font-weight: 700; margin-bottom: 3px;",
    }),
  );
  for (const w of warnings) {
    container.appendChild(
      ui_createElement("div", {
        text: `• ${w}`,
        styleString: "margin-left: 4px;",
      }),
    );
  }
  return container;
}
