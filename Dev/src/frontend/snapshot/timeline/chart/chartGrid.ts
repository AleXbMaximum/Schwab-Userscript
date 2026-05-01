import type { TimeAxisMapping } from "../timelineTypes";
import type { NiceScaleResult } from "../../../../shared/utils/math/scale";
import { getGapMode, getMarketBoundaries } from "../data/timeAxisMapping";
import { SNAPSHOT_CHART_PAD } from "./chartTypes";
import { isDarkTheme } from "../../../components/core/axTheme/controller";

/** Draw session background colors for compressed gap mode. */
export function drawSessionBackgrounds(
  ctx: CanvasRenderingContext2D,
  axisMapping: TimeAxisMapping,
  effectiveRangeMs: number,
  chartH: number,
): void {
  const pad = SNAPSHOT_CHART_PAD;
  const chartW = ctx.canvas.width / (window.devicePixelRatio || 1) - pad.left - pad.right;

  if (getGapMode(effectiveRangeMs) === "stitched") return;

  for (const seg of axisMapping.segments) {
    const x1 = Math.max(pad.left, seg.startPx);
    const x2 = Math.min(pad.left + chartW, seg.endPx);
    if (x2 - x1 < 0.5) continue;

    const dark = isDarkTheme();
    let bgColor: string | null = null;
    if (seg.isGap) {
      bgColor = dark ? "rgba(142,142,147,0.10)" : "rgba(142,142,147,0.06)";
    } else {
      switch (seg.sessionType) {
        case "pre":
          bgColor = dark ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.04)";
          break;
        case "post":
          bgColor = dark ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.04)";
          break;
        default:
          bgColor = null;
          break;
      }
    }
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(x1, pad.top, x2 - x1, chartH);
    }
  }
}

/** Draw horizontal grid lines at nice scale tick positions. */
export function drawGridLines(
  ctx: CanvasRenderingContext2D,
  nice: NiceScaleResult,
  toY: (value: number) => number,
  chartW: number,
  chartH: number,
): void {
  const pad = SNAPSHOT_CHART_PAD;
  ctx.strokeStyle = isDarkTheme() ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  for (const tick of nice.ticks) {
    const y = toY(tick);
    if (y < pad.top - 1 || y > pad.top + chartH + 1) continue;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
  }
}

/** Draw the baseline line (e.g. zero line) if applicable. */
export function drawBaselineLine(
  ctx: CanvasRenderingContext2D,
  baseline: number,
  forceBaseline: boolean | undefined,
  toY: (value: number) => number,
  chartW: number,
  chartH: number,
): void {
  if (forceBaseline === false) return;
  const pad = SNAPSHOT_CHART_PAD;
  const y0 = toY(baseline);
  if (y0 >= pad.top && y0 <= pad.top + chartH) {
    ctx.beginPath();
    ctx.strokeStyle = isDarkTheme() ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1;
    ctx.moveTo(pad.left, y0);
    ctx.lineTo(pad.left + chartW, y0);
    ctx.stroke();
  }
}

/** Draw market open/close boundary dashed lines. */
export function drawMarketBoundaries(
  ctx: CanvasRenderingContext2D,
  startTs: number,
  endTs: number,
  effectiveRangeMs: number,
  toX: (ts: number) => number,
  chartW: number,
  chartH: number,
): void {
  if (getGapMode(effectiveRangeMs) === "stitched") return;

  const pad = SNAPSHOT_CHART_PAD;
  const boundaries = getMarketBoundaries(startTs, endTs);
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.font = "10px -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  for (const b of boundaries) {
    const x = toX(b.ts);
    if (x < pad.left || x > pad.left + chartW) continue;
    ctx.strokeStyle =
      b.label === "Open" ? "rgba(32,169,69,0.5)" : "rgba(215,49,38,0.5)";
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + chartH);
    ctx.stroke();
    ctx.fillStyle =
      b.label === "Open" ? "rgba(32,169,69,0.7)" : "rgba(215,49,38,0.7)";
    ctx.fillText(b.label, x, pad.top + 2);
  }
  ctx.restore();
}
