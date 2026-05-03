// Design-system tokens consumed by every page renderer.
//
// Backed by the AlexQuant `--ax-*` CSS-var system in ./axTheme. The legacy
// `--ios-*` / `--lg-*` / `--glass-*` names still resolve (they're aliased
// inside cssVars) so DS_* values stay compatible with older callsites that
// inline raw vars.
//
// Theme awareness:
//   - DS_COLORS.* / DS_TYPOGRAPHY.* / DS_COMPONENTS.* / DS_BUTTONS.* —
//     reference --ax-* CSS vars and are therefore automatic in light/dark
//     mode (controlled by `body.theme-dark`).
//   - DS_COLORS.raw — getter that returns raw hex/rgb for canvas / Chart.js
//     callbacks where CSS vars aren't available. Re-evaluates on each access.

import { getAxRawColors } from "../axTokens/colors";

// ============================================================
// SECTION SHELL — Tier-2 liquid-glass panel surface
//
// These string mixins are still emitted for legacy callsites that compose
// `styleString:` from raw concatenations. Going forward, prefer the utility
// classes `.ax-glass-2`, `.ax-glass-rim` from baseCss.ts — they're ~80%
// shorter, hot-swap with theme changes, and pick up rim animation for free.
// ============================================================

const SECTION_BOX =
  "background: var(--ax-glass-2-bg);" +
  " backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));" +
  " -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));" +
  " border-radius: var(--ax-radius-xl); padding: 20px;" +
  " box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);" +
  " border: 1px solid var(--ax-glass-2-border); margin-bottom: 20px;";

// ============================================================
// 1. COLOR TOKENS
// ============================================================

type RawSwatch = {
  positive: string;
  negative: string;
  neutral: string;
  info: string;
  muted: string;
  textPrimary: string;
  textSecondary: string;
  tableHeader: string;
  cyan: string;
  purple: string;
};

function getRawSwatch(): RawSwatch {
  const r = getAxRawColors();
  return {
    positive: r.positive,
    negative: r.negative,
    neutral: r.neutral,
    info: r.info,
    muted: r.muted,
    textPrimary: r.textPrimary,
    textSecondary: r.textSecondary,
    tableHeader: r.tableHeader,
    cyan: r.cyan,
    purple: r.purple,
  };
}

export const DS_COLORS = {
  positive: "var(--ax-positive)",
  negative: "var(--ax-negative)",
  neutral: "var(--ax-orange)",
  info: "var(--ax-blue)",
  muted: "var(--ax-gray)",

  textPrimary: "var(--ax-fg)",
  textSecondary: "var(--ax-fg-2)",
  border: "var(--ax-border)",
  lightGray: "var(--ax-tone-muted-bg)",
  tableHeader: "var(--ax-table-head)",
  white: "#ffffff",
  cyan: "var(--ax-cyan)",
  purple: "var(--ax-purple)",

  // Theme-aware raw hex/rgb getter for canvas / Chart.js callbacks.
  // Each property is a getter so the value reflects the current theme.
  get raw(): RawSwatch {
    return getRawSwatch();
  },

  bgPositive: "var(--ax-tone-positive-soft-bg)",
  bgNegative: "var(--ax-tone-negative-soft-bg)",
  bgNeutral: "var(--ax-tone-neutral-soft-bg)",
  bgInfo: "var(--ax-tone-info-soft-bg)",
  bgMuted: "var(--ax-tone-muted-soft-bg)",
  bgSubtle: "var(--ax-bg-glass-inset)",
  bgPanel: "var(--ax-glass-2-bg)",
} as const;

// ============================================================
// 2. TYPOGRAPHY PRESETS
// ============================================================

