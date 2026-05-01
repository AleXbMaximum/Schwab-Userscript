// Motion tokens — durations + easing curves.

export const AX_DURATION = {
  instant: "0ms",
  fast: "150ms",
  medium: "240ms",
  slow: "320ms",
  slower: "480ms",
} as const;

export type AxDurationKey = keyof typeof AX_DURATION;

export const AX_EASE = {
  out: "cubic-bezier(0.22, 1, 0.36, 1)",
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  spring: "cubic-bezier(0.16, 1.11, 0.3, 1.02)",
  linear: "linear",
} as const;

export type AxEaseKey = keyof typeof AX_EASE;

export function axTransition(
  props: string,
  dur: AxDurationKey = "fast",
  ease: AxEaseKey = "out",
): string {
  return `${props} ${AX_DURATION[dur]} ${AX_EASE[ease]}`;
}

export const AX_SHADOW = {
  none: "none",
  sm: "var(--ax-shadow-sm)",
  md: "var(--ax-shadow-md)",
  lg: "var(--ax-shadow-lg)",
  xl: "var(--ax-shadow-xl)",
} as const;

export type AxShadowKey = keyof typeof AX_SHADOW;
