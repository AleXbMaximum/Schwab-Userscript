import { createChartPanel } from "frontend/charts/chartPanel";
import { niceLinearScale, niceStrikeTicks } from "frontend/charts/ChartTheme";
import { OPTIONS_SEMANTIC_COLORS as C } from "frontend/charts/ChartTheme";
import type { SpreadPoint } from "backend/computation/options/types";
import { createSpotPlugin } from "../spotPricePlugin";
import { createVerticalFocusStrikePlugin } from "../../focus/focusStrikeOverlayPlugin";
import { getFocusedLevels, subscribeFocusedLevels } from "../../focus/focusStrike";

export function renderBidAskSpread(
  spreadData: SpreadPoint[],
  underlyingPrice: number | null,
): HTMLElement & {
  cleanup?: () => void;
  update?: (d: SpreadPoint[], p: number | null) => void;
} {
  let currentData = spreadData;
  let currentPrice = underlyingPrice;
  let currentLabels: string[] = [];
  let focusedLevels = getFocusedLevels();
  const spotPlugin = createSpotPlugin(
    () => currentPrice,
    () => currentLabels,
  );
  const focusPlugin = createVerticalFocusStrikePlugin(
    () => focusedLevels,
    () => currentLabels,
  );

  const buildChartConfig = (data: SpreadPoint[]) => {
    const filtered = data.filter(
      (d) => d.callSpread != null || d.putSpread != null,
    );
    const labels = filtered.map((d) => String(d.strike));
    currentLabels = labels;

    return {
      type: "bar" as const,
      data: {
        labels,
        datasets: [
          {
            label: "Call Spread",
            data: filtered.map((d) => d.callSpread ?? 0),
            backgroundColor: C.fillPositive,
            borderColor: C.bullish,
            borderWidth: 1,
            borderRadius: 2,
          },
          {
            label: "Put Spread",
            data: filtered.map((d) => d.putSpread ?? 0),
            backgroundColor: C.fillNegative,
            borderColor: C.bearish,
            borderWidth: 1,
            borderRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top" as const,
            labels: { font: { size: 10 }, boxWidth: 12, padding: 8 },
          },
          tooltip: {
            callbacks: {
              title: (items: any[]) => `Strike $${items[0]?.label ?? ""}`,
              label: (ctx: any) => {
                const v = ctx.parsed.y;
                return `${ctx.dataset.label}: $${v.toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              maxRotation: 45,
              ...niceStrikeTicks(labels),
            },
          },
          y: {
            ...niceLinearScale(
              filtered.flatMap((d) => [d.callSpread ?? 0, d.putSpread ?? 0]),
              { forceIncludeZero: true },
            ),
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              ...niceLinearScale(
                filtered.flatMap((d) => [d.callSpread ?? 0, d.putSpread ?? 0]),
                { forceIncludeZero: true },
              ).ticks,
              font: { size: 10 },
              callback: (value: any) => `$${Number(value).toFixed(2)}`,
            },
            title: { display: true, text: "Spread ($)", font: { size: 10 } },
          },
        },
      },
      plugins: [spotPlugin, focusPlugin],
    };
  };

  const chartPanel = createChartPanel<SpreadPoint[]>(
    {
      title: "Bid-Ask Spread (Liquidity)",
      description:
        "Bid-ask spread by strike. Tighter spreads = higher liquidity and lower execution costs.",
      buildChartConfig,
      destroyOnUpdate: true,
    },
    spreadData,
  );

  const unsubscribeFocus = subscribeFocusedLevels((levels) => {
    focusedLevels = levels;
    if (chartPanel.update) chartPanel.update(currentData);
  });

  // Wrap to match the two-param signature expected by orchestrator
  const result = chartPanel as unknown as HTMLElement & {
    cleanup?: () => void;
    update?: (d: SpreadPoint[], p: number | null) => void;
  };

  const origUpdate = chartPanel.update;
  result.update = (d: SpreadPoint[], p: number | null) => {
    currentData = d;
    currentPrice = p;
    if (origUpdate) origUpdate(d);
  };

  const origCleanup = chartPanel.cleanup;
  result.cleanup = () => {
    unsubscribeFocus();
    if (origCleanup) origCleanup();
  };

  return result;
}
