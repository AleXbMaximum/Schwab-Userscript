// Chart palette and option helpers — theme-aware, derived from axTokens.
// Canvas + Chart.js contexts read raw hex from here; DOM styling should use
// CSS-var tokens instead.

import { AX_LIGHT_RAW, AX_DARK_RAW, type AxRawColors } from "../axTokens/colors";
import { isDarkTheme } from "./controller";

function rgba(hex: string, alpha: number): string {
  if (hex.startsWith("rgba") || hex.startsWith("rgb(")) return hex;
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface AxChartColorSet {
  success: string;
  warning: string;
  danger: string;
  info: string;
  neutral: string;

  categorical: string[];
  heatmapScale: string[];

  successAlpha: string;
  warningAlpha: string;
  dangerAlpha: string;
  infoAlpha: string;

  textPrimary: string;
  textSecondary: string;
  grid: string;
  gridDark: string;
}

function buildChartColors(palette: AxRawColors, dark: boolean): AxChartColorSet {
  const alpha = dark ? 0.2 : 0.15;
  return {
    success: palette.green,
    warning: palette.neutral,
    danger: palette.red,
    info: palette.info,
    neutral: palette.muted,

    categorical: [
      palette.blue,
      palette.green,
      palette.orange,
      palette.purple,
      "#FF2D55",
      palette.cyan,
      palette.yellow,
      "#BF5AF2",
    ],

    heatmapScale: dark
      ? [
          palette.red,
          palette.neutral,
          "rgb(100, 100, 110)",
          "rgb(80, 200, 120)",
          palette.green,
        ]
      : [
          palette.red,
          palette.neutral,
          "rgb(255, 255, 255)",
          "rgb(144, 238, 144)",
          palette.green,
        ],

    successAlpha: rgba(palette.green, alpha),
    warningAlpha: rgba(palette.neutral, alpha),
    dangerAlpha: rgba(palette.red, alpha),
    infoAlpha: rgba(palette.info, alpha),

    textPrimary: palette.textPrimary,
    textSecondary: palette.textSecondary,
    grid: dark ? "rgba(255, 255, 255, 0.08)" : "#f0f0f0",
    gridDark: dark ? "#555" : "#bbb",
  };
}

export const AX_CHART_COLORS_LIGHT: AxChartColorSet = buildChartColors(AX_LIGHT_RAW, false);
export const AX_CHART_COLORS_DARK: AxChartColorSet = buildChartColors(AX_DARK_RAW, true);

/** Returns theme-aware chart colors (light or dark palette). */
export function getAxChartColors(): AxChartColorSet {
  return isDarkTheme() ? AX_CHART_COLORS_DARK : AX_CHART_COLORS_LIGHT;
}
