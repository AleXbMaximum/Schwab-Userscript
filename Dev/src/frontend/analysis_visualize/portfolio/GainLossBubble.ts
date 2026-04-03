import { createLegacyChartPanel, type ChartPanelResult } from "frontend/charts/chartPanel";
import { createBubbleChartConfig } from "frontend/charts/types/BubbleChart";
import { CHART_COLORS } from "frontend/charts/ChartTheme";
import { formatCurrencyLocale, formatPct } from "shared/utils/formatters";
import { isShareMasked, shareScaleValue, SHARE_MASKED_TEXT } from "shared/utils/globalShareMode";
import type { VisualizeUnderlyingData } from "../page";

export function renderGainLossBubble(
  data: VisualizeUnderlyingData[],
): ChartPanelResult<VisualizeUnderlyingData[]> {
  return createLegacyChartPanel<VisualizeUnderlyingData[]>(
    {
      title: "Gain/Loss",
      description: "X = Gain/Loss $, Y = Gain/Loss %, Size = Market Value",
      canvasLayout: { height: "clamp(220px, 45vh, 360px)" },
      buildConfig: (items) => {
        const filtered = items.filter(
          (d) => d.gainLossDol !== 0 || d.gainLossPercent !== 0,
        );

        return createBubbleChartConfig({
          data: filtered.map((d) => ({
            label: d.symbol,
            x: d.gainLossDol,
            y: d.gainLossPercent,
            size: d.marketValue,
          })),
          xLabel: "Gain/Loss $",
          yLabel: "Gain/Loss %",
          xFormatter: (v) =>
            isShareMasked() ? SHARE_MASKED_TEXT : formatCurrencyLocale(shareScaleValue(v) as number, 0),
          yFormatter: (v) => formatPct(v, { decimals: 2 }),
          sizeFormatter: (v) =>
            isShareMasked() ? SHARE_MASKED_TEXT : formatCurrencyLocale(shareScaleValue(v) as number, 0),
          colorize: (p) =>
            p.x >= 0 ? CHART_COLORS.success : CHART_COLORS.danger,
        });
      },
    },
    data,
  );
}
