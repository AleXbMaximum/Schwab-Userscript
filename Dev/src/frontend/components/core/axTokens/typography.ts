// Typography tokens — font stacks + size/weight/line-height/letter-spacing scales.
//
// `body` is the default UI font (system stack) used for all chrome and prose.
// `mono` is the monospace stack reserved for tabular numbers, code blocks,
// and any surface that explicitly opts in via `var(--ax-font-mono)`.

export const AX_FONT = {
  body: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
} as const;

export type AxFontKey = keyof typeof AX_FONT;

// Half-pixel sizes are intentional — recorder.user.js uses 9.5/10.5/12.5 to
// hit a denser visual rhythm than integer-only scales. Modern browsers render
// these via subpixel antialiasing and the difference is visible.
export const AX_FSIZE = {
  "2xs": "9.5px",
  xs: "10.5px",
  sm: "11px",
  md: "12px",
  lg: "12.5px",
  menu: "13px",
  xl: "14px",
  "2xl": "16px",
  "3xl": "19px",
  "4xl": "23px",
} as const;

export type AxFSizeKey = keyof typeof AX_FSIZE;

export const AX_FWEIGHT = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
} as const;

export type AxFWeightKey = keyof typeof AX_FWEIGHT;

export const AX_LH = {
  none: "1",
  tight: "1.2",
  snug: "1.3",
  normal: "1.35",
  relaxed: "1.4",
  loose: "1.5",
} as const;

export type AxLHKey = keyof typeof AX_LH;

export const AX_LETTER = {
  tighter: "-0.5px",
  tight: "-0.2px",
  normal: "0",
  wide: "0.2px",
  wider: "0.4px",
  widest: "0.6px",
} as const;

export type AxLetterKey = keyof typeof AX_LETTER;
