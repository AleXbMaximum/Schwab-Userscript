// Spacing scale. Two access modes:
//   - numeric key: AX_SPACE[4] === "10px"
//   - semantic alias: AX_S.md === "8px"

export const AX_SPACE = {
  0: "0",
  px: "1px",
  "0.5": "2px",
  1: "4px",
  2: "6px",
  3: "8px",
  4: "10px",
  5: "12px",
  6: "14px",
  7: "16px",
  8: "20px",
  9: "24px",
  10: "32px",
  12: "40px",
  14: "48px",
  16: "64px",
} as const;

export type AxSpaceKey = keyof typeof AX_SPACE;

export const AX_S = {
  "2xs": AX_SPACE["0.5"],
  xs: AX_SPACE[1],
  sm: AX_SPACE[2],
  md: AX_SPACE[3],
  lg: AX_SPACE[5],
  xl: AX_SPACE[7],
  "2xl": AX_SPACE[8],
  "3xl": AX_SPACE[9],
  "4xl": AX_SPACE[10],
} as const;

export type AxSpaceAlias = keyof typeof AX_S;

export function axSpace(v: AxSpaceAlias | string): string {
  return (AX_S as Record<string, string>)[v] ?? v;
}
