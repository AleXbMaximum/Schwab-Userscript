// Chart-specific utility functions that have no canonical home elsewhere.
// Math primitives (clamp, normalize, percentage) and formatters (formatCurrencyLocale,
// formatPct, formatNumberLocale) now live in shared/utils/math and shared/utils/formatters.

import { isFiniteNumber } from "shared/utils/math/guards";
import type { KeyLevelsLadderData } from "backend/computation/options/types";

/** Look up a named key level (putWall, callWall, maxPain, flip) from the ladder. */
export function ladderValue(
  ladder: KeyLevelsLadderData,
  id: "putWall" | "maxPain" | "flip" | "callWall",
): number | null {
  return ladder.entries.find((e) => e.id === id)?.value ?? null;
}

export function validateChartData(data: number[]): boolean {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return false;
  return data.every(isFiniteNumber);
}

export function truncateLabel(label: string, maxLength: number = 20): string {
  if (label.length <= maxLength) return label;
  return label.substring(0, maxLength - 3) + "...";
}

/**
 * Prepare a canvas for hi-DPI rendering.
 * Returns `null` if a valid 2D context cannot be obtained.
 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

/** Trace a rounded rectangle path on a 2D canvas context (does not fill or stroke). */
export function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  if (r <= 0 || w < 2 * r || h < 2 * r) {
    ctx.rect(x, y, w, h);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
  }
  ctx.closePath();
}
