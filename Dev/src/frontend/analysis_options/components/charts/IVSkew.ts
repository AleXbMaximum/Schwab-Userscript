import { createChartPanel } from "frontend/charts/chartPanel";
import { niceLinearScale, niceStrikeTicks } from "frontend/charts/ChartTheme";
import { OPTIONS_SEMANTIC_COLORS as C } from "frontend/charts/ChartTheme";
import { DS_COLORS } from "frontend/components/core/styles/theme";
import type { IVSkewPoint } from "backend/computation/options/types";
import { createSpotPlugin } from "../spotPricePlugin";
import { createVerticalFocusStrikePlugin } from "../../focus/focusStrikeOverlayPlugin";
import { getFocusedLevels, subscribeFocusedLevels } from "../../focus/focusStrike";

// ── 25-delta put skew slope annotation plugin ────────────────────────────────

function createSlopeAnnotationPlugin(
  getData: () => IVSkewPoint[],
  getPrice: () => number | null,
) {
  return {
    id: "skewSlope",
    afterDatasetsDraw: (chart: any) => {
      const price = getPrice();
      const data = getData();
      if (price == null || price <= 0 || data.length < 4) return;

      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x || !scales.y) return;

      // Find strikes in ~90-97% moneyness range (rough 25-delta put region)
      const region = data.filter((d) => {
        const m = d.strike / price;
        return m >= 0.9 && m <= 0.97 && d.putIV != null;
      });
      if (region.length < 2) return;

      // Linear regression: slope of putIV vs moneyness%
      const xs = region.map((d) => (d.strike / price) * 100);
      const ys = region.map((d) => d.putIV!);
      const n = xs.length;
      const sumX = xs.reduce((s, v) => s + v, 0);
      const sumY = ys.reduce((s, v) => s + v, 0);
      const sumXY = xs.reduce((s, v, i) => s + v * ys[i], 0);
      const sumXX = xs.reduce((s, v) => s + v * v, 0);
      const denom = n * sumXX - sumX * sumX;
      if (Math.abs(denom) < 1e-12) return;
      const slope = (n * sumXY - sumX * sumY) / denom;
      const intercept = (sumY - slope * sumX) / n;

      // Draw tangent line through the 25-delta region
      const labels = chart.data.labels as string[];
      const startStrike = region[0].strike;
      const endStrike = region[region.length - 1].strike;

      let startIdx = -1;
      let endIdx = -1;
      for (let i = 0; i < labels.length; i++) {
        const s = Number(labels[i]);
        if (startIdx < 0 && s >= startStrike) startIdx = i;
        if (s <= endStrike) endIdx = i;
      }
      if (startIdx < 0 || endIdx < 0 || startIdx >= endIdx) return;

      const xPx1 = scales.x.getPixelForValue(startIdx);
      const xPx2 = scales.x.getPixelForValue(endIdx);
      const m1 = (startStrike / price) * 100;
      const m2 = (endStrike / price) * 100;
      const yVal1 = slope * m1 + intercept;
      const yVal2 = slope * m2 + intercept;
      const yPx1 = scales.y.getPixelForValue(yVal1);
      const yPx2 = scales.y.getPixelForValue(yVal2);

      ctx.save();
      ctx.strokeStyle = "rgba(88, 86, 214, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(xPx1, yPx1);
      ctx.lineTo(xPx2, yPx2);
      ctx.stroke();

      // Badge label at midpoint
      ctx.setLineDash([]);
      const midX = (xPx1 + xPx2) / 2;
      const midY = (yPx1 + yPx2) / 2;
      const text = `25\u0394 slope: ${slope.toFixed(2)}%/1%`;
      ctx.font = "600 9px -apple-system, BlinkMacSystemFont, sans-serif";
      const tw = ctx.measureText(text).width;
      const bW = tw + 8;
      const bH = 14;
      const bX = midX - bW / 2;
      const bY = midY - bH - 4;

      ctx.fillStyle = "rgba(88, 86, 214, 0.12)";
      ctx.beginPath();
      ctx.roundRect(bX, bY, bW, bH, 3);
      ctx.fill();
      ctx.fillStyle = DS_COLORS.raw.purple;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, midX, bY + bH / 2);
      ctx.restore();
    },
  };
}

