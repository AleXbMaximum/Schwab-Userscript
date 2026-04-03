// Base section shell style — used by DS_COMPONENTS.panel.
const SECTION_BOX =
  "background: linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.12));" +
  " backdrop-filter: blur(calc(var(--lg-blur) - 2px)) saturate(var(--lg-saturate));" +
  " -webkit-backdrop-filter: blur(calc(var(--lg-blur) - 2px)) saturate(var(--lg-saturate));" +
  " border-radius:16px; padding:20px; box-shadow:var(--ios-shadow-sm);" +
  " border:1px solid var(--lg-border); margin-bottom:20px;";

// ============================================================
// 1. COLOR TOKENS
// ============================================================

export const DS_COLORS = {
  // Semantic intent -- CSS variable form (for DOM styleString)
  positive: "var(--ios-green)",
  negative: "var(--ios-red)",
  neutral: "var(--ios-orange)",
  info: "var(--ios-blue)",
  muted: "var(--ios-gray)",

  textPrimary: "var(--ios-text-primary)",
  textSecondary: "var(--ios-text-secondary)",
  border: "var(--ios-border)",
  lightGray: "var(--ios-light-gray)",
  tableHeader: "var(--ios-table-header)",
  white: "#ffffff",
  cyan: "var(--ios-cyan)",
  purple: "var(--ios-purple)",

  // Raw hex -- for canvas 2D, Chart.js callbacks, and contexts
  // where CSS custom properties are not supported.
  raw: {
    positive: "#20a945",
    negative: "#d73126",
    neutral: "#D78100",
    info: "#007AFF",
    muted: "#8E8E93",
    textPrimary: "#1c1c1e",
    textSecondary: "#3a3a3c",
    tableHeader: "#1b5fa7",
    cyan: "#5AC8FA",
    purple: "#5856D6",
  },

  // Alpha backgrounds for badges, chips, status indicators
  bgPositive: "rgba(32, 169, 69, 0.06)",
  bgNegative: "rgba(215, 49, 38, 0.06)",
  bgNeutral: "rgba(215, 129, 0, 0.06)",
  bgInfo: "rgba(0, 122, 255, 0.06)",
  bgMuted: "rgba(142, 142, 147, 0.06)",
  bgSubtle: "rgba(0, 0, 0, 0.03)",
  bgPanel: "rgba(255, 255, 255, 0.45)",
} as const;

// ============================================================
// 2. TYPOGRAPHY PRESETS  (ready-to-use styleString values)
// ============================================================

export const DS_TYPOGRAPHY = {
  /** Panel title: 15px bold, primary color, tight letter-spacing */
  panelTitle:
    "margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: var(--ios-text-primary); letter-spacing: -0.2px;",

  /** Panel description: 11px secondary */
  panelDesc:
    "font-size: 11px; color: var(--ios-text-secondary); margin-bottom: 8px;",

  /** Metric label: tiny uppercase bold (section headings like "FUNDAMENTALS") */
  metricLabel:
    "font-size: 10px; font-weight: 700; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.4px;",

  /** Mini metric label inside cells */
  metricLabelMini:
    "font-size: 9px; color: var(--ios-text-secondary); text-transform: uppercase;",

  /** Metric value: 11px semibold primary */
  metricValue:
    "font-size: 11px; font-weight: 600; color: var(--ios-text-primary);",

  /** Body text inside cards/sections */
  bodyText:
    "font-size: 12px; color: var(--ios-text-secondary); line-height: 1.4;",

  /** Caption/footer */
  caption: "font-size: 10px; color: var(--ios-text-secondary);",

  /** Control label: 12px medium-weight, secondary color (view/filter labels) */
  controlLabel:
    "font-size: 12px; font-weight: 500; color: var(--ios-text-secondary);",

  /** Collapsible card label */
  cardLabel:
    "font-size: 12px; font-weight: 600; color: var(--ios-text-primary); flex: 1;",

  /** Card meta text */
  cardMeta: "font-size: 11px; color: var(--ios-text-secondary);",

  /** Section header title builder (uppercase, bold, custom color) */
  sectionHeader: (color?: string): string =>
    `font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; white-space: nowrap; color: ${color ?? "var(--ios-text-secondary)"};`,

  /** Page-level title (larger, used in top-level page headers) */
  pageTitle:
    "font-size: 20px; font-weight: 600; color: var(--ios-text-primary); margin: 0 0 16px 0;",

  /** Heading: 13px bold, primary text (sub-panel titles, card headings) */
  heading:
    "font-size: 13px; font-weight: 700; color: var(--ios-text-primary); line-height: 1.3;",

  /** Compact body: 10px for dense/tiny UI elements */
  compact:
    "font-size: 10px; color: var(--ios-text-secondary); line-height: 1.3;",

  /** Monospace: 12px for code, data values, numeric displays */
  mono: "font-size: 12px; font-weight: 600; color: var(--ios-text-primary); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;",

  /** Large value: 20px extra-bold for hero numbers/KPIs */
  largeValue:
    "font-size: 20px; font-weight: 800; color: var(--ios-text-primary); line-height: 1; letter-spacing: -0.5px;",
} as const;

