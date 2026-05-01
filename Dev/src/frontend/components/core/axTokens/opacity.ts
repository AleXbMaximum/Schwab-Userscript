// Opacity scale — semantic aliases for recurring alpha values.

export const AX_OPACITY = {
  subtle: 0.03,
  badge: 0.06,
  tint: 0.1,
  status: 0.15,
  border: 0.25,
  dragging: 0.35,
  fill: 0.5,
  dim: 0.6,
  muted: 0.7,
  soft: 0.8,
} as const;

export type AxOpacityKey = keyof typeof AX_OPACITY;
