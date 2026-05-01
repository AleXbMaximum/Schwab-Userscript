// Canvas and Chart.js colors. Theme-aware: returns light or dark palette
// depending on the current AlexQuant theme controller state.
//
// Existing callsites import `CHART_COLORS`, `OPTIONS_SEMANTIC_COLORS`,
// `CHART_TOOLTIP_CONFIG`, `CHART_LEGEND_CONFIG`, etc. as constants — those
// references still resolve, but now they are getters in disguise
// (Object.freeze proxy) so each property read returns the current-theme
// value. Static destructuring at module load (`const { success } = CHART_COLORS`)
// snapshots the value, so prefer reading the field at call time inside
// chart callbacks for proper theme reactivity.

import {
  niceScaleFromValues,
  type NiceScaleOptions,
} from "shared/utils/math/scale";
import { getAxRawColors } from "frontend/components/core/axTokens/colors";
import {
  AX_CHART_COLORS_LIGHT,
  getAxChartColors,
} from "frontend/components/core/axTheme/chartTheme";
import { isDarkTheme } from "frontend/components/core/axTheme/controller";

// ── Theme-aware palette proxy ───────────────────────────────────────────
// Each property read goes through getAxChartColors(), so chart callbacks
// pick up the active theme without any additional plumbing.
type ChartColorSet = typeof AX_CHART_COLORS_LIGHT;

function makeReactive<T extends object>(): T {
  return new Proxy(
    {},
    {
      get(_t, prop: string) {
        return (getAxChartColors() as unknown as Record<string, unknown>)[prop];
      },
      ownKeys() {
        return Object.keys(AX_CHART_COLORS_LIGHT);
      },
      getOwnPropertyDescriptor(_t, prop: string) {
        if (prop in (AX_CHART_COLORS_LIGHT as unknown as Record<string, unknown>)) {
          return { configurable: true, enumerable: true, writable: false, value: undefined };
        }
        return undefined;
      },
    },
  ) as T;
}

export const CHART_COLORS: ChartColorSet = makeReactive<ChartColorSet>();

