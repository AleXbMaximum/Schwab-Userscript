import { ui_createElement } from "../../../components/core/createElement";
import { ds_signColorRaw, DS_COLORS, DS_TYPOGRAPHY } from "../../../components/core/theme";
import type { RiskMetrics } from "../../../../backend/computation/risk/RiskMetricsCalculator";
import type{ PortfolioAgg } from "../../../../shared/types/derived";
import {
  formatCurrencyLocale as fmtCurrencyLocale,
  formatPct as fmtPctShared,
} from "shared/utils/formatters";
import { isShareMasked, shareScaleValue, SHARE_MASKED_TEXT } from "shared/utils/globalShareMode";

type PortfolioStateVectorPayload = {
  riskMetrics: RiskMetrics;
  portfolioAgg?: PortfolioAgg | null;
  timestamp?: string | null;
};

type Regime = {
  label: string;
  color: string;
  bg: string;
};

function fmtPct(v: number | null | undefined, decimals = 1): string {
  return fmtPctShared(v, { decimals, nullText: "0.0%" });
}

function fmtSignedCurrency(v: number | null | undefined, decimals = 0): string {
  if (isShareMasked()) return SHARE_MASKED_TEXT;
  const n = Number(shareScaleValue(v) ?? 0);
  const sign = n > 0 ? "+" : "";
  return sign + fmtCurrencyLocale(n, decimals);
}

function fmtPortfolioValue(v: number | null | undefined, decimals = 0): string {
  if (isShareMasked()) return SHARE_MASKED_TEXT;
  return fmtCurrencyLocale(Number(shareScaleValue(v) ?? 0), decimals);
}

function computeRegime(metrics: RiskMetrics): Regime {
  const breaches = metrics.limitBreaches.length;
  if (
    breaches >= 2 ||
    metrics.marginUtilizationPct > 0.92 ||
    metrics.currentBeta > 1.4
  ) {
    return {
      label: "Defensive",
      color: DS_COLORS.negative,
      bg: "rgba(215, 49, 38, 0.12)",
    };
  }
  if (
    breaches > 0 ||
    metrics.marginUtilizationPct > 0.78 ||
    metrics.currentBeta > 1.15
  ) {
    return {
      label: "Cautious",
      color: DS_COLORS.neutral,
      bg: "rgba(215, 129, 0, 0.14)",
    };
  }
  return {
    label: "Balanced",
    color: DS_COLORS.positive,
    bg: "rgba(32, 169, 69, 0.14)",
  };
}

function formatAsOfLabel(timestamp?: string | null): string {
  if (!timestamp) return "--";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return timestamp;
  return d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour12: false,
  });
}

export function renderPortfolioStateVector(
  payload: PortfolioStateVectorPayload,
): HTMLElement & {
  cleanup?: () => void;
  update?: (next: PortfolioStateVectorPayload) => void;
} {
  const bar = ui_createElement("div", {
    styleString:
      "position: sticky; top: 0; z-index: var(--z-sticky-state, 120);" +
      " background: var(--ax-glass-2-bg);" +
      " -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
      " backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
      " border-bottom: 1px solid var(--ax-border-subtle);" +
      " padding: 8px 16px 6px; font-family: var(--ax-font-body);",
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (next: PortfolioStateVectorPayload) => void;
  };

  const titleRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;",
  });

  const title = ui_createElement("div", {
    text: "PORTFOLIO STATE VECTOR",
    styleString:
      "font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;" +
      " color: var(--ios-text-secondary);",
  });

  const regimeBadge = ui_createElement("span", {
    styleString:
      "display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 6px;" +
      " font-size: 10px; font-weight: 700; letter-spacing: 0.3px;",
  });

  titleRow.appendChild(title);
  titleRow.appendChild(regimeBadge);
  bar.appendChild(titleRow);

  const metricsRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: stretch; gap: 12px; flex-wrap: wrap;",
  });
  bar.appendChild(metricsRow);

  const metricEls: Record<string, HTMLElement> = {};

  const addMetric = (id: string, label: string) => {
    const wrapper = ui_createElement("div", {
      styleString:
        "display: flex; flex-direction: column; gap: 1px; min-width: 110px;",
    });
    wrapper.appendChild(
      ui_createElement("div", {
        text: label,
        styleString:
          "font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px;" +
          " color: var(--ios-text-secondary); line-height: 1.2;",
      }),
    );
    const valueEl = ui_createElement("div", {
      text: "--",
      styleString:
        DS_TYPOGRAPHY.heading +
        " white-space: nowrap; font-variant-numeric: tabular-nums;",
    });
    metricEls[id] = valueEl;
    wrapper.appendChild(valueEl);
    metricsRow.appendChild(wrapper);
  };

  addMetric("marketValue", "Portfolio Value");
  addMetric("marginUtil", "Margin Utilization");
  addMetric("beta", "Beta");
  addMetric("netDelta", "Net Delta $");
  addMetric("dailyTheta", "Daily Theta");
  addMetric("optionsShare", "Options Risk Share");
  addMetric("breaches", "Limit Breaches");
  addMetric("asOf", "As Of");

  const render = (next: PortfolioStateVectorPayload) => {
    const metrics = next.riskMetrics;
    const regime = computeRegime(metrics);

    regimeBadge.textContent = regime.label;
    regimeBadge.style.color = regime.color;
    regimeBadge.style.background = regime.bg;

    metricEls.marketValue.textContent = fmtPortfolioValue(
      metrics.marketValue,
      0,
    );
    metricEls.marginUtil.textContent = fmtPct(metrics.marginUtilizationPct, 1);
    metricEls.marginUtil.style.color =
      metrics.marginUtilizationPct > 0.85
        ? DS_COLORS.negative
        : metrics.marginUtilizationPct > 0.70
          ? DS_COLORS.neutral
          : "var(--ios-text-primary)";

    metricEls.beta.textContent = metrics.currentBeta.toFixed(2);
    metricEls.beta.style.color =
      metrics.currentBeta > 1.4
        ? DS_COLORS.negative
        : metrics.currentBeta > 1.15
          ? DS_COLORS.neutral
          : "var(--ios-text-primary)";

    metricEls.netDelta.textContent = fmtSignedCurrency(
      metrics.netDeltaDollars,
      0,
    );
    metricEls.netDelta.style.color = ds_signColorRaw(metrics.netDeltaDollars);

    metricEls.dailyTheta.textContent = fmtSignedCurrency(
      metrics.dailyThetaDecay,
      0,
    );
    metricEls.dailyTheta.style.color = ds_signColorRaw(metrics.dailyThetaDecay);

    const optionsShare = next.portfolioAgg?.optionsRiskSharePct;
    metricEls.optionsShare.textContent =
      optionsShare == null ? "--" : fmtPct(optionsShare, 1);

    metricEls.breaches.textContent = String(metrics.limitBreaches.length);
    metricEls.breaches.style.color =
      metrics.limitBreaches.length > 0
        ? DS_COLORS.raw.negative
        : DS_COLORS.raw.positive;

    metricEls.asOf.textContent = formatAsOfLabel(next.timestamp);
    metricEls.asOf.style.color = "var(--ios-text-secondary)";
  };

  render(payload);

  bar.update = (next: PortfolioStateVectorPayload) => {
    render(next);
  };

  return bar;
}
