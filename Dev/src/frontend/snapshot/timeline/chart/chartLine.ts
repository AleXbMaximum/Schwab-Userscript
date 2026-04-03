import type { AccountHistoryPoint } from "../../../../backend/core/db/account/accountHistoryTypes";
import type { SnapshotMetricDef } from "../timelineTypes";
import { SNAPSHOT_CHART_PAD } from "./chartTypes";

export function traceSegmentFillPath(
  ctx: CanvasRenderingContext2D,
  seg: { start: number; end: number },
  renderPoints: AccountHistoryPoint[],
  values: number[],
  toX: (ts: number) => number,
  toY: (value: number) => number,
  fillBaseY: number,
): void {
  const startX = toX(renderPoints[seg.start].ts);
  ctx.moveTo(startX, fillBaseY);
  ctx.lineTo(startX, toY(values[seg.start]));
  for (let i = seg.start + 1; i <= seg.end; i += 1) {
    ctx.lineTo(toX(renderPoints[i].ts), toY(values[i]));
  }
  const endX = toX(renderPoints[seg.end].ts);
  ctx.lineTo(endX, fillBaseY);
  ctx.closePath();
}

/** Draw the main data line segments with fill gradient. */
export function drawDataLine(
  ctx: CanvasRenderingContext2D,
  segments: Array<{ start: number; end: number }>,
  renderPoints: AccountHistoryPoint[],
  values: number[],
  metric: SnapshotMetricDef,
  toX: (ts: number) => number,
  toY: (value: number) => number,
  chartH: number,
  fillBaseY: number,
  shouldFillMetricArea: boolean,
  baselineVisible: boolean,
  yMin: number,
  yMax: number,
): void {
  const pad = SNAPSHOT_CHART_PAD;
  const range = yMax - yMin;

  if (segments.length === 0) return;

  if (shouldFillMetricArea) {
    ctx.beginPath();
    for (const seg of segments) {
      if (seg.end <= seg.start) continue;
      traceSegmentFillPath(ctx, seg, renderPoints, values, toX, toY, fillBaseY);
    }

    if (metric.baseline != null) {
      const fillGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
      const bPos = Math.max(0.01, Math.min(0.99, (yMax - metric.baseline) / range));
      fillGrad.addColorStop(0, "rgba(32,169,69,0.20)");
      fillGrad.addColorStop(bPos, "rgba(180,180,180,0.04)");
      fillGrad.addColorStop(1, "rgba(215,49,38,0.20)");
      ctx.fillStyle = fillGrad;
    } else {
      ctx.fillStyle =
        metric.color === "#007AFF"
          ? "rgba(0,122,255,0.12)"
          : "rgba(143,106,212,0.12)";
    }
    ctx.fill();
  }

  ctx.beginPath();
  for (const seg of segments) {
    ctx.moveTo(toX(renderPoints[seg.start].ts), toY(values[seg.start]));
    for (let i = seg.start + 1; i <= seg.end; i += 1) {
      ctx.lineTo(toX(renderPoints[i].ts), toY(values[i]));
    }
  }

  if (metric.baseline != null) {
    const lineGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    const bPos = Math.max(0.01, Math.min(0.99, (yMax - metric.baseline) / range));
    lineGrad.addColorStop(0, "#20a945");
    lineGrad.addColorStop(bPos, "#8E8E93");
    lineGrad.addColorStop(1, "#d73126");
    ctx.strokeStyle = lineGrad;
  } else {
    ctx.strokeStyle = metric.color;
  }
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}