// ── Options-chain domain colors (theme-aware) ───────────────────────────
// Saturated palette → candle bodies, walls, GEX bars; `forward` / `gammaFlip`
// are options-specific hues without a palette equivalent.
function rgba(hex: string, alpha: number): string {
  if (hex.startsWith("rgba") || hex.startsWith("rgb(")) return hex;
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type OptionsSemanticSet = {
  spot: string;
  forward: string;
  putWall: string;
  callWall: string;
  maxPain: string;
  gammaFlip: string;
  bullish: string;
  bearish: string;
  neutral: string;
  bgPositive: string;
  bgNegative: string;
  bgNeutral: string;
  bgInfo: string;
  fillPositive: string;
  fillNegative: string;
  fillInfo: string;
  arrowUp: string;
  arrowDown: string;
  diamond: string;
};

function buildOptionsSemantic(dark: boolean): OptionsSemanticSet {
  const r = dark ? AX_CHART_COLORS_LIGHT : AX_CHART_COLORS_LIGHT; // placeholder, replaced below
  // Rebuild from raw palette to ensure correct light/dark hex.
  const raw = getAxRawColors();
  void r;
  return {
    spot: raw.info,
    forward: "#00C7BE",
    putWall: raw.red,
    callWall: raw.green,
    maxPain: raw.neutral,
    gammaFlip: "#8E44AD",
    bullish: raw.green,
    bearish: raw.red,
    neutral: raw.muted,
    bgPositive: rgba(raw.green, 0.06),
    bgNegative: rgba(raw.red, 0.06),
    bgNeutral: rgba(raw.muted, 0.06),
    bgInfo: rgba(raw.info, 0.06),
    fillPositive: rgba(raw.green, 0.5),
    fillNegative: rgba(raw.red, 0.5),
    fillInfo: rgba(raw.info, 0.5),
    arrowUp: "▲",
    arrowDown: "▼",
    diamond: "◆",
  };
}

let _optionsSemLight: OptionsSemanticSet | null = null;
let _optionsSemDark: OptionsSemanticSet | null = null;

function getOptionsSemantic(): OptionsSemanticSet {
  if (isDarkTheme()) {
    if (!_optionsSemDark) _optionsSemDark = buildOptionsSemantic(true);
    return _optionsSemDark;
  }
  if (!_optionsSemLight) _optionsSemLight = buildOptionsSemantic(false);
  return _optionsSemLight;
}

export const OPTIONS_SEMANTIC_COLORS: OptionsSemanticSet =
  new Proxy({} as OptionsSemanticSet, {
    get(_t, prop: string) {
      return (getOptionsSemantic() as unknown as Record<string, unknown>)[prop];
    },
  }) as OptionsSemanticSet;

// ── Helpers (theme-aware) ───────────────────────────────────────────────

export function getColorForPercentage(
  percentage: number,
  thresholds: { low: number; medium: number } = { low: 50, medium: 75 },
): string {
  const c = getAxChartColors();
  if (percentage >= thresholds.medium) return c.danger;
  if (percentage >= thresholds.low) return c.warning;
  return c.success;
}

export function getColorForValue(value: number): string {
  const c = getAxChartColors();
  return value >= 0 ? c.success : c.danger;
}

export function getHeatmapColor(normalizedValue: number): string {
  const colors = getAxChartColors().heatmapScale;
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

function parseColor(input: string): { r: number; g: number; b: number } {
  const m = input.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m)
    return {
      r: parseInt(m[1], 10),
      g: parseInt(m[2], 10),
      b: parseInt(m[3], 10),
    };
  const h = input.match(/^#?([0-9a-f]{6})$/i);
  if (h)
    return {
      r: parseInt(h[1].slice(0, 2), 16),
      g: parseInt(h[1].slice(2, 4), 16),
      b: parseInt(h[1].slice(4, 6), 16),
    };
  return { r: 255, g: 255, b: 255 };
}

export const CHART_FONTS = {
  label: "600 9px -apple-system, BlinkMacSystemFont, sans-serif",
  labelBold: "700 9px -apple-system, BlinkMacSystemFont, sans-serif",
  labelSmall: "500 9px -apple-system, BlinkMacSystemFont, sans-serif",
  tick: "10px -apple-system, BlinkMacSystemFont, sans-serif",
  tickSmall: "9px -apple-system, BlinkMacSystemFont, sans-serif",
  axis: "500 10px -apple-system, BlinkMacSystemFont, sans-serif",
  dense: "600 8px -apple-system, BlinkMacSystemFont, sans-serif",
  denseBold: "700 8px -apple-system, BlinkMacSystemFont, sans-serif",
  denseLight: "500 8px -apple-system, BlinkMacSystemFont, sans-serif",
  axisSemibold: "600 10px -apple-system, BlinkMacSystemFont, sans-serif",
  axisBold: "700 10px -apple-system, BlinkMacSystemFont, sans-serif",
  heatmap: "600 11px -apple-system, BlinkMacSystemFont, sans-serif",
  heatmapBold: "700 11px -apple-system, BlinkMacSystemFont, sans-serif",
  heatmapLight: "500 11px -apple-system, BlinkMacSystemFont, sans-serif",
  rowLabel: "500 12px -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

export const CHART_ANIMATIONS = {
  initial: { duration: 800, easing: "easeInOutCubic" as const },
  update: { duration: 300, easing: "easeOutCubic" as const },
  none: { duration: 0 },
} as const;

// ── Theme-aware tooltip / legend / axis configs ─────────────────────────

type TooltipConfig = {
  enabled: boolean;
  mode: "index";
  intersect: boolean;
  backgroundColor: string;
  titleColor: string;
  bodyColor: string;
  borderColor: string;
  borderWidth: number;
  padding: number;
  cornerRadius: number;
  displayColors: boolean;
};

function buildTooltipConfig(): TooltipConfig {
  const raw = getAxRawColors();
  const colors = getAxChartColors();
  return {
    enabled: true,
    mode: "index",
    intersect: false,
    backgroundColor: raw.tooltipBg,
    titleColor: colors.textPrimary,
    bodyColor: colors.textSecondary,
    borderColor: raw.tooltipBorder,
    borderWidth: 1,
    padding: 14,
    cornerRadius: 8,
    displayColors: true,
  };
}

export const CHART_TOOLTIP_CONFIG: TooltipConfig =
  new Proxy({} as TooltipConfig, {
    get(_t, prop: string) {
      return (buildTooltipConfig() as Record<string, unknown>)[prop];
    },
  }) as TooltipConfig;

export function getChartTooltipConfig(): TooltipConfig {
  return buildTooltipConfig();
}

export const CHART_LEGEND_CONFIG = {
  display: false,
  position: "right" as const,
  align: "center" as const,
  labels: {
    font: { family: "var(--ax-font-body)", size: 12 },
    color: "var(--ax-fg-2)",
    padding: 10,
    usePointStyle: true,
    pointStyle: "circle" as const,
  },
} as const;

const CHART_LEGEND_TOP = {
  display: true,
  position: "top" as const,
  labels: { font: { size: 11 }, boxWidth: 14, padding: 10, usePointStyle: true },
} as const;

export const TIME_X_AXIS = {
  grid: { display: false },
  ticks: { font: { size: 11 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 12 },
} as const;

export function yAxis(title?: string, extra?: Record<string, unknown>) {
  const tickColor = getAxChartColors().textSecondary;
  return {
    grid: { color: isDarkTheme() ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" },
    ticks: { color: tickColor },
    ...(title
      ? {
          title: {
            display: true,
            text: title,
            font: { size: 10 },
            color: tickColor,
          },
        }
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
      legend: {
        ...CHART_LEGEND_TOP,
        labels: {
          ...CHART_LEGEND_TOP.labels,
          color: getAxChartColors().textSecondary,
        },
      },
      tooltip: { ...buildTooltipConfig() },
    },
    ...overrides,
  };
}

export function niceLinearScale(
  values: (number | null | undefined)[],
  opts?: Partial<Omit<NiceScaleOptions, "dataMin" | "dataMax">>,
): { min: number; max: number; ticks: { stepSize: number; color: string } } {
  const s = niceScaleFromValues(values, opts);
  return {
    min: s.min,
    max: s.max,
    ticks: { stepSize: s.step, color: getAxChartColors().textSecondary },
  };
}

export function niceStrikeTicks(labels: string[]): {
  autoSkip: false;
  color: string;
  callback: (value: any, index: number) => string | null;
} {
  const nums = labels.map(Number);
  const valid = nums.filter((n) => !isNaN(n));
  const color = getAxChartColors().textSecondary;

  if (valid.length < 3) {
    return {
      autoSkip: false,
      color,
      callback: (_v: any, i: number) => labels[i] ?? null,
    };
  }

  const { step } = niceScaleFromValues(valid, { maxTicks: 12, padding: 0 });
  if (step <= 0) {
    return {
      autoSkip: false,
      color,
      callback: (_v: any, i: number) => labels[i] ?? null,
    };
  }

  return {
    autoSkip: false,
    color,
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