export const DS_TYPOGRAPHY = {
  panelTitle:
    "margin: 0 0 4px 0; font-size: var(--ax-fs-xl); font-weight: var(--ax-fw-bold); color: var(--ax-fg); letter-spacing: -0.2px;",

  panelDesc:
    "font-size: var(--ax-fs-sm); color: var(--ax-fg-2); margin-bottom: 8px;",

  metricLabel:
    "font-size: var(--ax-fs-xs); font-weight: var(--ax-fw-bold); color: var(--ax-fg-2); text-transform: uppercase; letter-spacing: 0.4px;",

  metricLabelMini:
    "font-size: var(--ax-fs-2xs); color: var(--ax-fg-2); text-transform: uppercase;",

  metricValue:
    "font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-semibold); color: var(--ax-fg); font-variant-numeric: tabular-nums lining-nums;",

  bodyText:
    "font-size: var(--ax-fs-md); color: var(--ax-fg-2); line-height: 1.4;",

  caption:
    "font-size: var(--ax-fs-xs); color: var(--ax-fg-2);",

  controlLabel:
    "font-size: var(--ax-fs-md); font-weight: var(--ax-fw-medium); color: var(--ax-fg-2);",

  cardLabel:
    "font-size: var(--ax-fs-md); font-weight: var(--ax-fw-semibold); color: var(--ax-fg); flex: 1;",

  cardMeta:
    "font-size: var(--ax-fs-sm); color: var(--ax-fg-2);",

  sectionHeader: (color?: string): string =>
    `font-size: var(--ax-fs-xs); font-weight: var(--ax-fw-bold); text-transform: uppercase; letter-spacing: 0.6px; white-space: nowrap; color: ${color ?? "var(--ax-fg-2)"};`,

  pageTitle:
    "font-size: var(--ax-fs-3xl); font-weight: var(--ax-fw-semibold); color: var(--ax-fg); margin: 0 0 16px 0;",

  heading:
    "font-size: var(--ax-fs-lg); font-weight: var(--ax-fw-bold); color: var(--ax-fg); line-height: 1.3;",

  compact:
    "font-size: var(--ax-fs-xs); color: var(--ax-fg-2); line-height: 1.3;",

  mono:
    "font-size: var(--ax-fs-md); font-weight: var(--ax-fw-semibold); color: var(--ax-fg); font-family: var(--ax-font-mono); font-variant-numeric: tabular-nums lining-nums;",

  largeValue:
    "font-size: var(--ax-fs-3xl); font-weight: var(--ax-fw-heavy); color: var(--ax-fg); line-height: 1; letter-spacing: -0.5px; font-variant-numeric: tabular-nums lining-nums;",
} as const;

// ============================================================
// 3. COMPONENT STYLE PRESETS
// ============================================================

