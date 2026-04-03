import { niceScale } from "../../../../shared/utils/math/scale";
import type { AccountHistoryPoint } from "../../../../backend/core/db/account/accountHistoryTypes";
import type { TimeAxisMapping, SnapshotMetricDef, IndexOverlayLine, ChartRenderMode } from "../timelineTypes";
import { getGapMode } from "../data/timeAxisMapping";
import { downsampleLTTB } from "../data/downsample";
import { arrayMinMax, buildTrueGapOriginalIndices, buildLineSegments } from "../data/dataUtils";
import { aggregateCandles, resolveCandleBucketMs } from "../data/candleAggregation";
import { SNAPSHOT_CHART_PAD } from "./chartTypes";
import type { SnapshotChartBaseState } from "./chartTypes";
import { drawSessionBackgrounds, drawGridLines, drawBaselineLine, drawMarketBoundaries } from "./chartGrid";
import { drawDataLine } from "./chartLine";
import { drawCandlesticks } from "./chartCandle";
import { drawSmaOverlay, SMA_COLORS, drawIndexOverlayLines, drawEndPointDot, drawCurrentValueLines, drawCurrentValueTags } from "./chartOverlay";
import type { SmaSlotState } from "./chartTypes";
import { drawYAxisLabels, drawXAxisLabels } from "./chartAxisLabels";

/**
 * Draw the base chart (everything except hover tooltip).
 * Returns a SnapshotChartBaseState that can be reused for fast hover rendering.
 */
