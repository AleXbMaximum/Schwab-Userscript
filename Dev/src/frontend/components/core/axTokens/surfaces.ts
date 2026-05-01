// Surface tokens — light/dark backgrounds, borders, shadows.

export const AX_LIGHT_SURFACES = {
  bg: "#ffffff",
  bgSubtle: "#f5f5f7",
  bgCard: "#fafafb",
  bgCardAlt: "#ffffff",
  bgChip: "#eeeef1",
  bgModal: "rgba(252,252,254,0.65)",
  bgInput: "#ffffff",
  bgInputSolid: "#ffffff",
  bgToolbar: "#f5f5f7",
  bgPanel: "#fafafb",
  bgTable: "#ffffff",
  bgTableHead: "linear-gradient(180deg, #f5f5f7, #ececef)",
  bgRowHover: "rgba(0, 0, 0, 0.04)",
  bgHighlight: "rgba(255, 204, 0, 0.2)",
  bgGroup: "rgba(27, 95, 167, 0.08)",
  bgGroupStrong: "rgba(27, 95, 167, 0.15)",
  bgGlassInset: "rgba(0, 0, 0, 0.06)",
  bgStickyFade: "linear-gradient(to right, #ffffff, rgba(255,255,255,0))",
  bgStickyFadeReverse: "linear-gradient(to left, #ffffff, rgba(255,255,255,0))",
  bgStickyShadow: "linear-gradient(to right, rgba(0,0,0,0.07), rgba(0,0,0,0))",
  bgStickyShadowReverse:
    "linear-gradient(to left, rgba(0,0,0,0.07), rgba(0,0,0,0))",
  modalBackdropBg: "rgba(0, 0, 0, 0.45)",
  modalBackdropLight: "rgba(0, 0, 0, 0.30)",
} as const;

export const AX_DARK_SURFACES = {
  bg: "#060608",
  bgSubtle: "#0f0f12",
  bgCard: "#141418",
  bgCardAlt: "#101014",
  bgChip: "#1a1a1f",
  bgModal: "rgba(20,20,26,0.55)",
  bgInput: "#16161a",
  bgInputSolid: "#1a1a1f",
  bgToolbar: "#0d0d10",
  bgPanel: "#0c0c0f",
  bgTable: "#0a0a0d",
  bgTableHead: "linear-gradient(180deg, #18181c, #141418)",
  bgRowHover: "rgba(255, 255, 255, 0.05)",
  bgHighlight: "rgba(255, 204, 0, 0.15)",
  bgGroup: "rgba(107, 179, 240, 0.10)",
  bgGroupStrong: "rgba(107, 179, 240, 0.18)",
  bgGlassInset: "rgba(0, 0, 0, 0.22)",
  bgStickyFade: "linear-gradient(to right, #0a0a0d, rgba(10,10,13,0))",
  bgStickyFadeReverse: "linear-gradient(to left, #0a0a0d, rgba(10,10,13,0))",
  bgStickyShadow: "linear-gradient(to right, rgba(0,0,0,0.45), rgba(0,0,0,0))",
  bgStickyShadowReverse:
    "linear-gradient(to left, rgba(0,0,0,0.45), rgba(0,0,0,0))",
  modalBackdropBg: "rgba(0, 0, 0, 0.60)",
  modalBackdropLight: "rgba(0, 0, 0, 0.42)",
} as const;

export type AxSurfaceTokens = Record<keyof typeof AX_LIGHT_SURFACES, string>;

export const AX_LIGHT_BORDERS = {
  base: "rgba(230, 230, 230, 0.7)",
  subtle: "rgba(0,0,0,0.06)",
  strong: "rgba(0,0,0,0.12)",
} as const;

export const AX_DARK_BORDERS = {
  base: "rgba(255, 255, 255, 0.12)",
  subtle: "rgba(255,255,255,0.10)",
  strong: "rgba(255,255,255,0.20)",
} as const;

export type AxBorderTokens = Record<keyof typeof AX_LIGHT_BORDERS, string>;

export const AX_LIGHT_SHADOWS = {
  sm: "0 2px 6px rgba(0, 0, 0, 0.06)",
  md: "0 5px 16px rgba(0, 0, 0, 0.1)",
  lg: "0 12px 32px rgba(0, 0, 0, 0.14)",
  xl: "0 16px 48px rgba(0, 0, 0, 0.18)",
} as const;

export const AX_DARK_SHADOWS = {
  sm: "0 2px 6px rgba(0, 0, 0, 0.3)",
  md: "0 5px 16px rgba(0, 0, 0, 0.4)",
  lg: "0 12px 32px rgba(0, 0, 0, 0.5)",
  xl: "0 16px 48px rgba(0, 0, 0, 0.6)",
} as const;

export type AxShadowTokens = Record<keyof typeof AX_LIGHT_SHADOWS, string>;

export const AX_LIGHT_FG_DISABLED = "rgba(60,60,67,0.35)";
export const AX_DARK_FG_DISABLED = "rgba(235,235,245,0.30)";

export const AX_LIGHT_TOOLTIP = {
  bg: "rgba(255,255,255,0.58)",
  border: "rgba(0,0,0,0.15)",
  shadow: "0 2px 12px rgba(0,0,0,0.18)",
} as const;

export const AX_DARK_TOOLTIP = {
  bg: "rgba(22,22,28,0.52)",
  border: "rgba(255,255,255,0.14)",
  shadow: "0 2px 12px rgba(0,0,0,0.55)",
} as const;

// Scenery is the body bg under everything. Light scenery carries a faint cool
// gradient — just enough spatial variation for tier-2/tier-3 glass to "bite".
// Dark scenery gets a near-black gradient.
export const AX_LIGHT_SCENERY =
  "linear-gradient(135deg, #ffffff 0%, #eef1f6 45%, #e3e8f1 100%)";
export const AX_DARK_SCENERY =
  "linear-gradient(135deg, #060609 0%, #0b0d15 50%, #05070f 100%)";

export const AX_LIGHT_TITLE_GRADIENT = "linear-gradient(45deg, #4CAF50, #2196F3)";
export const AX_DARK_TITLE_GRADIENT = "linear-gradient(45deg, #34C759, #0A84FF)";

export const AX_BG = {
  base: "var(--ax-bg)",
  subtle: "var(--ax-bg-subtle)",
  card: "var(--ax-bg-card)",
  cardAlt: "var(--ax-bg-card-alt)",
  chip: "var(--ax-bg-chip)",
  modal: "var(--ax-bg-modal)",
  input: "var(--ax-bg-input)",
  inputSolid: "var(--ax-bg-input-solid)",
  toolbar: "var(--ax-bg-toolbar)",
  panel: "var(--ax-bg-panel)",
  table: "var(--ax-bg-table)",
  tableHead: "var(--ax-bg-table-head)",
  rowHover: "var(--ax-bg-row-hover)",
  highlight: "var(--ax-bg-highlight)",
  tooltip: "var(--ax-bg-tooltip)",
} as const;

export const AX_BORDER = {
  default: "var(--ax-border)",
  subtle: "var(--ax-border-subtle)",
  strong: "var(--ax-border-strong)",
  tooltip: "var(--ax-border-tooltip)",
} as const;