export const DS_COMPONENTS = {
  panel: SECTION_BOX + " margin-bottom: 0;",

  card:
    "background: var(--ax-glass-2-bg);" +
    " backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));" +
    " -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate)) brightness(var(--ax-glass-2-brightness));" +
    " border-radius: var(--ax-radius-lg); padding: 16px;" +
    " box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);" +
    " border: 1px solid var(--ax-glass-2-border);",

  collapsibleCard:
    "border: 1px solid var(--ax-glass-2-border); border-radius: var(--ax-radius-lg); overflow: hidden;" +
    " background: var(--ax-glass-2-bg);" +
    " box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);",

  collapsibleHeader:
    "display: flex; align-items: center; gap: 8px; padding: 9px 13px; cursor: pointer; user-select: none; color: var(--ax-fg);",

  collapsibleBody:
    "display: none; padding: 10px 13px; border-top: 1px solid var(--ax-border-subtle); color: var(--ax-fg);",

  collapsibleBodyFlex:
    "padding: 10px 13px; border-top: 1px solid var(--ax-border-subtle); display: flex; flex-direction: column; gap: 10px; color: var(--ax-fg);",

  caret:
    "font-size: var(--ax-fs-2xs); color: var(--ax-fg-2); transition: transform 0.2s; flex-shrink: 0;",

  statusDot: (color: string): string =>
    `width: 7px; height: 7px; border-radius: 50%; background: ${color}; flex-shrink: 0;`,

  metricCell:
    "background: var(--ax-glass-1-bg); border: 1px solid var(--ax-glass-1-border);" +
    " box-shadow: var(--ax-glass-1-shadow), var(--ax-glass-1-edge);" +
    " border-radius: var(--ax-radius-sm); padding: 5px 7px;" +
    " display: flex; flex-direction: column; gap: 1px;",

  metricCellInline:
    "background: var(--ax-glass-1-bg); border: 1px solid var(--ax-glass-1-border);" +
    " box-shadow: var(--ax-glass-1-shadow), var(--ax-glass-1-edge);" +
    " border-radius: var(--ax-radius-sm); padding: 4px 8px;" +
    " display: flex; gap: 4px; align-items: center;",

  dataSection: "display: flex; flex-direction: column; gap: 5px;",

  driverItem:
    "padding: 6px 10px; border-radius: var(--ax-radius-md); font-size: var(--ax-fs-sm); line-height: 1.35;" +
    " background: var(--ax-glass-1-bg); color: var(--ax-fg-2); border: 1px solid var(--ax-glass-1-border);",

  newsItem:
    "display: flex; flex-direction: column; gap: 2px; padding: 5px 8px;" +
    " background: var(--ax-glass-1-bg); border: 1px solid var(--ax-glass-1-border);" +
    " border-radius: var(--ax-radius-sm);",

  table:
    "width: 100%; border-collapse: separate; border-spacing: 0;" +
    " border-radius: var(--ax-radius-md); overflow: hidden;" +
    " border: 1px solid var(--ax-border); background: var(--ax-bg-table);",

  tableHeader:
    "text-align: left; padding: 8px 10px; font-size: var(--ax-fs-sm);" +
    " font-weight: var(--ax-fw-semibold); color: var(--ax-table-head); letter-spacing: 0.2px;" +
    " border-bottom: 1px solid var(--ax-border-subtle); background: var(--ax-bg-table-head);",

  tableCell:
    "padding: 7px 10px; font-size: var(--ax-fs-md); color: var(--ax-fg);" +
    " font-variant-numeric: tabular-nums lining-nums;",

  // ── Settings-panel form tokens ──────────────────────────────

  settingSectionTitle:
    "font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-bold); color: var(--ax-fg-2);" +
    " text-transform: uppercase; letter-spacing: 0.5px;",

  settingFieldLabel:
    "font-size: var(--ax-fs-sm); color: var(--ax-fg-2);",

  settingFieldInput:
    "padding: 6px 9px; font-size: var(--ax-fs-md); border: 1px solid var(--ax-border);" +
    " border-radius: var(--ax-radius-md); font-family: var(--ax-font-body);" +
    " background: var(--ax-bg-glass-inset); color: var(--ax-fg); outline: none;",

  settingSectionBox:
    "display: flex; flex-direction: column; gap: 8px; padding: 10px;" +
    " border: 1px solid var(--ax-glass-1-border); border-radius: var(--ax-radius-lg);" +
    " background: var(--ax-glass-1-bg);",

  settingDenseGrid:
    "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; align-items: start;",

  settingDenseCard:
    "display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 8px 10px;" +
    " border: 1px solid var(--ax-glass-1-border); border-radius: var(--ax-radius-lg);" +
    " background: var(--ax-glass-1-bg);",

  settingDenseHint:
    "font-size: var(--ax-fs-xs); color: var(--ax-fg-2); line-height: 1.3;",

  settingDenseRow:
    "display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: center; min-width: 0;",

  settingDenseValueGroup:
    "display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;",

  settingDenseInput:
    "width: 96px; padding: 4px 8px; font-size: var(--ax-fs-md); border: 1px solid var(--ax-border);" +
    " border-radius: var(--ax-radius-sm); font-family: var(--ax-font-body);" +
    " background: var(--ax-bg-glass-inset); color: var(--ax-fg); outline: none;",

  settingDenseUnit:
    "font-size: var(--ax-fs-xs); font-weight: var(--ax-fw-semibold); color: var(--ax-fg-2);" +
    " background: var(--ax-bg-glass-inset); border: 1px solid var(--ax-border-subtle);" +
    " border-radius: var(--ax-radius-xs); padding: 1px 5px; line-height: 1.2;",

  settingCheckbox:
    "width: 15px; height: 15px; cursor: pointer; accent-color: var(--ax-blue);",

  settingTextarea:
    "width: 100%; box-sizing: border-box; font-family: var(--ax-font-mono);" +
    " font-size: var(--ax-fs-md); line-height: 1.4; padding: 8px 9px;" +
    " border: 1px solid var(--ax-border); border-radius: var(--ax-radius-md);" +
    " background: var(--ax-bg-glass-inset); color: var(--ax-fg); resize: vertical;" +
    " transition: border-color 0.2s, box-shadow 0.2s; outline: none;",

  settingGroupStack: "display: flex; flex-direction: column; gap: 10px;",

  settingGroupCard:
    "display: flex; flex-direction: column; background: var(--ax-glass-2-bg);" +
    " border: 1px solid var(--ax-glass-2-border);" +
    " box-shadow: var(--ax-glass-2-shadow), var(--ax-glass-2-edge);" +
    " border-radius: var(--ax-radius-xl); overflow: hidden;",

  settingGroupHeader:
    "display: grid; grid-template-columns: minmax(0,1fr) 220px; align-items: center;" +
    " column-gap: 12px; padding: 12px 16px;" +
    " background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent);" +
    " border-bottom: 1px solid var(--ax-border-subtle);",

  settingGroupTitle:
    "font-size: var(--ax-fs-xl); font-weight: var(--ax-fw-semibold); color: var(--ax-fg); line-height: 1.25;",

  settingGroupBody:
    "display: flex; flex-direction: column; padding: 4px 16px 10px;",

  settingFormRow:
    "display: grid; grid-template-columns: minmax(0,1fr) 220px; align-items: center;" +
    " column-gap: 12px; min-height: 44px; padding: 8px 0;" +
    " border-bottom: 1px solid var(--ax-border-subtle);",

  settingFormLabel:
    "font-size: var(--ax-fs-lg); font-weight: var(--ax-fw-medium); color: var(--ax-fg); line-height: 1.25;",

  settingFormHelper:
    "font-size: var(--ax-fs-md); color: var(--ax-fg-2); line-height: 1.35; margin-top: 2px;",

  settingFormControl:
    "width: 220px; display: flex; justify-content: flex-end; align-items: center;",

  settingInputGroup:
    "width: 220px; display: inline-flex; align-items: center; gap: 6px; justify-content: flex-end;",

  settingFormInput:
    "width: 168px; padding: 6px 10px; font-size: var(--ax-fs-md);" +
    " border: 1px solid var(--ax-border); border-radius: var(--ax-radius-md);" +
    " font-family: var(--ax-font-body); background: var(--ax-bg-glass-inset);" +
    " color: var(--ax-fg); outline: none;",

  settingFormSuffix:
    "min-width: 44px; text-align: center; font-size: var(--ax-fs-sm);" +
    " font-weight: var(--ax-fw-semibold); color: var(--ax-fg-2);" +
    " background: var(--ax-bg-glass-inset); border: 1px solid var(--ax-border-subtle);" +
    " border-radius: var(--ax-radius-sm); padding: 2px 6px; line-height: 1.2;",

  settingSwitchTrack:
    "position: relative; width: 42px; height: 24px; border-radius: var(--ax-radius-pill);" +
    " border: 1px solid var(--ax-border-strong); background: var(--ax-tone-muted-bg);" +
    " transition: background 0.16s, border-color 0.16s; cursor: pointer;",

  settingSwitchKnob:
    "position: absolute; top: 2px; left: 2px; width: 18px; height: 18px;" +
    " border-radius: 50%; background: #fff;" +
    " box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); transition: transform 0.16s;",
} as const;

