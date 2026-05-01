// Border-radius scale.

export const AX_RADIUS = {
  xs: "3px",
  sm: "5px",
  md: "7px",
  lg: "9px",
  xl: "11px",
  "2xl": "13px",
  pill: "999px",
  circle: "50%",
} as const;

export type AxRadiusKey = keyof typeof AX_RADIUS;

export function axRadius(v: AxRadiusKey | string): string {
  return (AX_RADIUS as Record<string, string>)[v] ?? v;
}
