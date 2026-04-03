import type { ChartConfiguration, Plugin } from "chart.js";
import { CHART_COLORS, CHART_TOOLTIP_CONFIG } from "../ChartTheme";
import { formatCurrencyLocale, formatPct } from "shared/utils/formatters";
import { niceScale } from "shared/utils/math/scale";

export interface BubbleChartPoint {
  label: string;
  x: number;
  y: number;
  size: number;
}

export interface BubbleChartOptions {
  data: BubbleChartPoint[];
  xLabel: string;
  yLabel: string;
  xFormatter?: (v: number) => string;
  yFormatter?: (v: number) => string;
  sizeLabel?: string;
  sizeFormatter?: (v: number) => string;
  colorize?: (point: BubbleChartPoint) => string;
  minRadius?: number;
  maxRadius?: number;
}

/** Draws bold zero lines on both axes to create a quadrant crosshair. */
const zeroCrosshairPlugin: Plugin = {
  id: "zeroCrosshair",
  afterDraw(chart: any) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales?.x || !scales?.y) return;

    const xPixel = scales.x.getPixelForValue(0);
    const yPixel = scales.y.getPixelForValue(0);
    const { left, right, top, bottom } = chartArea;

    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;

    // Vertical zero line (x = 0)
    if (xPixel >= left && xPixel <= right) {
      ctx.beginPath();
      ctx.moveTo(xPixel, top);
      ctx.lineTo(xPixel, bottom);
      ctx.stroke();
    }

    // Horizontal zero line (y = 0)
    if (yPixel >= top && yPixel <= bottom) {
      ctx.beginPath();
      ctx.moveTo(left, yPixel);
      ctx.lineTo(right, yPixel);
      ctx.stroke();
    }

    ctx.restore();
  },
};

const bubbleLabelPlugin: Plugin = {
  id: "bubbleLabels",
  afterDatasetsDraw(chart: any) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const meta = chart.getDatasetMeta(0);
    if (!meta?.data) return;

    const rawData: { label?: string }[] = chart.data.datasets?.[0]?.data ?? [];

    ctx.save();
    // Clip to chart area so labels don't overflow outside axes
    ctx.beginPath();
    ctx.rect(
      chartArea.left,
      chartArea.top,
      chartArea.right - chartArea.left,
      chartArea.bottom - chartArea.top,
    );
    ctx.clip();

    ctx.font =
      '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < meta.data.length; i++) {
      const point = meta.data[i];
      const raw = rawData[i] as any;
      if (!raw?.label) continue;

      const r = point.options?.radius ?? point.radius ?? 0;
      if (r < 12) continue;

      const bgColor: string =
        point.options?.backgroundColor ?? CHART_COLORS.neutral;
      const brightness = parseBrightness(bgColor);
      ctx.fillStyle = brightness > 160 ? CHART_COLORS.textPrimary : "#fff";

      ctx.fillText(raw.label, point.x, point.y);
    }
    ctx.restore();
  },
};

function parseBrightness(color: string): number {
  const m = color.match(/rgb[a]?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return 200;
  return 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
}

function scaleRadius(
  value: number,
  values: number[],
  minR: number,
  maxR: number,
): number {
  if (values.length === 0) return minR;
  const absValues = values.map((v) => Math.abs(v));
  const maxVal = Math.max(...absValues);
  if (maxVal === 0) return minR;
  const ratio = Math.abs(value) / maxVal;
  return minR + Math.sqrt(ratio) * (maxR - minR);
}

export function createBubbleChartConfig(
  options: BubbleChartOptions,
): ChartConfiguration<"bubble"> {
  const {
    data,
    xLabel,
    yLabel,
    xFormatter = (v) => formatCurrencyLocale(v, 0),
    yFormatter = (v) => formatPct(v, { decimals: 2 }),
    sizeLabel = "Market Value",
    sizeFormatter = (v) => formatCurrencyLocale(v, 0),
    colorize = (p) => (p.x >= 0 ? CHART_COLORS.success : CHART_COLORS.danger),
    minRadius = 6,
    maxRadius = 40,
  } = options;

  const sizeValues = data.map((d) => d.size);

  const bubbleData = data.map((d) => ({
    x: d.x,
    y: d.y,
    r: scaleRadius(d.size, sizeValues, minRadius, maxRadius),
    label: d.label,
  }));

  const bgColors = data.map((d) => {
    const base = colorize(d);
    return base.replace("rgb(", "rgba(").replace(")", ", 0.7)");
  });
  const borderColors = data.map((d) => colorize(d));

  const xValues = data.map((d) => d.x);
  const yValues = data.map((d) => d.y);
  const xNice = niceScale({
    dataMin: Math.min(...xValues),
    dataMax: Math.max(...xValues),
    symmetric: true,
    padding: 0.15,
  });
  const yNice = niceScale({
    dataMin: Math.min(...yValues),
    dataMax: Math.max(...yValues),
    symmetric: true,
    padding: 0.15,
  });

  return {
    type: "bubble",
    data: {
      datasets: [
        {
          data: bubbleData as any,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          hoverBorderWidth: 2.5,
          hoverBorderColor: CHART_COLORS.textPrimary,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...CHART_TOOLTIP_CONFIG,
          callbacks: {
            title: (items) => {
              const raw = items[0]?.raw as any;
              return raw?.label ?? "";
            },
            label: (context) => {
              const raw = context.raw as any;
              const d = data[context.dataIndex];
              return [
                `${xLabel}: ${xFormatter(raw.x)}`,
                `${yLabel}: ${yFormatter(raw.y)}`,
                `${sizeLabel}: ${sizeFormatter(d.size)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          min: xNice.min,
          max: xNice.max,
          title: { display: true, text: xLabel, font: { size: 11 } },
          grid: { color: "rgba(0,0,0,0.06)" },
          ticks: {
            stepSize: xNice.step,
            font: { size: 10 },
            color: CHART_COLORS.textSecondary,
            callback(value) {
              return xFormatter(value as number);
            },
          },
        },
        y: {
          min: yNice.min,
          max: yNice.max,
          title: { display: true, text: yLabel, font: { size: 11 } },
          grid: { color: "rgba(0,0,0,0.06)" },
          ticks: {
            stepSize: yNice.step,
            font: { size: 10 },
            color: CHART_COLORS.textSecondary,
            callback(value) {
              return yFormatter(value as number);
            },
          },
        },
      },
      animation: false,
    },
    plugins: [zeroCrosshairPlugin, bubbleLabelPlugin],
  };
}