// ============================================================
// 4. BUTTON PRESETS
// ============================================================

export const DS_BUTTONS = {
  primary:
    "position: relative; overflow: hidden;" +
    " background: var(--ax-blue); color: white;" +
    " border: 1px solid var(--ax-blue); border-radius: var(--ax-radius-xl);" +
    " font-weight: var(--ax-fw-semibold); cursor: pointer;" +
    " transition: all var(--ax-dur-fast) var(--ax-ease-out);" +
    " display: flex; align-items: center; gap: 8px;" +
    " box-shadow: 0 1px 3px rgba(10, 132, 255, 0.25), inset 0 1px 0 rgba(255,255,255,0.22);",

  secondary:
    "background: var(--ax-bg-glass-inset);" +
    " color: var(--ax-fg); border: 1px solid var(--ax-border);" +
    " border-radius: var(--ax-radius-xl); font-weight: var(--ax-fw-semibold);" +
    " cursor: pointer; transition: all var(--ax-dur-fast) var(--ax-ease-out);" +
    " display: flex; align-items: center; gap: 8px;" +
    " box-shadow: var(--ax-glass-1-shadow), var(--ax-glass-1-edge);",

  danger:
    "padding: 6px 14px; font-size: var(--ax-fs-md); font-weight: var(--ax-fw-semibold);" +
    " border-radius: var(--ax-radius-lg); cursor: pointer;" +
    " border: 1px solid var(--ax-red); background: var(--ax-tone-negative-soft-bg);" +
    " color: var(--ax-red); font-family: var(--ax-font-body);" +
    " transition: all var(--ax-dur-fast) var(--ax-ease-out);",

  dangerSolid:
    "padding: 8px 20px; font-size: var(--ax-fs-lg); font-weight: var(--ax-fw-bold);" +
    " border-radius: var(--ax-radius-lg); cursor: pointer; border: none;" +
    " background: var(--ax-red); color: #fff; font-family: var(--ax-font-body);" +
    " box-shadow: 0 1px 3px rgba(215, 49, 38, 0.30), inset 0 1px 0 rgba(255,255,255,0.22);",

  sizeSm: "padding: 4px 10px; font-size: var(--ax-fs-sm);",
  sizeMd: "padding: 6px 12px; font-size: var(--ax-fs-md);",
  sizeLg: "padding: 8px 16px; font-size: var(--ax-fs-lg);",
} as const;