export function renderIVSkew(
  skewData: IVSkewPoint[],
  underlyingPrice: number | null,
): HTMLElement & {
  cleanup?: () => void;
  update?: (data: IVSkewPoint[], price: number | null) => void;
} {
  let currentPrice = underlyingPrice;
  let currentData = skewData;
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
  const slopePlugin = createSlopeAnnotationPlugin(
    () => currentData,
    () => currentPrice,
  );

  // ── Main chart config ────────────────────────────────────────────────────

  const buildChartConfig = (data: IVSkewPoint[]) => {
    const labels = data.map((d) => String(d.strike));
    currentLabels = labels;
    const callIVs = data.map((d) => d.callIV);
    const putIVs = data.map((d) => d.putIV);
    const niceTicks = niceStrikeTicks(labels);

    return {
      type: "line" as const,
      data: {
        labels,
        datasets: [
          {
            label: "Call IV",
            data: callIVs,
            borderColor: C.bullish,
            backgroundColor: C.bgPositive,
            borderWidth: 2,
            pointRadius: 1,
            pointHoverRadius: 4,
            tension: 0.3,
            fill: false,
            spanGaps: true,
          },
          {
            label: "Put IV",
            data: putIVs,
            borderColor: C.bearish,
            backgroundColor: C.bgNegative,
            borderWidth: 2,
            pointRadius: 1,
            pointHoverRadius: 4,
            tension: 0.3,
            fill: false,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "top" as const,
            labels: { font: { size: 11 }, boxWidth: 12, padding: 8 },
          },
          tooltip: {
            callbacks: {
              title: (items: any[]) => {
                const idx = items[0]?.dataIndex;
                if (idx == null) return "";
                const strike = data[idx]?.strike;
                if (strike == null) return "";
                if (currentPrice != null && currentPrice > 0) {
                  const m = ((strike / currentPrice) * 100).toFixed(1);
                  return `$${strike} (${m}%)`;
                }
                return `$${strike}`;
              },
              label: (ctx: any) =>
                `${ctx.dataset.label}: ${ctx.raw != null ? ctx.raw.toFixed(2) + "%" : "--"}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              maxRotation: 45,
              autoSkip: niceTicks.autoSkip,
              callback:
                currentPrice != null && currentPrice > 0
                  ? (_value: any, index: number): string | null => {
                      const shouldShow = niceTicks.callback(_value, index);
                      if (shouldShow == null) return null;
                      const strike = Number(labels[index]);
                      if (isNaN(strike)) return shouldShow;
                      return ((strike / currentPrice!) * 100).toFixed(0) + "%";
                    }
                  : niceTicks.callback,
            },
            title: {
              display: true,
              text: currentPrice != null ? "Moneyness (K/S %)" : "Strike",
              font: { size: 10 },
            },
          },
          y: {
            ...niceLinearScale([...callIVs, ...putIVs]),
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              ...niceLinearScale([...callIVs, ...putIVs]).ticks,
              font: { size: 10 },
              callback: (value: any) => value + "%",
            },
            title: { display: true, text: "IV (%)", font: { size: 10 } },
          },
        },
      },
      plugins: [spotPlugin, focusPlugin, slopePlugin],
    };
  };

  const chartPanel = createChartPanel<IVSkewPoint[]>(
    {
      title: "IV Skew",
      description:
        "Implied volatility across strikes. X-axis shows moneyness (K/S\u00D7100%). Dashed line marks 25\u0394 put slope.",
      buildChartConfig,
      destroyOnUpdate: true,
    },
    skewData,
  );

  const unsubscribeFocus = subscribeFocusedLevels((levels) => {
    focusedLevels = levels;
    if (chartPanel.update) chartPanel.update(currentData);
  });

  // Wrap to match the two-param signature expected by orchestrator
  const result = chartPanel as unknown as HTMLElement & {
    cleanup?: () => void;
    update?: (data: IVSkewPoint[], price: number | null) => void;
  };

  const origUpdate = chartPanel.update;
  result.update = (data: IVSkewPoint[], price: number | null) => {
    currentPrice = price;
    currentData = data;
    if (origUpdate) origUpdate(data);
  };

  const origCleanup = chartPanel.cleanup;
  result.cleanup = () => {
    unsubscribeFocus();
    if (origCleanup) origCleanup();
  };

  return result;
}
