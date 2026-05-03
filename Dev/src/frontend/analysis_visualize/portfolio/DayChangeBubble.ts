import { createLegacyChartPanel, type ChartPanelResult } from "frontend/charts/chartPanel";
import { createBubbleChartConfig } from "frontend/charts/types/BubbleChart";
import { CHART_COLORS } from "frontend/charts/ChartTheme";
import { formatCurrencyLocale, formatPct } from "shared/utils/format/formatters";
import { isShareMasked, shareScaleValue, SHARE_MASKED_TEXT } from "shared/utils/domain/globalShareMode";
import type { VisualizeUnderlyingData } from "../page";

export function renderDayChangeBubble(
  data: VisualizeUnderlyingData[],
): ChartPanelResult<VisualizeUnderlyingData[]> {
  return createLegacyChartPanel<VisualizeUnderlyingData[]>(
    {
      title: "Day Change",
      description: "X = Day P&L $, Y = Day Change %, Size = Market Value",
      canvasLayout: { height: "clamp(220px, 45vh, 360px)" },
      buildConfig: (items) => {
        const filtered = items.filter(
          (d) => d.dayChangeDol !== 0 || d.dayChangePct !== 0,
        );

        return createBubbleChartConfig({
          data: filtered.map((d) => ({
            label: d.symbol,
            x: d.dayChangeDol,
            y: d.dayChangePct,
            size: d.marketValue,
          })),
          xLabel: "Day Change $",
          yLabel: "Day Change %",
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