// ============================================================
// 3. COMPONENT STYLE PRESETS  (ready-to-use styleString values)
// ============================================================

export const DS_COMPONENTS = {
  /** Standard panel container (sectionBox + no bottom margin) */
  panel: SECTION_BOX + " margin-bottom: 0;",

  /** Legacy card shell kept as DS token for compatibility */
  card:
    "background: linear-gradient(135deg, rgba(255,255,255,var(--lg-alpha-1)), rgba(255,255,255,var(--lg-alpha-2)));" +
    " backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate));" +
    " -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate));" +
    " border-radius:14px; padding:16px; box-shadow:0 4px 12px rgba(0,0,0,0.08); border:1px solid var(--lg-border);",

  /** Collapsible card outer shell */
  collapsibleCard:
    "border: 1px solid var(--ios-border); border-radius: 10px; overflow: hidden; background: rgba(255,255,255,0.45);",

  /** Collapsible card header */
  collapsibleHeader:
    "display: flex; align-items: center; gap: 8px; padding: 9px 13px; cursor: pointer; user-select: none;",

  /** Collapsible card body (hidden by default) */
  collapsibleBody:
    "display: none; padding: 10px 13px; border-top: 1px solid var(--ios-border);",

  /** Collapsible body in flex-column mode */
  collapsibleBodyFlex:
    "padding: 10px 13px; border-top: 1px solid var(--ios-border); display: flex; flex-direction: column; gap: 10px;",

  /** Caret/toggle arrow for collapsible */
  caret:
    "font-size: 9px; color: var(--ios-text-secondary); transition: transform 0.2s; flex-shrink: 0;",

  /** Status dot builder (7px circle) */
  statusDot: (color: string): string =>
    `width: 7px; height: 7px; border-radius: 50%; background: ${color}; flex-shrink: 0;`,

  /** Metric cell: subtle background card (vertical label + value) */
  metricCell:
    "background: rgba(0,0,0,0.03); border-radius: 6px; padding: 5px 7px; display: flex; flex-direction: column; gap: 1px;",

  /** Metric cell inline (horizontal label + value) */
  metricCellInline:
    "background: rgba(0,0,0,0.03); border-radius: 6px; padding: 4px 8px; display: flex; gap: 4px; align-items: center;",

  /** Data section container (flex column with tight gap) */
  dataSection: "display: flex; flex-direction: column; gap: 5px;",

  /** Driver/detail list item */
  driverItem:
    "padding: 6px 10px; border-radius: 8px; font-size: 11px; line-height: 1.35; background: rgba(0,0,0,0.03); color: var(--ios-text-secondary); border: 1px solid rgba(0,0,0,0.06);",

  /** News/activity list item */
  newsItem:
    "display: flex; flex-direction: column; gap: 2px; padding: 5px 8px; background: rgba(0,0,0,0.03); border-radius: 6px;",

  // ── Settings-panel form tokens ──────────────────────────────

  // ── Table tokens ────────────────────────────────────────────

  /** Table wrapper: border-collapse, rounded, bordered */
  table:
    "width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 10px;" +
    " overflow: hidden; border: 1px solid var(--ios-border); background: rgba(255,255,255,0.92);",

  /** Table header cell: gradient background, colored text */
  tableHeader:
    "text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 600;" +
    " color: var(--ios-table-header); letter-spacing: 0.2px;" +
    " border-bottom: 1px solid rgba(60,60,67,0.1);" +
    " background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(250,250,252,0.75));",

  /** Table body cell */
  tableCell:
    "padding: 7px 10px; font-size: 12px; color: var(--ios-text-primary); font-variant-numeric: tabular-nums;",

  // ── Settings-panel form tokens ──────────────────────────────

  /** Settings panel: section title (uppercase label) */
  settingSectionTitle:
    "font-size: 11px; font-weight: 700; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;",

  /** Settings panel: field label */
  settingFieldLabel: "font-size: 11px; color: var(--ios-text-secondary);",

  /** Settings panel: field input */
  settingFieldInput:
    "padding: 6px 9px; font-size: 12px; border: 1px solid var(--ios-border); border-radius: 8px;" +
    " font-family: var(--ios-font); background: rgba(255,255,255,0.86); color: var(--ios-text-primary); outline: none;",

  /** Settings panel: section box container */
  settingSectionBox:
    "display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--ios-border);" +
    " border-radius: 10px; background: rgba(0,0,0,0.015);",

  /** Dense settings layout: adaptive grid for compact cards */
  settingDenseGrid:
    "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; align-items: start;",

  /** Dense settings card shell */
  settingDenseCard:
    "display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 8px 10px;" +
    " border: 1px solid var(--ios-border); border-radius: 10px; background: rgba(255,255,255,0.66);",

  /** Dense settings helper text */
  settingDenseHint:
    "font-size: 10px; color: var(--ios-text-secondary); line-height: 1.3;",

  /** Dense row: label + control */
  settingDenseRow:
    "display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: center; min-width: 0;",

  /** Dense right-side value group */
  settingDenseValueGroup:
    "display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;",

  /** Dense field input (narrow) */
  settingDenseInput:
    "width: 96px; padding: 4px 8px; font-size: 12px; border: 1px solid var(--ios-border); border-radius: 8px;" +
    " font-family: var(--ios-font); background: rgba(255,255,255,0.9); color: var(--ios-text-primary); outline: none;",

  /** Dense unit chip */
  settingDenseUnit:
    "font-size: 10px; font-weight: 600; color: var(--ios-text-secondary); background: rgba(0,0,0,0.04);" +
    " border: 1px solid rgba(0,0,0,0.08); border-radius: 6px; padding: 1px 5px; line-height: 1.2;",

  /** Dense checkbox */
  settingCheckbox:
    "width: 15px; height: 15px; cursor: pointer; accent-color: var(--ios-blue);",

  /** Settings JSON textarea */
  settingTextarea:
    "width: 100%; box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;" +
    " font-size: 12px; line-height: 1.4; padding: 8px 9px; border: 1px solid var(--ios-border);" +
    " border-radius: 10px; background: rgba(255,255,255,0.58); resize: vertical;" +
    " transition: border-color 0.2s, box-shadow 0.2s; outline: none;",

  /** Grouped settings stack */
  settingGroupStack: "display: flex; flex-direction: column; gap: 10px;",

  /** Grouped settings section card */
  settingGroupCard:
    "display: flex; flex-direction: column; background: rgba(255,255,255,0.94); border: 1px solid rgba(60,60,67,0.14);" +
    " border-radius: 14px; overflow: hidden;",

  /** Grouped settings header row */
  settingGroupHeader:
    "display: grid; grid-template-columns: minmax(0,1fr) 220px; align-items: center; column-gap: 12px;" +
    " padding: 12px 16px; background: rgba(250,250,252,0.92);",

  /** Grouped settings title */
  settingGroupTitle:
    "font-size: 15px; font-weight: 600; color: var(--ios-text-primary); line-height: 1.25;",

  /** Grouped settings body */
  settingGroupBody:
    "display: flex; flex-direction: column; padding: 4px 16px 10px;",

  /** Grouped form row */
  settingFormRow:
    "display: grid; grid-template-columns: minmax(0,1fr) 220px; align-items: center; column-gap: 12px;" +
    " min-height: 44px; padding: 8px 0; border-bottom: 1px solid rgba(60,60,67,0.10);",

  /** Grouped form row label */
  settingFormLabel:
    "font-size: 13px; font-weight: 500; color: var(--ios-text-primary); line-height: 1.25;",

  /** Grouped form row helper */
  settingFormHelper:
    "font-size: 12px; color: var(--ios-text-secondary); line-height: 1.35; margin-top: 2px;",

  /** Grouped form control slot */
  settingFormControl:
    "width: 220px; display: flex; justify-content: flex-end; align-items: center;",

  /** Grouped input + suffix wrapper */
  settingInputGroup:
    "width: 220px; display: inline-flex; align-items: center; gap: 6px; justify-content: flex-end;",

  /** Grouped form input */
  settingFormInput:
    "width: 168px; padding: 6px 10px; font-size: 12px; border: 1px solid var(--ios-border); border-radius: 8px;" +
    " font-family: var(--ios-font); background: rgba(255,255,255,0.96); color: var(--ios-text-primary); outline: none;",

  /** Grouped form suffix */
  settingFormSuffix:
    "min-width: 44px; text-align: center; font-size: 11px; font-weight: 600; color: var(--ios-text-secondary);" +
    " background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.10); border-radius: 8px; padding: 2px 6px; line-height: 1.2;",

  /** Switch track */
  settingSwitchTrack:
    "position: relative; width: 42px; height: 24px; border-radius: 999px; border: 1px solid rgba(60,60,67,0.25);" +
    " background: rgba(120,120,128,0.22); transition: background 0.16s, border-color 0.16s; cursor: pointer;",

  /** Switch knob */
  settingSwitchKnob:
    "position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;" +
    " background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.16s;",
} as const;

