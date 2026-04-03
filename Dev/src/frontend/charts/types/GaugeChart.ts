import type { ChartConfiguration, Plugin } from "chart.js";
import {
  CHART_COLORS,
  CHART_ANIMATIONS,
  CHART_TOOLTIP_CONFIG,
  getColorForPercentage,
} from "../ChartTheme";
import { percentage } from "shared/utils/math/numeric";
import { isFiniteNumber } from "shared/utils/math/guards";

export interface GaugeOptions {
  value: number;
  max: number;
  label: string;
  thresholds?: { low: number; medium: number };
  unit?: string;
  showPercentage?: boolean;
}

const centerTextPlugin: Plugin = {
  id: "centerText",
  beforeDraw(chart: any) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const { left, top, width, height } = chartArea;
    const centerX = left + width / 2;
    const centerY = top + height / 2 + 20; // Offset down for semi-circle

    const options = (
      chart.config.options?.plugins as
        | {
            centerText?: {
              text: string;
              color?: string;
              fontFamily?: string;
              fontSize?: number;
              fontWeight?: string;
            };
          }
        | undefined
    )?.centerText;
    if (!options) return;

    ctx.save();
    ctx.font = `${options.fontWeight || "700"} ${options.fontSize || 24}px ${options.fontFamily || "sans-serif"}`;
    ctx.fillStyle = options.color || CHART_COLORS.textPrimary;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(options.text, centerX, centerY);
    ctx.restore();
  },
};

export function createGaugeConfig(
  options: GaugeOptions,
): ChartConfiguration<"doughnut"> {
  const {
    value,
    max,
    label,
    thresholds = { low: 50, medium: 75 },
    unit = "",
    showPercentage = true,
  } = options;

  const validValue = isFiniteNumber(value) ? value : 0;
  const validMax = isFiniteNumber(max) && max > 0 ? max : 100;
  const clampedValue = Math.max(0, Math.min(validMax, validValue));

  const pct = percentage(clampedValue, validMax);
  const color = getColorForPercentage(pct, thresholds);

  const centerText = showPercentage
    ? `${pct.toFixed(1)}%`
    : `${clampedValue.toFixed(0)}${unit}`;

  return {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [clampedValue, validMax - clampedValue],
          backgroundColor: [color, "rgba(0, 0, 0, 0.05)"],
          borderWidth: 0,
          circumference: 180, // Semi-circle
          rotation: 270, // Start at bottom
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "75%", // Thin arc
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          ...CHART_TOOLTIP_CONFIG,
          callbacks: {
            label: (context) => {
              const val = context.parsed;
              if (context.dataIndex === 0) {
                return `${label}: ${val.toFixed(0)}${unit} (${pct.toFixed(1)}%)`;
              }
              return "";
            },
          },
        },
        centerText: {
          text: centerText,
          color: CHART_COLORS.textPrimary,
          fontFamily:
            'var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
          fontSize: 24,
          fontWeight: "700",
        },
      } as any,
      animation: {
        animateRotate: true,
        animateScale: false,
        ...CHART_ANIMATIONS.initial, // Initial render uses full animation
      },
    },
    plugins: [centerTextPlugin],
  };
}
