import { createChartPanel } from "frontend/charts/chartPanel";
import { niceLinearScale, niceStrikeTicks, CHART_COLORS } from "frontend/charts/ChartTheme";
import { isDarkTheme } from "frontend/components/core/axTheme";
import { DS_COLORS } from "../../../components/core/styles/theme";
import type { IVSmileLine } from "backend/computation/options/types";
import { createVerticalFocusStrikePlugin } from "../../focus/focusStrikeOverlayPlugin";
import { getFocusedLevels, subscribeFocusedLevels } from "../../focus/focusStrike";

const COLORS = [
  DS_COLORS.raw.info,
  DS_COLORS.raw.neutral,
  DS_COLORS.raw.positive,
  DS_COLORS.raw.negative,
  "#8E44AD",
  "#00BCD4",
];

export function renderIVSmileOverlay(
  smileData: IVSmileLine[],
  underlyingPrice: number | null,
): HTMLElement & {
  cleanup?: () => void;
  update?: (d: IVSmileLine[], p: number | null) => void;
} {
  let currentData = smileData;
  let currentPrice = underlyingPrice;
  let currentLabels: string[] = [];
  let focusedLevels = getFocusedLevels();
  const focusPlugin = createVerticalFocusStrikePlugin(
    () => focusedLevels,
    () => currentLabels,
  );

  const getATMInfo = () => {
    if (currentPrice == null || currentData.length === 0) return null;
    const line = currentData[0];
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < line.points.length; i++) {
      const diff = Math.abs(line.points[i].strike - currentPrice);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    const atmStrike = line.points[bestIdx]?.strike;
    const atmIV = line.points[bestIdx]?.iv;
    if (atmStrike == null) return null;
    return { atmStrike, atmIV: atmIV ?? null };
  };

  const atmPlugin = {
    id: "atmLines",
    afterDraw: (chart: any) => {
      const atm = getATMInfo();
      if (!atm) return;

      const { ctx: c, chartArea, scales } = chart;
      if (!chartArea || !scales.x || !scales.y) return;

      const xScale = scales.x;
      const yScale = scales.y;

      c.save();
      c.setLineDash([6, 4]);
      c.lineWidth = 1.5;

      const atmLabel = String(atm.atmStrike);
      const xPixel = xScale.getPixelForValue(atmLabel);
      if (xPixel >= chartArea.left && xPixel <= chartArea.right) {
        c.strokeStyle = isDarkTheme() ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
        c.beginPath();
        c.moveTo(xPixel, chartArea.top);
        c.lineTo(xPixel, chartArea.bottom);
        c.stroke();

        c.setLineDash([]);
        c.fillStyle = CHART_COLORS.textPrimary;
        c.font = "600 10px -apple-system, BlinkMacSystemFont, sans-serif";
        c.textAlign = "center";
        c.textBaseline = "bottom";
        c.fillText("ATM", xPixel, chartArea.top - 3);
      }

      if (atm.atmIV != null) {
        const yPixel = yScale.getPixelForValue(atm.atmIV);
        if (yPixel >= chartArea.top && yPixel <= chartArea.bottom) {
          c.setLineDash([6, 4]);
          c.strokeStyle = "rgba(0,122,255,0.5)";
          c.beginPath();
          c.moveTo(chartArea.left, yPixel);
          c.lineTo(chartArea.right, yPixel);
          c.stroke();

          c.setLineDash([]);
          c.fillStyle = "#007AFF";
          c.font = "600 9px -apple-system, BlinkMacSystemFont, sans-serif";
          c.textAlign = "left";
          c.textBaseline = "bottom";
          c.fillText(
            `ATM IV: ${atm.atmIV.toFixed(1)}%`,
            chartArea.left + 4,
            yPixel - 3,
          );
        }
      }

      c.restore();
    },
  };

  const buildChartConfig = (data: IVSmileLine[]) => {
    const strikeSet = new Set<number>();
    for (const line of data) {
      for (const p of line.points) strikeSet.add(p.strike);
    }
    const allStrikes = Array.from(strikeSet).sort((a, b) => a - b);
    const labels = allStrikes.map(String);
    currentLabels = labels;

    const datasets = data.map((line, i) => {
      const ivMap = new Map<number, number | null>();
      for (const p of line.points) ivMap.set(p.strike, p.iv);

      return {
        label: line.label,
        data: allStrikes.map((s) => ivMap.get(s) ?? null),
        borderColor: COLORS[i % COLORS.length],
        backgroundColor: COLORS[i % COLORS.length] + "20",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        spanGaps: true,
      };
    });

    return {
      type: "line" as const,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
              label: (ctx: any) =>
                `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + "%" : "N/A"}`,
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
            title: { display: true, text: "Strike", font: { size: 10 } },
          },
          y: {
            ...niceLinearScale(datasets.flatMap((d) => d.data)),
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              ...niceLinearScale(datasets.flatMap((d) => d.data)).ticks,
              font: { size: 10 },
              callback: (value: any) => Number(value).toFixed(0) + "%",
            },
            title: { display: true, text: "IV (%)", font: { size: 10 } },
          },
        },
      },
      plugins: [atmPlugin, focusPlugin],
    };
  };

  const chartPanel = createChartPanel<IVSmileLine[]>(
    {
      title: "IV Smile Comparison",
      description:
        "Implied volatility curves across multiple expirations. Dashed lines mark ATM strike and ATM IV.",
      buildChartConfig,
      destroyOnUpdate: true,
    },
    smileData,
  );

  const unsubscribeFocus = subscribeFocusedLevels((levels) => {
    focusedLevels = levels;
    if (chartPanel.update) chartPanel.update(currentData);
  });

  // Wrap to match the two-param signature expected by orchestrator
  const result = chartPanel as unknown as HTMLElement & {
    cleanup?: () => void;
    update?: (d: IVSmileLine[], p: number | null) => void;
  };

  const origUpdate = chartPanel.update;
  result.update = (d: IVSmileLine[], p: number | null) => {
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