// ============================================================
// 5. SEMANTIC COLOR HELPERS
// ============================================================

/** Returns green/red raw hex based on sign. Use for canvas/Chart.js. */
export function ds_signColorRaw(value: number): string {
  const r = getAxRawColors();
  return value >= 0 ? r.positive : r.negative;
}

/** Returns severity color set { text, bg, border }. */
export function ds_severityColors(severity: "critical" | "warning" | "info"): {
  text: string;
  bg: string;
  border: string;
} {
  const r = getAxRawColors();
  if (severity === "critical") {
    return {
      text: r.negative,
      bg: "var(--ax-tone-negative-soft-bg)",
      border: "var(--ax-tone-negative-border)",
    };
  }
  if (severity === "warning") {
    return {
      text: r.neutral,
      bg: "var(--ax-tone-neutral-soft-bg)",
      border: "var(--ax-tone-neutral-border)",
    };
  }
  return {
    text: r.positive,
    bg: "var(--ax-tone-positive-soft-bg)",
    border: "var(--ax-tone-positive-border)",
  };
}

// ============================================================
// 6. SPACING SCALE
// ============================================================

export const DS_SPACING = {
  "2xs": "1px",
  xs: "2px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "20px",
  "3xl": "24px",
} as const;

// ============================================================
// 7. BORDER RADIUS SCALE
// ============================================================

export const DS_RADIUS = {
  xs: "4px",
  sm: "6px",
  md: "8px",
  lg: "10px",
  xl: "12px",
  "2xl": "14px",
  "3xl": "16px",
  "4xl": "18px",
  full: "50%",
} as const;

// ============================================================
// 8. LINE HEIGHT SCALE
// ============================================================

export const DS_LINE_HEIGHT = {
  none: "1",
  tight: "1.2",
  snug: "1.3",
  normal: "1.35",
  relaxed: "1.4",
  loose: "1.5",
} as const;

// ============================================================
// 9. OPACITY SCALE
// ============================================================

export const DS_OPACITY = {
  subtle: 0.03,
  badge: 0.06,
  tint: 0.1,
  status: 0.15,
  border: 0.25,
  dragging: 0.35,
  panel: 0.45,
  fill: 0.5,
  dim: 0.6,
  muted: 0.7,
  soft: 0.8,
} as const;