export function drawSnapshotChartBase(
  canvas: HTMLCanvasElement,
  points: AccountHistoryPoint[],
  metric: SnapshotMetricDef,
  rangeDurationMs: number,
  axisMapping: TimeAxisMapping | null = null,
  smaPeriods: number[] = [0],
  overlayLines: IndexOverlayLine[] = [],
  windowStartTs?: number,
  windowEndTs?: number,
  chartMode: ChartRenderMode = "line",
): SnapshotChartBaseState | null {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(
    320,
    Math.floor(rect.width || canvas.clientWidth || 0),
  );
  const cssHeight = Math.max(
    170,
    Math.floor(rect.height || canvas.clientHeight || 0),
  );
  if (cssWidth <= 0 || cssHeight <= 0) return null;

  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(cssWidth * dpr);
  const h = Math.floor(cssHeight * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const pad = SNAPSHOT_CHART_PAD;
  const chartW = Math.max(1, cssWidth - pad.left - pad.right);
  const chartH = Math.max(1, cssHeight - pad.top - pad.bottom);

  if (points.length === 0) {
    ctx.fillStyle = "#8E8E93";
    ctx.font =
      '13px var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';
    ctx.fillText("Waiting for history points...", pad.left + 2, pad.top + 18);
    return null;
  }

  const endTs =
    typeof windowEndTs === "number" && Number.isFinite(windowEndTs)
      ? windowEndTs
      : Date.now();
  let startTs =
    typeof windowStartTs === "number" && Number.isFinite(windowStartTs)
      ? windowStartTs
      : endTs - rangeDurationMs;
  if (startTs >= endTs) {
    startTs = endTs - Math.max(rangeDurationMs, 60_000);
  }
  const effectiveRangeMs = Math.max(60_000, endTs - startTs);
  const toX = axisMapping
    ? axisMapping.toX
    : (ts: number) => pad.left + ((ts - startTs) / effectiveRangeMs) * chartW;

  // ── Session backgrounds ────────────────────────────────────────────
  if (axisMapping && getGapMode(effectiveRangeMs) !== "stitched") {
    drawSessionBackgrounds(ctx, axisMapping, effectiveRangeMs, chartH);
  }

  // ── Y-axis range computation (only from in-window points) ─────────
  const allValues = new Array<number>(points.length);
  const windowValues: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const v = metric.pick(points[i]);
    allValues[i] = v;
    if (points[i].ts >= startTs && points[i].ts <= endTs) {
      windowValues.push(v);
    }
  }
  const { min: dataMin0, max: dataMax0 } = arrayMinMax(
    windowValues.length > 0 ? windowValues : allValues,
  );
  let dataMin = dataMin0;
  let dataMax = dataMax0;

  if (metric.baseline != null && metric.forceBaseline !== false) {
    dataMin = Math.min(dataMin, metric.baseline);
    dataMax = Math.max(dataMax, metric.baseline);
  }

  // ── Candle aggregation (always needed for SMA computation) ─────────
  const bucketMs = resolveCandleBucketMs(effectiveRangeMs);
  const candleBuckets = aggregateCandles(points, metric, bucketMs, startTs, endTs);
  let candleWidthPx: number | null = null;

  // Extract candle close values and midpoint timestamps for SMA
  const smaBucketCloses = new Array<number>(candleBuckets.length);
  const smaBucketTs = new Array<number>(candleBuckets.length);
  for (let i = 0; i < candleBuckets.length; i++) {
    const b = candleBuckets[i];
    smaBucketCloses[i] = b.close;
    smaBucketTs[i] = b.startTs + (b.endTs - b.startTs) / 2;
  }

  if (chartMode === "candle") {
    // Expand Y-range with candle high/low
    for (const b of candleBuckets) {
      dataMin = Math.min(dataMin, b.low);
      dataMax = Math.max(dataMax, b.high);
    }
    // Compute candle body width
    const pixelBucketWidth = (bucketMs / effectiveRangeMs) * chartW;
    candleWidthPx = Math.max(2, Math.min(12, pixelBucketWidth * 0.7));
  }

  for (const ol of overlayLines) {
    const len = Math.min(ol.timestamps.length, ol.dayChangePct.length);
    for (let i = 0; i < len; i++) {
      const ts = ol.timestamps[i];
      const val = ol.dayChangePct[i];
      if (!Number.isFinite(ts) || !Number.isFinite(val) || ts < startTs || ts > endTs) {
        continue;
      }
      dataMin = Math.min(dataMin, val);
      dataMax = Math.max(dataMax, val);
    }
  }

  const nice = niceScale({ dataMin, dataMax, maxTicks: 5, padding: 0.08 });
  const min = nice.min;
  const max = nice.max;
  const range = max - min;

  const toY = (value: number) =>
    pad.top + chartH - ((value - min) / range) * chartH;
  const baselineY = metric.baseline == null ? null : toY(metric.baseline);
  const baselineVisible =
    baselineY != null && baselineY >= pad.top && baselineY <= pad.top + chartH;
  const fillBaseY =
    metric.baseline != null && baselineVisible ? baselineY : pad.top + chartH;
  const shouldFillMetricArea =
    metric.baseline == null || baselineVisible || metric.forceBaseline !== false;

  // ── LTTB downsampling (line mode only, in-window points) ────────────
  const maxRenderPoints = chartW * 2;
  let renderPoints: AccountHistoryPoint[];
  let values: number[];
  let originalIndexMap: number[] | null = null;

  // For line mode, filter to in-window points for rendering/downsampling
  let visiblePoints: AccountHistoryPoint[];
  let visibleValues: number[];
  if (chartMode === "candle") {
    visiblePoints = points;
    visibleValues = allValues;
  } else {
    visiblePoints = [];
    visibleValues = [];
    for (let i = 0; i < points.length; i++) {
      if (points[i].ts >= startTs && points[i].ts <= endTs) {
        visiblePoints.push(points[i]);
        visibleValues.push(allValues[i]);
      }
    }
  }

  if (chartMode === "candle") {
    renderPoints = visiblePoints;
    values = visibleValues;
  } else if (visiblePoints.length > maxRenderPoints) {
    const sampledIndices = downsampleLTTB(
      visiblePoints.map((p) => p.ts),
      visibleValues,
      maxRenderPoints,
    );
    renderPoints = new Array(sampledIndices.length);
    values = new Array(sampledIndices.length);
    originalIndexMap = sampledIndices;
    for (let i = 0; i < sampledIndices.length; i++) {
      renderPoints[i] = visiblePoints[sampledIndices[i]];
      values[i] = visibleValues[sampledIndices[i]];
    }
  } else {
    renderPoints = visiblePoints;
    values = visibleValues;
  }

  // ── Grid lines ─────────────────────────────────────────────────────
  drawGridLines(ctx, nice, toY, chartW, chartH);

  if (metric.baseline != null) {
    drawBaselineLine(ctx, metric.baseline, metric.forceBaseline, toY, chartW, chartH);
  }

  drawMarketBoundaries(ctx, startTs, endTs, effectiveRangeMs, toX, chartW, chartH);

  // ── Clip to chart area (prevents pre-window SMA/data from bleeding) ─
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.left, pad.top, chartW, chartH);
  ctx.clip();

  // ── Data drawing ───────────────────────────────────────────────────
  if (chartMode === "candle" && candleWidthPx != null) {
    drawCandlesticks(ctx, candleBuckets, toX, toY, candleWidthPx);
  } else {
    // Line mode: gap detection anchored to original (non-downsampled) visible points
    const trueGapOriginalIndices = buildTrueGapOriginalIndices(visiblePoints);
    const segments = buildLineSegments(renderPoints, trueGapOriginalIndices, originalIndexMap);

    drawDataLine(
      ctx, segments, renderPoints, values, metric,
      toX, toY, chartH, fillBaseY,
      shouldFillMetricArea, baselineVisible, min, max,
    );

    // End-point dot (line mode only)
    drawEndPointDot(ctx, renderPoints, values, metric, toX, toY);
  }

  // ── SMA overlays (bucket-based, both modes) ───────────────────────
  const smaSlots: SmaSlotState[] = [];
  for (let si = 0; si < smaPeriods.length; si++) {
    const period = smaPeriods[si];
    if (period <= 0) continue;
    const color = SMA_COLORS[si] ?? SMA_COLORS[0];
    const vals = drawSmaOverlay(
      ctx, period, smaBucketCloses, smaBucketTs, toX, toY, color, chartW,
    );
    if (vals) {
      smaSlots.push({ period, values: vals, color });
    }
  }

  // ── Index overlay lines ────────────────────────────────────────────
  drawIndexOverlayLines(ctx, overlayLines, startTs, endTs, toX, toY, chartW);

  // ── Current-value horizontal dashed lines ─────────────────────────
  drawCurrentValueLines(ctx, renderPoints, values, metric, overlayLines, toY, chartW, chartH, startTs, endTs);

  // ── Restore clip ─────────────────────────────────────────────────
  ctx.restore();

  // ── Axis labels ────────────────────────────────────────────────────
  drawYAxisLabels(ctx, nice, metric, toY, chartW, chartH);
  drawXAxisLabels(ctx, axisMapping, startTs, endTs, effectiveRangeMs, toX, chartW, chartH);

  // ── Current-value tags on right Y-axis (drawn last, highest z-order) ──
  drawCurrentValueTags(ctx, renderPoints, values, metric, overlayLines, toY, chartW, chartH, startTs, endTs);

  // ── Snapshot the base image ────────────────────────────────────────
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return {
    imageData,
    values,
    toX,
    toY,
    pad,
    chartW,
    chartH,
    metric,
    rangeDurationMs: effectiveRangeMs,
    windowStartTs: startTs,
    windowEndTs: endTs,
    renderPoints,
    originalIndexMap,
    smaSlots,
    smaBucketTs,
    overlayLines,
    chartMode,
    candleBuckets,
    candleWidthPx,
  };
}
