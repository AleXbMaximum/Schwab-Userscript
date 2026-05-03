/**
 * Shared factory for horizontal-bar breakdown panels.
 *
 * Both ExposureBreakdownPanel and BetaBreakdownPanel share 90%+ structure;
 * this module captures the common scaffold while callers supply only the
 * data-specific config (title, description, series builder, labels).
 */
import { ui_createElement } from "../../../components/core/builders/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY, ds_signColorRaw } from "../../../components/core/styles/theme";
import { chartManager } from "frontend/charts/ChartManager";
import { createHorizontalBarConfig } from "frontend/charts/types/HorizontalBarChart";
import { formatCurrencyLocale as fmtCurrencyLocale } from "shared/utils/format/formatters";
import { isShareMasked, shareScaleValue, SHARE_MASKED_TEXT } from "shared/utils/domain/globalShareMode";

export interface BreakdownRow {
  label: string;
  value: number;
}

export interface BreakdownPanelConfig<T> {
  /** Panel heading, e.g. "Underlying Delta Breakdown" */
  title: string;
  /** Explanatory subtitle text */
  description: string;
  /** Text when series is empty */
  emptyText: string;
  /** Chart.js dataset label, e.g. "Delta Notional" */
  chartLabel: string;
  /** Descriptor word for the footer, e.g. "directional" or "beta" */
  driverWord: string;
  /** Extracts the bar-chart series from the caller's payload. */
  buildSeries: (payload: T) => BreakdownRow[];
}

type PanelElement<T> = HTMLElement & {
  cleanup?: () => void;
  update?: (next: T) => void;
};

export function renderBreakdownPanel<T>(
  config: BreakdownPanelConfig<T>,
  payload: T,
): PanelElement<T> {
  const panel = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel,
  }) as PanelElement<T>;

  panel.appendChild(
    ui_createElement("h3", {
      text: config.title,
      styleString: DS_TYPOGRAPHY.panelTitle,
    }),
  );
  panel.appendChild(
    ui_createElement("div", {
      text: config.description,
      styleString: DS_TYPOGRAPHY.panelDesc,
    }),
  );

  const canvasWrap = ui_createElement("div", {
    styleString: "height: clamp(180px, 38vh, 280px); width: 100%;",
  });
  const canvas = document.createElement("canvas");
  canvasWrap.appendChild(canvas);
  panel.appendChild(canvasWrap);

  const footer = ui_createElement("div", {
    styleString:
      "font-size: 11px; color: var(--ios-text-secondary); margin-top: 8px;",
  });
  panel.appendChild(footer);

  const render = (next: T) => {
    const series = config.buildSeries(next);
    if (series.length === 0) {
      footer.textContent = config.emptyText;
      chartManager.destroy(canvas);
      canvasWrap.style.display = "none";
      return;
    }

    canvasWrap.style.display = "block";

    const labels = series.map((s) => s.label);
    const data = series.map((s) => s.value);

    const barConfig = createHorizontalBarConfig({
      labels,
      data,
      label: config.chartLabel,
      colorize: (value) => ds_signColorRaw(value),
      formatTooltip: (value, label) =>
        isShareMasked()
          ? `${label}: ${SHARE_MASKED_TEXT}`
          : `${label}: ${fmtCurrencyLocale(shareScaleValue(value) as number)}`,
    });

    chartManager.createOrUpdate(canvas, barConfig, false);

    const largest = series[0];
    const gross = series.reduce((sum, s) => sum + Math.abs(s.value), 0);
    const share = gross > 0 ? (Math.abs(largest.value) / gross) * 100 : 0;

    footer.textContent = isShareMasked()
      ? `Largest ${config.driverWord} driver: ${largest.label} (${SHARE_MASKED_TEXT}, ${share.toFixed(1)}% of top-8 gross).`
      : `Largest ${config.driverWord} driver: ${largest.label} (${fmtCurrencyLocale(shareScaleValue(largest.value) as number)}, ${share.toFixed(1)}% of top-8 gross).`;
  };

  render(payload);

  panel.update = (next: T) => {
    render(next);
  };

  panel.cleanup = () => {
    chartManager.destroy(canvas);
  };

  return panel;
}
