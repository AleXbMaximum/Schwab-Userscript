// Color tokens — three independent semantic layers (no proxying).
// Mirrors AlexQuant UI palette so light/dark variants share a vocabulary.
//
//   layer            handle              CSS var               hue intent
//   ─────────────    ────────────────    ──────────────────    ──────────────────
//   palette accent   AXC.green / AXC.red --ax-green/--ax-red   saturated, for
//                                                              status dots,
//                                                              BUY/SELL buttons,
//                                                              chart shapes
//
//   P&L sign         AX_TONE.positive    --ax-positive         desaturated, for
//                    AX_TONE.negative    --ax-negative         dashboards / tables
//
//   alert severity   AX_CRITICAL.text    --ax-critical         saturated red,
//                                        --ax-critical-soft-bg reserved for P0
//                                        --ax-critical-border  alerts
//
//   zero / missing   var(--ax-fg-muted)  (existing)            signColor(0|null)
//                                                              returns this; "-"
//                                                              is the textual
//                                                              placeholder

import { isDarkTheme } from "../axTheme/controller";

export const AX_LIGHT_RAW = {
  blue: "#007AFF",
  darkBlue: "#0062CC",
  green: "rgb(32, 169, 69)",
  orange: "rgb(215, 129, 0)",
  red: "rgb(215, 49, 38)",
  gray: "rgb(142, 142, 147)",
  cyan: "#5AC8FA",
  purple: "#5856D6",
  yellow: "#FFCC00",

  fg: "#1c1c1e",
  fg2: "#3a3a3c",
  fgMuted: "#8E8E93",

  // Desaturated P&L sign colors. Distinct from palette green/red so dashboards
  // with many rows of P&L numbers feel calm; palette green/red stay vibrant
  // for accents and chart shapes.
  positive: "rgb(56, 150, 75)",
  negative: "rgb(195, 75, 64)",
  neutral: "#D78100",
  info: "#007AFF",
  muted: "#8E8E93",

  // Sharp alert red — reserved for P0 alerts and severityColors("critical").
  critical: "rgb(215, 49, 38)",

  textPrimary: "#1c1c1e",
  textSecondary: "#3a3a3c",
  tableHeader: "#1b5fa7",

  // Canvas-side tooltip (high alpha — chart canvases can't do backdrop-filter).
  tooltipBg: "rgba(255, 255, 255, 0.95)",
  tooltipBorder: "rgba(0, 0, 0, 0.15)",
} as const;

export const AX_DARK_RAW = {
  blue: "#0A84FF",
  darkBlue: "#409CFF",
  green: "#34C759",
  orange: "#FF9500",
  red: "#FF453A",
  gray: "#A2A2A7",
  cyan: "#70D7FF",
  purple: "#BF5AF2",
  yellow: "#FFD60A",

  fg: "#f2f2f4",
  fg2: "#c8c8cc",
  fgMuted: "#9a9aa0",

  positive: "#3DBE65",
  negative: "#E8554A",
  neutral: "#FF9500",
  info: "#0A84FF",
  muted: "#A2A2A7",

  critical: "#FF453A",

  textPrimary: "#f2f2f4",
  textSecondary: "#c8c8cc",
  tableHeader: "#6bb3f0",

  tooltipBg: "rgba(18, 18, 22, 0.95)",
  tooltipBorder: "rgba(255, 255, 255, 0.12)",
} as const;

export type AxRawColors = { [K in keyof typeof AX_LIGHT_RAW]: string };

// ── Palette handles (CSS-var form, preferred in DOM styling) ────────────────

export const AXC = {
  blue: "var(--ax-blue)",
  green: "var(--ax-green)",
  red: "var(--ax-red)",
  orange: "var(--ax-orange)",
  gray: "var(--ax-gray)",
  cyan: "var(--ax-cyan)",
  purple: "var(--ax-purple)",
  yellow: "var(--ax-yellow)",
} as const;

// ── Semantic tones ──────────────────────────────────────────────────────────

export type AxTone = "positive" | "negative" | "neutral" | "info" | "muted";

