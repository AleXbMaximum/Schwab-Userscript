// Canvas and Chart.js colors. Keep semantic values aligned with the frontend raw tokens.

import {
  niceScaleFromValues,
  type NiceScaleOptions,
} from "shared/utils/math/scale";
import { DS_COLORS } from "frontend/components/core/theme";

export const CHART_COLORS = {
  success: "rgb(32, 169, 69)", // --ios-green
  warning: "rgb(215, 129, 0)", // --ios-orange
  danger: "rgb(215, 49, 38)", // --ios-red
  info: "#007AFF", // --ios-blue
  neutral: "rgb(142, 142, 147)", // --ios-gray

  categorical: [
    "#007AFF", // Blue
    "#4CAF50", // Green
    "#D78100", // Orange (matches DS_COLORS.raw.neutral)
    DS_COLORS.raw.purple, // Purple
    "#FF2D55", // Pink
    "#00C7BE", // Teal
    "#FFD60A", // Yellow
    "#BF5AF2", // Violet
  ],

  heatmapScale: [
    "rgb(215, 49, 38)", // -100% (worst loss)
    "rgb(215, 129, 0)", // -50% (matches --ios-orange)
    "rgb(255, 255, 255)", // 0% (neutral)
    "rgb(144, 238, 144)", // +50%
    "rgb(32, 169, 69)", // +100% (best gain)
  ],

  successAlpha: "rgba(32, 169, 69, 0.15)",
  warningAlpha: "rgba(215, 129, 0, 0.15)",
  dangerAlpha: "rgba(215, 49, 38, 0.15)",
  infoAlpha: "rgba(0, 122, 255, 0.15)",

  textPrimary: "#1c1c1e",
  textSecondary: "#3a3a3c",
  grid: "#f0f0f0",
  gridDark: "#bbb",
} as const;

export const OPTIONS_SEMANTIC_COLORS = {
  spot: "#007AFF",
  forward: "#00C7BE", // cyan, draw as dashed
  putWall: "#d73126",
  callWall: "#20a945",
  maxPain: "#D78100",
  gammaFlip: "#8E44AD",

  bullish: "#20a945",
  bearish: "#d73126",
  neutral: "#8E8E93",

  bgPositive: "rgba(32, 169, 69, 0.06)",
  bgNegative: "rgba(215, 49, 38, 0.06)",
  bgNeutral: "rgba(142, 142, 147, 0.06)",
  bgInfo: "rgba(0, 122, 255, 0.06)",

  fillPositive: "rgba(32, 169, 69, 0.5)",
  fillNegative: "rgba(215, 49, 38, 0.5)",
  fillInfo: "rgba(0, 122, 255, 0.5)",

  arrowUp: "\u25B2",
  arrowDown: "\u25BC",
  diamond: "\u25C6",
} as const;

export function getColorForPercentage(
  percentage: number,
  thresholds: { low: number; medium: number } = { low: 50, medium: 75 },
): string {
  if (percentage >= thresholds.medium) return CHART_COLORS.danger;
  if (percentage >= thresholds.low) return CHART_COLORS.warning;
  return CHART_COLORS.success;
}

export function getColorForValue(value: number): string {
  return value >= 0 ? CHART_COLORS.success : CHART_COLORS.danger;
}

export function getHeatmapColor(normalizedValue: number): string {
  const colors = CHART_COLORS.heatmapScale;
  const clamped = Math.max(-1, Math.min(1, normalizedValue));
  const index = ((clamped + 1) / 2) * (colors.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return colors[lower];

  const fraction = index - lower;
  const colorLower = parseColor(colors[lower]);
  const colorUpper = parseColor(colors[upper]);

  return `rgb(${Math.round(
    colorLower.r + (colorUpper.r - colorLower.r) * fraction,
  )}, ${Math.round(
    colorLower.g + (colorUpper.g - colorLower.g) * fraction,
  )}, ${Math.round(colorLower.b + (colorUpper.b - colorLower.b) * fraction)})`;
}

function parseColor(rgb: string): { r: number; g: number; b: number } {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
  };
}

