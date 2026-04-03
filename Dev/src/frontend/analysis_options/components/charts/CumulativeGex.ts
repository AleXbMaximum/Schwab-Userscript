import { createChartPanel } from "frontend/charts/chartPanel";
import { niceLinearScale, niceStrikeTicks } from "frontend/charts/ChartTheme";
import { OPTIONS_SEMANTIC_COLORS as C } from "frontend/charts/ChartTheme";
import type { CumulativeGexPoint } from "backend/computation/options/types";
import { createSpotPlugin } from "../spotPricePlugin";
import { createVerticalFocusStrikePlugin } from "../../focus/focusStrikeOverlayPlugin";
import {
  getFocusedLevels,
  subscribeFocusedLevels,
  setFocusedStrike,
} from "../../focus/focusStrike";

export function renderCumulativeGex(
  cumData: CumulativeGexPoint[],
  underlyingPrice: number | null,
): HTMLElement & {
  cleanup?: () => void;
  update?: (d: CumulativeGexPoint[], p: number | null) => void;
} {
  let currentData = cumData;
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

  const buildChartConfig = (data: CumulativeGexPoint[]) => {
    const labels = data.map((d) => String(d.strike));
    currentLabels = labels;
    const posData = data.map((d) => d.cumPos);
    const negData = data.map((d) => Math.abs(d.cumNeg));

    return {
      type: "line" as const,
      data: {
        labels,
        datasets: [
          {
            label: "Cum. Call GEX",
            data: posData,
            borderColor: C.bullish,
            backgroundColor: "rgba(32, 169, 69, 0.15)",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 3,
            fill: "origin",
            tension: 0.3,
          },
          {
            label: "Cum. Put GEX",
            data: negData,
            borderColor: C.bearish,
            backgroundColor: "rgba(215, 49, 38, 0.15)",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 3,
            fill: "origin",
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_evt: any, els: any[]) => {
          const idx = els?.[0]?.index;
          if (idx == null) return;
          const strike = data[idx]?.strike;
          if (strike == null) return;
          setFocusedStrike(strike);
        },
        interaction: { mode: "index" as const, intersect: false },
        plugins: {
          legend: {
            position: "top" as const,
            labels: {
              font: { size: 10 },
              boxWidth: 12,
              padding: 8,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              title: (items: any[]) => `Strike $${items[0]?.label ?? ""}`,
              label: (ctx: any) => {
                const v = ctx.parsed.y;
                if (v == null) return "";
                const abs = Math.abs(v);
                const fmt =
                  abs >= 1e9
                    ? `$${(abs / 1e9).toFixed(1)}B`
                    : abs >= 1e6
                      ? `$${(abs / 1e6).toFixed(1)}M`
                      : abs >= 1e3
                        ? `$${(abs / 1e3).toFixed(0)}K`
                        : `$${abs.toFixed(0)}`;
                return `${ctx.dataset.label}: ${fmt}`;
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
            ...niceLinearScale([...posData, ...negData], {
              forceIncludeZero: true,
            }),
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              ...niceLinearScale([...posData, ...negData], {
                forceIncludeZero: true,
              }).ticks,
              font: { size: 10 },
              callback: (value: any) => {
                const v = Number(value);
                const abs = Math.abs(v);
                const sign = v < 0 ? "-" : "";
                if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + "B";
                if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + "M";
                if (abs >= 1e3) return sign + (abs / 1e3).toFixed(0) + "K";
                return String(v);
              },
            },
            title: {
              display: true,
              text: "Abs. Cumulative GEX ($)",
              font: { size: 10 },
            },
          },
        },
      },
      plugins: [spotPlugin, focusPlugin],
    };
  };

  const chartPanel = createChartPanel<CumulativeGexPoint[]>(
    {
      title: "Cumulative Gamma Exposure",
      description:
        "Running sum of net GEX across strikes. Shows the cumulative gamma wall buildup and where the market transitions between positive and negative gamma.",
      buildChartConfig,
      destroyOnUpdate: true,
    },
    cumData,
  );

  const unsubscribeFocus = subscribeFocusedLevels((levels) => {
    focusedLevels = levels;
    if (chartPanel.update) chartPanel.update(currentData);
  });

  const result = chartPanel as unknown as HTMLElement & {
    cleanup?: () => void;
    update?: (d: CumulativeGexPoint[], p: number | null) => void;
  };

  const origUpdate = chartPanel.update;
  result.update = (d: CumulativeGexPoint[], p: number | null) => {
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
