import type { ChartConfiguration, Plugin } from "chart.js";
import {
  CHART_COLORS,
  CHART_ANIMATIONS,
  CHART_TOOLTIP_CONFIG,
  CHART_LEGEND_CONFIG,
} from "../ChartTheme";
import { validateChartData, truncateLabel } from "../ChartUtils";
import { formatPct, formatNumberLocale } from "shared/utils/formatters";

export interface PieChartOptions {
  labels: string[];
  data: number[];
  colors?: string[];
  isDonut?: boolean;
  cutout?: string;
  showLegend?: boolean;
  legendPosition?: "top" | "bottom" | "left" | "right";
  showPercentages?: boolean;
  centerText?: string;
  valuesArePercentages?: boolean;
  formatTooltip?: (value: number, label: string, percentage: number) => string;
}

const centerTextPlugin: Plugin = {
  id: "donutCenterText",
  beforeDraw(chart: any) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const options = chart.config.options?.plugins?.donutCenterText;
    if (!options || !options.text) return;

    const { left, top, width, height } = chartArea;
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    ctx.save();
    ctx.font = `${options.fontWeight || "600"} ${options.fontSize || 18}px ${options.fontFamily || "sans-serif"}`;
    ctx.fillStyle = options.color || CHART_COLORS.textPrimary;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(options.text, centerX, centerY);
    ctx.restore();
  },
};

export function createPieChartConfig(
  options: PieChartOptions,
): ChartConfiguration<"doughnut"> {
  const {
    labels,
    data,
    colors,
    isDonut = true,
    cutout = "60%",
    showLegend = true,
    legendPosition = "right",
    showPercentages = true,
    centerText,
    valuesArePercentages = false,
    formatTooltip,
  } = options;

  if (!validateChartData(data)) {
    throw new Error("Invalid chart data provided to PieChart");
  }

  if (labels.length !== data.length) {
    throw new Error("Labels and data arrays must have the same length");
  }

  const total = data.reduce((sum, val) => sum + val, 0);
  // percentages as ratios (0–1); formatPct(ratio) handles ×100 for display
  const percentages = valuesArePercentages
    ? data
    : data.map((val) => (total > 0 ? val / total : 0));

  const backgroundColor =
    colors || CHART_COLORS.categorical.slice(0, data.length);

  const displayLabels = showPercentages
    ? labels.map(
        (label, i) =>
          `${truncateLabel(label, 20)} (${formatPct(percentages[i])})`,
      )
    : labels.map((l) => truncateLabel(l, 20));

  const config: ChartConfiguration<"doughnut"> = {
    type: "doughnut",
    data: {
      labels: displayLabels,
      datasets: [
        {
          data,
          backgroundColor,
          borderWidth: 2,
          borderColor: "#fff",
          hoverBorderWidth: 3,
          hoverBorderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: isDonut ? cutout : "0%",
      plugins: {
        legend: {
          ...CHART_LEGEND_CONFIG,
          display: showLegend,
          position: legendPosition,
        },
        tooltip: {
          ...CHART_TOOLTIP_CONFIG,
          callbacks: {
            title: (items) => {
              const index = items[0].dataIndex;
              return labels[index]; // Show full label
            },
            label: (context) => {
              const value = context.parsed;
              const percentage = percentages[context.dataIndex];
              const label = labels[context.dataIndex];

              if (formatTooltip) {
                return formatTooltip(value, label, percentage);
              }

              return `${formatNumberLocale(value, 0)} (${formatPct(percentage)})`;
            },
          },
        },
        donutCenterText: centerText
          ? {
              text: centerText,
              color: CHART_COLORS.textPrimary,
              fontFamily:
                'var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
              fontSize: 18,
              fontWeight: "600",
            }
          : undefined,
      } as any,
      animation: {
        animateRotate: true,
        animateScale: false,
        ...CHART_ANIMATIONS.initial, // Initial render uses full animation
      },
    },
    plugins: centerText ? [centerTextPlugin] : [],
  };

  return config;
}

export interface ConcentrationData {
  label: string;
  value: number;
  riskLevel: "normal" | "warning" | "critical" | "other";
}

export function createConcentrationPieConfig(
  concentrationData: ConcentrationData[],
): ChartConfiguration<"doughnut"> {
  const labels = concentrationData.map((d) => d.label);
  const data = concentrationData.map((d) => d.value);

  const colors = concentrationData.map((d) => {
    switch (d.riskLevel) {
      case "critical":
        return CHART_COLORS.danger;
      case "warning":
        return CHART_COLORS.warning;
      case "other":
        return "#c7c7cc";
      case "normal":
      default:
        return CHART_COLORS.success;
    }
  });

  const total = data.reduce((sum, val) => sum + val, 0);

  return createPieChartConfig({
    labels,
    data,
    colors,
    isDonut: true,
    cutout: "60%",
    showLegend: true,
    legendPosition: "right",
    showPercentages: true,
    valuesArePercentages: true,
    centerText: `Total\n${formatPct(total, { decimals: 1 })}`,
    formatTooltip: (_value, label, percentage) => {
      return `${label}: ${formatPct(percentage)} of portfolio`;
    },
  });
}
