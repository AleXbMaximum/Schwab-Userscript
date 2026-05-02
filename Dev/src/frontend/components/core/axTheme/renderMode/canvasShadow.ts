// Canvas shadow helper — single mode-aware funnel for every chart that
// wants a glow / drop-shadow stroke. In Full mode it sets the standard
// CanvasRenderingContext2D shadow* properties; in Eco it skips the
// shadow setup entirely (no-op cost) and lets the draw run flat.
//
// Why a helper: shadowBlur is the heaviest per-fill cost on canvas —
// every fill / stroke under a non-zero shadowBlur triggers an offscreen
// composite, which dominates render time on the heatmaps. Funnelling
// every site through one helper means new chart code automatically
// honours the mode without each developer having to remember.
//
// The helper always restores ctx.shadow* state after the draw completes
// (try/finally), so callers don't need to defensively zero shadowBlur.

import { isEco } from "./controller";

export interface ShadowOpts {
  color: string;
  blur: number;
  offsetX?: number;
  offsetY?: number;
}

export function withShadow(
  ctx: CanvasRenderingContext2D,
  opts: ShadowOpts,
  draw: () => void,
): void {
  const eco = isEco();
  if (!eco) {
    ctx.shadowColor = opts.color;
    ctx.shadowBlur = opts.blur;
    if (opts.offsetX !== undefined) ctx.shadowOffsetX = opts.offsetX;
    if (opts.offsetY !== undefined) ctx.shadowOffsetY = opts.offsetY;
  }
  try {
    draw();
  } finally {
    if (!eco) {
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowColor = "rgba(0,0,0,0)";
    }
  }
}