export const AX_TONE = {
  positive: "var(--ax-positive)",
  negative: "var(--ax-negative)",
  neutral: AXC.orange,
  info: AXC.blue,
  muted: AXC.gray,
} as const satisfies Record<AxTone, string>;

export const AX_TONE_BG = {
  positive: "var(--ax-tone-positive-bg)",
  negative: "var(--ax-tone-negative-bg)",
  neutral: "var(--ax-tone-neutral-bg)",
  info: "var(--ax-tone-info-bg)",
  muted: "var(--ax-tone-muted-bg)",
} as const satisfies Record<AxTone, string>;

export const AX_TONE_BORDER = {
  positive: "var(--ax-tone-positive-border)",
  negative: "var(--ax-tone-negative-border)",
  neutral: "var(--ax-tone-neutral-border)",
  info: "var(--ax-tone-info-border)",
  muted: "var(--ax-tone-muted-border)",
} as const satisfies Record<AxTone, string>;

export const AX_TONE_BG_SOFT = {
  positive: "var(--ax-tone-positive-soft-bg)",
  negative: "var(--ax-tone-negative-soft-bg)",
  neutral: "var(--ax-tone-neutral-soft-bg)",
  info: "var(--ax-tone-info-soft-bg)",
  muted: "var(--ax-tone-muted-soft-bg)",
} as const satisfies Record<AxTone, string>;

export const AX_CRITICAL = {
  text: "var(--ax-critical)",
  bg: "var(--ax-critical-soft-bg)",
  border: "var(--ax-critical-border)",
} as const;

export const AX_FG = {
  primary: "var(--ax-fg)",
  secondary: "var(--ax-fg-2)",
  muted: "var(--ax-fg-muted)",
  onAccent: "#ffffff",
  link: "var(--ax-blue)",
  tableHead: "var(--ax-table-head)",
} as const;

// ── Raw hex getter (for canvas / Chart.js callbacks) ────────────────────────

export function getAxRawColors(): AxRawColors {
  return (isDarkTheme() ? AX_DARK_RAW : AX_LIGHT_RAW) as AxRawColors;
}

/**
 * Compose a CSS rgba() string from a raw theme colour.
 * Supports `#rgb`, `#rrggbb`, and `rgb(r, g, b)` inputs.
 */
export function axColorWithAlpha(color: string, alpha: number): string {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const rgbMatch = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(color);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  const shortHexMatch = /^#([\da-f]{3})$/i.exec(color);
  const fullHexMatch = /^#([\da-f]{6})$/i.exec(color);
  let hex = fullHexMatch?.[1] ?? "";

  if (!hex && shortHexMatch) {
    hex = shortHexMatch[1]
      .split("")
      .map((part) => part + part)
      .join("");
  }

  if (!hex) return color;

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

/** P&L colour for DOM (returns CSS-var reference). */
export function axSignColor(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) {
    return "var(--ax-fg-muted)";
  }
  return value > 0 ? "var(--ax-positive)" : "var(--ax-negative)";
}

/** P&L colour for canvas / Chart.js (returns raw hex / rgb string). */
export function axSignColorRaw(value: number | null | undefined): string {
  const raw = getAxRawColors();
  if (value == null || !Number.isFinite(value) || value === 0) return raw.fgMuted;
  return value > 0 ? raw.positive : raw.negative;
}

/** Severity color triplet (text + bg + border) for info / warning / critical. */
export function axSeverityColors(
  severity: "critical" | "warning" | "info",
): { text: string; bg: string; border: string } {
  const raw = getAxRawColors();
  if (severity === "critical") {
    return { text: raw.critical, bg: AX_CRITICAL.bg, border: AX_CRITICAL.border };
  }
  if (severity === "warning") {
    return { text: raw.neutral, bg: AX_TONE_BG_SOFT.neutral, border: AX_TONE_BORDER.neutral };
  }
  return { text: raw.positive, bg: AX_TONE_BG_SOFT.positive, border: AX_TONE_BORDER.positive };
}