export const CHART_FONTS = {
  // 9px — standard chart labels and ticks
  label: "600 9px -apple-system, BlinkMacSystemFont, sans-serif",
  labelBold: "700 9px -apple-system, BlinkMacSystemFont, sans-serif",
  labelSmall: "500 9px -apple-system, BlinkMacSystemFont, sans-serif",
  tick: "10px -apple-system, BlinkMacSystemFont, sans-serif",
  tickSmall: "9px -apple-system, BlinkMacSystemFont, sans-serif",
  axis: "500 10px -apple-system, BlinkMacSystemFont, sans-serif",
  // 8px — dense/compact canvas elements (contour labels, event badges, compact cells)
  dense: "600 8px -apple-system, BlinkMacSystemFont, sans-serif",
  denseBold: "700 8px -apple-system, BlinkMacSystemFont, sans-serif",
  denseLight: "500 8px -apple-system, BlinkMacSystemFont, sans-serif",
  // 10px semibold/bold — heatmap axis, summary headers, spot labels
  axisSemibold: "600 10px -apple-system, BlinkMacSystemFont, sans-serif",
  axisBold: "700 10px -apple-system, BlinkMacSystemFont, sans-serif",
  // 11px — heatmap headers and cell values
  heatmap: "600 11px -apple-system, BlinkMacSystemFont, sans-serif",
  heatmapBold: "700 11px -apple-system, BlinkMacSystemFont, sans-serif",
  heatmapLight: "500 11px -apple-system, BlinkMacSystemFont, sans-serif",
  // 12px — row labels for large heatmaps
  rowLabel: "500 12px -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

export const CHART_ANIMATIONS = {
  initial: {
    duration: 800,
    easing: "easeInOutCubic" as const,
  },
  update: {
    duration: 300,
    easing: "easeOutCubic" as const,
  },
  none: {
    duration: 0,
  },
} as const;

export const CHART_TOOLTIP_CONFIG = {
  enabled: true,
  mode: "index" as const,
  intersect: false,
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  titleColor: CHART_COLORS.textPrimary,
  bodyColor: CHART_COLORS.textSecondary,
  borderColor: "rgba(0, 0, 0, 0.1)",
  borderWidth: 1,
  padding: 14,
  cornerRadius: 8,
  displayColors: true,
} as const;

export const CHART_LEGEND_CONFIG = {
  display: false,
  position: "right" as const,
  align: "center" as const,
  labels: {
    font: {
      family:
        'var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      size: 12,
    },
    color: CHART_COLORS.textSecondary,
    padding: 10,
    usePointStyle: true,
    pointStyle: "circle" as const,
  },
} as const;

const CHART_LEGEND_TOP = {
  display: true,
  position: "top" as const,
  labels: {
    font: { size: 11 },
    boxWidth: 14,
    padding: 10,
    usePointStyle: true,
  },
} as const;

export const TIME_X_AXIS = {
  grid: { display: false },
  ticks: {
    font: { size: 11 },
    maxRotation: 45,
    autoSkip: true,
    maxTicksLimit: 12,
  },
} as const;

export function yAxis(title?: string, extra?: Record<string, unknown>) {
  return {
    grid: { color: "rgba(0,0,0,0.06)" },
    ...(title
      ? { title: { display: true, text: title, font: { size: 10 } } }
      : {}),
    ...extra,
  };
}

export function baseChartOptions(overrides?: Record<string, unknown>) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: CHART_LEGEND_TOP,
      tooltip: { ...CHART_TOOLTIP_CONFIG },
    },
    ...overrides,
  };
}

/**
 * Compute Chart.js-ready `min`, `max`, and `ticks.stepSize` from data values.
 * Spread the result into a Chart.js scale config:
 *   `y: { ...yAxis('Price'), ...niceLinearScale(values) }`
 */
export function niceLinearScale(
  values: (number | null | undefined)[],
  opts?: Partial<Omit<NiceScaleOptions, "dataMin" | "dataMax">>,
): { min: number; max: number; ticks: { stepSize: number } } {
  const s = niceScaleFromValues(values, opts);
  return { min: s.min, max: s.max, ticks: { stepSize: s.step } };
}

/**
 * Create tick config for a category axis with numeric labels (e.g. strike prices).
 * Shows labels only at "nice" round intervals instead of arbitrary autoSkip values.
 * Spread into `ticks`: `x: { ticks: { font: …, ...niceStrikeTicks(labels) } }`
 */
export function niceStrikeTicks(labels: string[]): {
  autoSkip: false;
  callback: (value: any, index: number) => string | null;
} {
  const nums = labels.map(Number);
  const valid = nums.filter((n) => !isNaN(n));

  if (valid.length < 3) {
    return {
      autoSkip: false,
      callback: (_v: any, i: number) => labels[i] ?? null,
    };
  }

  const { step } = niceScaleFromValues(valid, { maxTicks: 12, padding: 0 });
  if (step <= 0) {
    return {
      autoSkip: false,
      callback: (_v: any, i: number) => labels[i] ?? null,
    };
  }

  return {
    autoSkip: false,
    callback: (_value: any, index: number): string | null => {
      const s = nums[index];
      if (isNaN(s)) return labels[index] ?? null;
      const rem = ((s % step) + step) % step;
      return rem < step * 0.001 || step - rem < step * 0.001
        ? labels[index]
        : null;
    },
  };
}