// ============================================================
// 4. BUTTON PRESETS
// ============================================================

export const DS_BUTTONS = {
  /** iOS-style primary button (blue gradient with glow) */
  primary:
    "position:relative; overflow:hidden;" +
    " background: linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, transparent 8%), linear-gradient(135deg, rgba(0,122,255,0.9), rgba(0,122,255,0.8));" +
    " color:white; border:1px solid rgba(255,255,255,0.25); border-radius:12px;" +
    " font-weight:600; cursor:pointer; transition:all 0.2s ease;" +
    " display:flex; align-items:center; gap:8px; box-shadow: 0 6px 16px rgba(0,122,255,0.20);",

  /** Glass-style secondary button */
  secondary:
    "background: linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.12));" +
    " color:var(--ios-text-secondary); border:1px solid var(--lg-border); border-radius:12px;" +
    " font-weight:600; cursor:pointer; transition:all 0.2s ease;" +
    " display:flex; align-items:center; gap:8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);",

  /** Danger button (red outline or solid) */
  danger:
    "padding: 6px 14px; font-size: 12px; font-weight: 600; border-radius: 10px; cursor: pointer;" +
    " border: 1px solid var(--ios-red); background: rgba(215,49,38,0.08); color: var(--ios-red);" +
    " font-family: var(--ios-font, inherit); transition: all 0.15s;",

  /** Danger button solid (for confirm actions) */
  dangerSolid:
    "padding: 8px 20px; font-size: 13px; font-weight: 700; border-radius: 10px; cursor: pointer;" +
    " border: none; background: var(--ios-red); color: #fff; font-family: inherit;",

  /** Small button sizing (compact controls) */
  sizeSm: "padding: 4px 10px; font-size: 11px;",
  /** Medium button sizing (standard) */
  sizeMd: "padding: 6px 12px; font-size: 12px;",
  /** Large button sizing (prominent actions) */
  sizeLg: "padding: 8px 16px; font-size: 13px;",
} as const;

