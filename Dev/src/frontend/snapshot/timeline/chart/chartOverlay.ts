import { ds_signColorRaw } from "../../../components/core/styles/theme";
import type { AccountHistoryPoint } from "../../../../backend/core/db/account/accountHistoryTypes";
import type { SnapshotMetricDef, IndexOverlayLine } from "../timelineTypes";
import { computeSMA } from "../data/dataUtils";
import { SNAPSHOT_CHART_PAD } from "./chartTypes";

/** SMA color palette: primary (orange), secondary (lighter amber). */
export const SMA_COLORS = [
  "rgba(255,149,0,0.85)",
  "rgba(200,120,50,0.7)",
] as const;

/**
 * Draw a single SMA overlay line on the chart.
 * Half-pixel aligned, first 2 valid points fade in at 50% opacity.
 * Draws an end-point label (e.g. "SMA20") at the rightmost visible value.
 * Returns computed SMA values aligned with source arrays.
 */
export function drawSmaOverlay(
  ctx: CanvasRenderingContext2D,
  smaPeriod: number,
  sourceValues: number[],
  sourceTs: number[],
  toX: (ts: number) => number,
  toY: (value: number) => number,
  color: string,
  chartW: number,
): (number | null)[] | null {
  if (smaPeriod <= 0 || sourceValues.length < smaPeriod) return null;

  const pad = SNAPSHOT_CHART_PAD;
  const smaValues = computeSMA(sourceValues, smaPeriod);

  // Collect valid points for warmup fade
  const validIndices: number[] = [];
  for (let i = 0; i < smaValues.length; i++) {
    if (smaValues[i] != null) validIndices.push(i);
  }
  if (validIndices.length === 0) return smaValues;

  // Draw warmup segment (first 2 points) at 50% opacity
  const warmupCount = Math.min(2, validIndices.length);
  if (warmupCount > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([4, 3]);
    for (let w = 0; w < warmupCount; w++) {
      const idx = validIndices[w];
      const sx = Math.round(toX(sourceTs[idx])) + 0.5;
      const sy = Math.round(toY(smaValues[idx]!)) + 0.5;
      if (w === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Draw main SMA line (from warmup end onward)
  if (validIndices.length > warmupCount) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([4, 3]);
    // Start from last warmup point for continuity
    const startFrom = Math.max(0, warmupCount - 1);
    let started = false;
    for (let w = startFrom; w < validIndices.length; w++) {
      const idx = validIndices[w];
      const sx = Math.round(toX(sourceTs[idx])) + 0.5;
      const sy = Math.round(toY(smaValues[idx]!)) + 0.5;
      if (!started) {
        ctx.moveTo(sx, sy);
        started = true;
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // End-point label
  const lastIdx = validIndices[validIndices.length - 1];
  const lastX = toX(sourceTs[lastIdx]);
  const lastY = toY(smaValues[lastIdx]!);
  if (lastX >= pad.left && lastX <= pad.left + chartW) {
    ctx.save();
    ctx.font =
      '600 9px var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`SMA${smaPeriod}`, lastX + 5, lastY);
    ctx.restore();
  }

  return smaValues;
}

/** Draw index overlay lines (e.g. SPX, COMPX day-change %). */
export function drawIndexOverlayLines(
  ctx: CanvasRenderingContext2D,
  overlayLines: IndexOverlayLine[],
  startTs: number,
  endTs: number,
  toX: (ts: number) => number,
  toY: (value: number) => number,
  chartW: number,
): void {
  const pad = SNAPSHOT_CHART_PAD;

  for (const ol of overlayLines) {
    const len = Math.min(ol.timestamps.length, ol.dayChangePct.length);
    if (len < 2) continue;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = ol.color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([6, 3]);
    let started = false;
    let lastVisibleIdx = -1;
    for (let i = 0; i < len; i++) {
      const ts = ol.timestamps[i];
      const val = ol.dayChangePct[i];
      if (
        !Number.isFinite(ts) ||
        !Number.isFinite(val) ||
        ts < startTs ||
        ts > endTs
      ) {
        continue;
      }
      const x = toX(ts);
      const y = toY(val);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
      lastVisibleIdx = i;
    }
    if (!started || lastVisibleIdx < 0) {
      ctx.restore();
      continue;
    }
    ctx.stroke();

    // End-point dot for overlay
    const lastX = toX(ol.timestamps[lastVisibleIdx]);
    const lastY = toY(ol.dayChangePct[lastVisibleIdx]);
    if (lastX >= pad.left && lastX <= pad.left + chartW) {
      ctx.beginPath();
      ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = ol.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.stroke();

      // Label at end
      ctx.font =
        '600 9px var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';
      ctx.fillStyle = ol.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(ol.symbol.replace("$", ""), lastX + 5, lastY);
    }
    ctx.restore();
  }
}

/**
 * Format a value for display on the current-value tag label.
 */
function formatValueLabel(value: number, kind: "currency" | "percent" | "beta"): string {
  if (kind === "percent") return `${(value * 100).toFixed(2)}%`;
  if (kind === "currency") {
    const abs = Math.abs(value);
    if (abs >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(0)}`;
  }
  return value.toFixed(2);
}

/** Tag descriptor for the right-axis value badge. */
type ValueTag = { y: number; label: string; color: string };

/**
 * Resolve overlapping tags by nudging them apart vertically.
 * Mutates the `y` property of each tag in-place.
 */
function resolveTagOverlap(tags: ValueTag[], tagH: number, minY: number, maxY: number): void {
  if (tags.length <= 1) return;
  tags.sort((a, b) => a.y - b.y);
  // Push down any overlapping tags
  for (let i = 1; i < tags.length; i++) {
    const gap = tags[i].y - tags[i - 1].y;
    if (gap < tagH) {
      tags[i].y = tags[i - 1].y + tagH;
    }
  }
  // If bottom tag overflows, push everything up
  const overflow = tags[tags.length - 1].y + tagH / 2 - maxY;
  if (overflow > 0) {
    for (const t of tags) t.y -= overflow;
  }
  // Clamp top
  for (const t of tags) {
    if (t.y - tagH / 2 < minY) t.y = minY + tagH / 2;
  }
}

/**
 * Draw horizontal dashed lines at the current (last) value of the main data
 * line and each index overlay line. Called inside the chart clip region.
 */
export function drawCurrentValueLines(
  ctx: CanvasRenderingContext2D,
  renderPoints: AccountHistoryPoint[],
  values: number[],
  metric: SnapshotMetricDef,
  overlayLines: IndexOverlayLine[],
  toY: (value: number) => number,
  chartW: number,
  chartH: number,
  startTs: number,
  endTs: number,
): void {
  const pad = SNAPSHOT_CHART_PAD;

  const drawDash = (y: number, color: string) => {
    if (y < pad.top || y > pad.top + chartH) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left, Math.round(y) + 0.5);
    ctx.lineTo(pad.left + chartW, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.restore();
  };

  // Main data line
  if (renderPoints.length > 0) {
    const lastVal = values[values.length - 1];
    if (Number.isFinite(lastVal)) {
      const color = metric.baseline != null
        ? ds_signColorRaw(lastVal - metric.baseline)
        : metric.color;
      drawDash(toY(lastVal), color);
    }
  }

  // Index overlay lines
  for (const ol of overlayLines) {
    const len = Math.min(ol.timestamps.length, ol.dayChangePct.length);
    for (let i = len - 1; i >= 0; i--) {
      const ts = ol.timestamps[i];
      const val = ol.dayChangePct[i];
      if (Number.isFinite(ts) && Number.isFinite(val) && ts >= startTs && ts <= endTs) {
        drawDash(toY(val), ol.color);
        break;
      }
    }
  }
}

/**
 * Draw TradingView-style colored value tags on the right Y-axis for the
 * main data line and each index overlay line. Called outside the clip region.
 */
export function drawCurrentValueTags(
  ctx: CanvasRenderingContext2D,
  renderPoints: AccountHistoryPoint[],
  values: number[],
  metric: SnapshotMetricDef,
  overlayLines: IndexOverlayLine[],
  toY: (value: number) => number,
  chartW: number,
  chartH: number,
  startTs: number,
  endTs: number,
): void {
  const pad = SNAPSHOT_CHART_PAD;
  const tags: ValueTag[] = [];

  // Main data line tag
  if (renderPoints.length > 0) {
    const lastVal = values[values.length - 1];
    if (Number.isFinite(lastVal)) {
      const color = metric.baseline != null
        ? ds_signColorRaw(lastVal - metric.baseline)
        : metric.color;
      tags.push({
        y: toY(lastVal),
        label: formatValueLabel(lastVal, metric.kind),
        color,
      });
    }
  }

  // Index overlay tags
  for (const ol of overlayLines) {
    const len = Math.min(ol.timestamps.length, ol.dayChangePct.length);
    for (let i = len - 1; i >= 0; i--) {
      const ts = ol.timestamps[i];
      const val = ol.dayChangePct[i];
      if (Number.isFinite(ts) && Number.isFinite(val) && ts >= startTs && ts <= endTs) {
        tags.push({
          y: toY(val),
          label: `${(val * 100).toFixed(2)}%`,
          color: ol.color,
        });
        break;
      }
    }
  }

  if (tags.length === 0) return;

  // Resolve overlap
  const tagH = 13;
  resolveTagOverlap(tags, tagH, pad.top, pad.top + chartH);

  const tagFont =
    '600 8.5px var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';
  const tagX = pad.left + chartW + 2;
  const maxTagW = pad.right - 4; // fit within right padding area
  const tagPadX = 3;
  const tagRadius = 2;

  ctx.save();
  // Clip to right-axis area so tags don't overflow canvas
  ctx.beginPath();
  ctx.rect(tagX, pad.top - tagH, maxTagW, chartH + tagH * 2);
  ctx.clip();

  ctx.font = tagFont;
  for (const tag of tags) {
    const textW = ctx.measureText(tag.label).width;
    const boxW = Math.min(textW + tagPadX * 2, maxTagW);
    const boxH = tagH;
    const bx = tagX;
    const by = Math.round(tag.y) - boxH / 2;

    // Background pill
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, tagRadius);
    ctx.fillStyle = tag.color;
    ctx.globalAlpha = 0.85;
    ctx.fill();

    // Text
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(tag.label, bx + tagPadX, Math.round(tag.y));
  }
  ctx.restore();
}

/** Draw the end-point dot on the main data line. */
export function drawEndPointDot(
  ctx: CanvasRenderingContext2D,
  renderPoints: AccountHistoryPoint[],
  values: number[],
  metric: SnapshotMetricDef,
  toX: (ts: number) => number,
  toY: (value: number) => number,
): void {
  if (renderPoints.length === 0) return;
  const endIndex = renderPoints.length - 1;
  const endX = toX(renderPoints[endIndex].ts);
  const endY = toY(values[endIndex]);
  if (!Number.isFinite(endX) || !Number.isFinite(endY)) return;
  ctx.beginPath();
  ctx.arc(endX, endY, 3, 0, Math.PI * 2);
  if (metric.baseline != null) {
    ctx.fillStyle = ds_signColorRaw(values[endIndex] - metric.baseline);
  } else {
    ctx.fillStyle = metric.color;
  }
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.4;
  ctx.stroke();
}
