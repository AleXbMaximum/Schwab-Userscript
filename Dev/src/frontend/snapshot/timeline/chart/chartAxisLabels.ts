import { DS_COLORS } from "../../../components/core/theme";
import type { TimeAxisMapping } from "../timelineTypes";
import type { NiceScaleResult } from "../../../../shared/utils/math/scale";
import { formatMetricValue, formatTimeLabel } from "../timelineFormatters";
import type { SnapshotMetricDef } from "../timelineTypes";
import {
  getGapMode,
  generateSessionAwareTicks,
  generateTimeTicks,
} from "../data/timeAxisMapping";
import { SNAPSHOT_CHART_PAD } from "./chartTypes";

/** Draw Y-axis labels on the right side of the chart. */
export function drawYAxisLabels(
  ctx: CanvasRenderingContext2D,
  nice: NiceScaleResult,
  metric: SnapshotMetricDef,
  toY: (value: number) => number,
  chartW: number,
  chartH: number,
): void {
  const pad = SNAPSHOT_CHART_PAD;
  ctx.font =
    '12px var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';
  ctx.fillStyle = DS_COLORS.raw.textSecondary;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const tick of nice.ticks) {
    const y = toY(tick);
    if (y < pad.top - 1 || y > pad.top + chartH + 1) continue;
    ctx.fillText(
      formatMetricValue(metric, tick, true),
      pad.left + chartW + 6,
      y,
    );
  }
}

/** Draw X-axis time labels along the bottom of the chart. */
export function drawXAxisLabels(
  ctx: CanvasRenderingContext2D,
  axisMapping: TimeAxisMapping | null,
  startTs: number,
  endTs: number,
  effectiveRangeMs: number,
  toX: (ts: number) => number,
  chartW: number,
  chartH: number,
): void {
  const pad = SNAPSHOT_CHART_PAD;
  const tickItems = axisMapping
    ? generateSessionAwareTicks(
        axisMapping.segments,
        effectiveRangeMs,
        getGapMode(effectiveRangeMs),
        startTs,
        endTs,
      )
    : generateTimeTicks(startTs, endTs, effectiveRangeMs).map((ts) => ({
        ts,
        dateOnly: false,
      }));
  ctx.font =
    '12px var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';
  ctx.fillStyle = DS_COLORS.raw.textSecondary;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  for (const tick of tickItems) {
    const x = toX(tick.ts);
    if (x < pad.left + 20 || x > pad.left + chartW - 20) continue;
    ctx.fillText(
      formatTimeLabel(tick.ts, effectiveRangeMs, tick.dateOnly),
      x,
      pad.top + chartH + 6,
    );
  }
}