// ============================================================
// 5. SEMANTIC COLOR HELPERS
// ============================================================

/** Returns green/red raw hex based on sign. Use for canvas/Chart.js. */
export function ds_signColorRaw(value: number): string {
  return value >= 0 ? DS_COLORS.raw.positive : DS_COLORS.raw.negative;
}

/** Returns severity color set { text, bg, border }. */
export function ds_severityColors(severity: "critical" | "warning" | "info"): {
  text: string;
  bg: string;
  border: string;
} {
  if (severity === "critical") {
    return {
      text: DS_COLORS.raw.negative,
      bg: DS_COLORS.bgNegative,
      border: "rgba(215,49,38,0.25)",
    };
  }
  if (severity === "warning") {
    return {
      text: DS_COLORS.raw.neutral,
      bg: DS_COLORS.bgNeutral,
      border: "rgba(215,129,0,0.25)",
    };
  }
  return {
    text: DS_COLORS.raw.positive,
    bg: DS_COLORS.bgPositive,
    border: "rgba(32,169,69,0.25)",
  };
}

// ============================================================
// 6. SPACING SCALE
// ============================================================

export const DS_SPACING = {
  /** 1px -- hairline gaps */
  "2xs": "1px",
  /** 2px -- minimal internal gap */
  xs: "2px",
  /** 4px -- tight internal padding */
  sm: "4px",
  /** 8px -- standard gap between related items */
  md: "8px",
  /** 12px -- padding inside containers */
  lg: "12px",
  /** 16px -- section-level padding */
  xl: "16px",
  /** 20px -- panel padding */
  "2xl": "20px",
  /** 24px -- large section margins */
  "3xl": "24px",
} as const;

