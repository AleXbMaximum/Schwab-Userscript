/** Interpolate the X coordinate for a `value` falling between column anchors. */
export function interpolateSpotX(
  value: number,
  colValues: number[],
  startX: number,
  colX: (col: number) => number,
  colW: (col: number) => number,
): number | null {
  if (colValues.length === 0) return null;
  if (value <= colValues[0]) return startX + colW(0) / 2;
  if (value >= colValues[colValues.length - 1]) {
    const last = colValues.length - 1;
    return startX + colX(last) + colW(last) / 2;
  }
  for (let i = 0; i < colValues.length - 1; i++) {
    if (value >= colValues[i] && value <= colValues[i + 1]) {
      const frac = (value - colValues[i]) / (colValues[i + 1] - colValues[i]);
      const x1 = startX + colX(i) + colW(i) / 2;
      const x2 = startX + colX(i + 1) + colW(i + 1) / 2;
      return x1 + frac * (x2 - x1);
    }
  }
  return null;
}

/**
 * Interpolate the Y coordinate for a `value` falling between row anchors.
 * Supports ascending or descending row value sequences.
 */
export function interpolateSpotY(
  value: number,
  rowValues: number[],
  startY: number,
  cellHeight: number,
): number | null {
  if (rowValues.length === 0) return null;

  const first = rowValues[0];
  const last = rowValues[rowValues.length - 1];
  const lo = Math.min(first, last);
  const hi = Math.max(first, last);
  const ascending = first <= last;

  if (value <= lo) {
    const idx = ascending ? 0 : rowValues.length - 1;
    return startY + idx * cellHeight + cellHeight / 2;
  }
  if (value >= hi) {
    const idx = ascending ? rowValues.length - 1 : 0;
    return startY + idx * cellHeight + cellHeight / 2;
  }

  for (let i = 0; i < rowValues.length - 1; i++) {
    const v0 = rowValues[i];
    const v1 = rowValues[i + 1];
    if (value >= Math.min(v0, v1) && value <= Math.max(v0, v1)) {
      const frac = (value - v0) / (v1 - v0);
      const y1 = startY + i * cellHeight + cellHeight / 2;
      const y2 = startY + (i + 1) * cellHeight + cellHeight / 2;
      return y1 + frac * (y2 - y1);
    }
  }
  return null;
}

/** Trace a rectangle path with rounded corners (or plain rect if r is too large). */
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

/** Format a heatmap color-scale label, preferring compact decimals. */
export function formatScaleLabel(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return Math.abs(value) < 10 ? value.toFixed(2) : value.toFixed(1);
}
