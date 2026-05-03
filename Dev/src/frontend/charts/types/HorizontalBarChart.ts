import type { ChartConfiguration } from "chart.js";
import {
  CHART_COLORS,
  CHART_ANIMATIONS,
  CHART_TOOLTIP_CONFIG,
  getColorForValue,
  niceLinearScale,
} from "../ChartTheme";
import { validateChartData, truncateLabel } from "../ChartUtils";
import { formatNumberLocale } from "shared/utils/format/formatters";

export interface HorizontalBarOptions {
  labels: string[];
  data: number[];
  label: string;
  colorize?: (value: number, index: number) => string;
  maxLabelLength?: number;
  showGrid?: boolean;
  formatTooltip?: (value: number, label: string) => string;
}

export function createHorizontalBarConfig(
  options: HorizontalBarOptions,
): ChartConfiguration<"bar"> {
  const {
    labels,
    data,
    label,
    colorize,
    maxLabelLength = 15,
    showGrid = true,
    formatTooltip,
  } = options;

  if (!validateChartData(data)) {
    throw new Error("Invalid chart data provided to HorizontalBarChart");
  }

  if (labels.length !== data.length) {
    throw new Error("Labels and data arrays must have the same length");
  }

  const truncatedLabels = labels.map((l) => truncateLabel(l, maxLabelLength));

  const backgroundColor = colorize
    ? data.map((value, index) => colorize(value, index))
    : data.map((value) => getColorForValue(value));

  return {
    type: "bar",
    data: {
      labels: truncatedLabels,
      datasets: [
        {
          label,
          data,
          backgroundColor,
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y", // Horizontal bars
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          ...CHART_TOOLTIP_CONFIG,
          callbacks: {
            title: (items) => {
              const index = items[0].dataIndex;
              return labels[index]; // Show full label in tooltip
            },
            label: (context) => {
              const value = context.parsed.x;
              if (formatTooltip) {
                return formatTooltip(value, labels[context.dataIndex]);
              }
              return `${label}: ${value >= 0 ? "+" : ""}${formatNumberLocale(value, 0)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ...niceLinearScale(data, { forceIncludeZero: true }),
          grid: {
            display: showGrid,
            color: "rgba(0, 0, 0, 0.05)",
          },
          ticks: {
            ...niceLinearScale(data, { forceIncludeZero: true }).ticks,
            font: {
              size: 11,
            },
            color: CHART_COLORS.textSecondary,
            callback: function (value) {
              return formatNumberLocale(value as number, 0);
            },
          },
        },
        y: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11,
            },
            color: CHART_COLORS.textPrimary,
          },
        },
      },
      animation: {
        ...CHART_ANIMATIONS.initial, // Initial render uses full animation
      },
    },
  };
}