// ============================================================
// 7. BORDER RADIUS SCALE
// ============================================================

export const DS_RADIUS = {
  /** 4px -- small chips, inline badges */
  xs: "4px",
  /** 6px -- metric cells, small cards */
  sm: "6px",
  /** 8px -- driver items, table radius */
  md: "8px",
  /** 10px -- collapsible cards, nav buttons */
  lg: "10px",
  /** 12px -- buttons, badges, search boxes */
  xl: "12px",
  /** 14px -- content cards */
  "2xl": "14px",
  /** 16px -- panels */
  "3xl": "16px",
  /** 18px -- top-level containers (--ios-radius) */
  "4xl": "18px",
  /** 50% -- circles (status dots) */
  full: "50%",
} as const;

// ============================================================
// 8. LINE HEIGHT SCALE
// ============================================================

export const DS_LINE_HEIGHT = {
  /** 1 -- single line, hero numbers */
  none: "1",
  /** 1.2 -- tight, table cells */
  tight: "1.2",
  /** 1.3 -- compact body text */
  snug: "1.3",
  /** 1.35 -- driver items */
  normal: "1.35",
  /** 1.4 -- body text */
  relaxed: "1.4",
  /** 1.5 -- readable paragraphs */
  loose: "1.5",
} as const;

// ============================================================
// 9. OPACITY SCALE
// ============================================================

export const DS_OPACITY = {
  /** 0.03 -- subtle backgrounds (metricCell, bgSubtle) */
  subtle: 0.03,
  /** 0.06 -- alpha badges/chips (bgPositive, bgNegative, etc.) */
  badge: 0.06,
  /** 0.10 -- highlighted tints */
  tint: 0.1,
  /** 0.15 -- status backgrounds, chart alpha fills */
  status: 0.15,
  /** 0.25 -- borders on colored containers */
  border: 0.25,
  /** 0.35 -- dragging / ghost elements */
  dragging: 0.35,
  /** 0.45 -- semi-transparent panels */
  panel: 0.45,
  /** 0.50 -- chart area fills */
  fill: 0.5,
  /** 0.60 -- de-emphasized icons / secondary labels */
  dim: 0.6,
  /** 0.70 -- muted text, inactive buttons */
  muted: 0.7,
  /** 0.80 -- close/dismiss affordances */
  soft: 0.8,
} as const;
