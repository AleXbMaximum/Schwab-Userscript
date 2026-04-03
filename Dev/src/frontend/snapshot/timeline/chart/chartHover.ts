import { DS_COLORS, ds_signColorRaw } from "../../../components/core/theme";
import type { AccountHistoryPoint } from "../../../../backend/core/db/account/accountHistoryTypes";
import { formatMetricValue, formatTimeLabel } from "../timelineFormatters";
import { findCandleBucketByTs } from "../data/candleAggregation";
import type { SnapshotChartBaseState } from "./chartTypes";

/** Binary-search for the nearest overlay data point at a given timestamp. */
function findNearestOverlayIndex(
  timestamps: number[],
  targetTs: number,
): number | null {
  const n = timestamps.length;
  if (n === 0) return null;
  if (targetTs <= timestamps[0]) return 0;
  if (targetTs >= timestamps[n - 1]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (timestamps[mid] <= targetTs) lo = mid;
    else hi = mid;
  }
  return targetTs - timestamps[lo] <= timestamps[hi] - targetTs ? lo : hi;
}

/**
 * Draw the hover tooltip on top of a cached base chart.
 * Restores the base image first, then draws only the tooltip overlay.
 */
export function drawSnapshotChartHover(
  canvas: HTMLCanvasElement,
  baseState: SnapshotChartBaseState,
  hoveredIndex: number | null,
  originalPoints: AccountHistoryPoint[],
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  ctx.putImageData(baseState.imageData, 0, 0);

  if (
    hoveredIndex == null ||
    hoveredIndex < 0 ||
    hoveredIndex >= originalPoints.length
  )
    return;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const { toX, toY, pad, chartW, chartH, metric, rangeDurationMs } = baseState;
  const point = originalPoints[hoveredIndex];
  const value = metric.pick(point);
  const hx = toX(point.ts);
  const hy = toY(value);

  if (
    hx < pad.left ||
    hx > pad.left + chartW ||
    hy < pad.top ||
    hy > pad.top + chartH
  )
    return;

  ctx.save();

  // ── Candle mode hover: highlight candle + OHLC tooltip ────────────
  const isCandle = baseState.chartMode === "candle";
  const hoveredCandle = isCandle
    ? findCandleBucketByTs(baseState.candleBuckets, point.ts)
    : null;

  if (hoveredCandle && baseState.candleWidthPx != null) {
    const cx = toX(hoveredCandle.startTs + (hoveredCandle.endTs - hoveredCandle.startTs) / 2);
    const halfW = baseState.candleWidthPx / 2;
    // Highlight rectangle around the candle — colored to match candle direction
    const candleDir = hoveredCandle.close >= hoveredCandle.open
      ? DS_COLORS.raw.positive
      : DS_COLORS.raw.negative;
    ctx.strokeStyle = candleDir;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    const highY = toY(hoveredCandle.high);
    const lowY = toY(hoveredCandle.low);
    ctx.strokeRect(cx - halfW - 2, highY - 2, baseState.candleWidthPx + 4, lowY - highY + 4);
  }

  // Vertical dashed line
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(hx, pad.top);
  ctx.lineTo(hx, pad.top + chartH);
  ctx.stroke();
  ctx.setLineDash([]);

  if (!isCandle) {
    // Hover dot (line mode only)
    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, Math.PI * 2);
    ctx.fillStyle =
      metric.baseline != null
        ? ds_signColorRaw(value - metric.baseline)
        : metric.color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Hover dots on overlay lines
  const overlayHoverTexts: { text: string; color: string }[] = [];
  for (const ol of baseState.overlayLines) {
    if (ol.dayChangePct.length === 0) continue;
    const idx = findNearestOverlayIndex(ol.timestamps, point.ts);
    if (idx == null || idx >= ol.dayChangePct.length) continue;
    const olTs = ol.timestamps[idx];
    if (
      !Number.isFinite(olTs) ||
      olTs < baseState.windowStartTs ||
      olTs > baseState.windowEndTs
    ) {
      continue;
    }
    const olVal = ol.dayChangePct[idx];
    if (!Number.isFinite(olVal)) continue;
    const olX = toX(olTs);
    const olY = toY(olVal);
    if (olX >= pad.left && olX <= pad.left + chartW) {
      ctx.beginPath();
      ctx.arc(olX, olY, 3, 0, Math.PI * 2);
      ctx.fillStyle = ol.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const pct = olVal * 100;
    const sign = pct >= 0 ? "+" : "";
    overlayHoverTexts.push({
      text: `${ol.symbol.replace("$", "")}: ${sign}${pct.toFixed(2)}%`,
      color: ol.color,
    });
  }

  // Tooltip box
  const timeText = formatTimeLabel(point.ts, rangeDurationMs);
  const allTextLines: string[] = [timeText];
  const textColors: (string | null)[] = [null]; // null = use DS_COLORS.raw.textSecondary

  if (hoveredCandle) {
    // OHLC tooltip for candle mode
    const oText = `O: ${formatMetricValue(metric, hoveredCandle.open)}`;
    const hText = `H: ${formatMetricValue(metric, hoveredCandle.high)}`;
    const lText = `L: ${formatMetricValue(metric, hoveredCandle.low)}`;
    const cText = `C: ${formatMetricValue(metric, hoveredCandle.close)}`;
    const closeColor = ds_signColorRaw(hoveredCandle.close - hoveredCandle.open);
    allTextLines.push(oText, hText, lText, cText);
    textColors.push(closeColor, closeColor, closeColor, closeColor);
  } else {
    // Single value for line mode
    const valueText = `${metric.label}: ${formatMetricValue(metric, value)}`;
    const valueColor = metric.baseline != null
      ? ds_signColorRaw(value - metric.baseline)
      : ds_signColorRaw(value);
    allTextLines.push(valueText);
    textColors.push(valueColor);
  }

  for (const slot of baseState.smaSlots) {
    if (slot.period <= 0 || baseState.smaBucketTs.length === 0) continue;
    const bucketIdx = findNearestOverlayIndex(baseState.smaBucketTs, point.ts);
    if (bucketIdx == null || bucketIdx >= slot.values.length) continue;
    const sv = slot.values[bucketIdx];
    if (sv == null) continue;
    const delta = value - sv;
    const sign = delta >= 0 ? "+" : "";
    const deltaStr = `Δ${sign}${formatMetricValue(metric, delta)}`;
    allTextLines.push(`SMA${slot.period}: ${formatMetricValue(metric, sv)}  ${deltaStr}`);
    textColors.push(slot.color);
  }
  for (const ot of overlayHoverTexts) {
    allTextLines.push(ot.text);
    textColors.push(ot.color);
  }

  ctx.font =
    '600 11px var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';

  let tooltipW = 0;
  for (const line of allTextLines) {
    tooltipW = Math.max(tooltipW, ctx.measureText(line).width);
  }
  tooltipW += 14;
  const lineH = 12;
  const tooltipH = 8 + allTextLines.length * lineH;

  let tx = hx + 10;
  if (tx + tooltipW > pad.left + chartW) tx = hx - tooltipW - 10;
  tx = Math.max(pad.left, Math.min(tx, pad.left + chartW - tooltipW));

  let ty = hy - tooltipH - 10;
  if (ty < pad.top + 2) ty = hy + 10;
  ty = Math.max(pad.top + 2, Math.min(ty, pad.top + chartH - tooltipH - 2));

  const r = 6;
  ctx.beginPath();
  ctx.moveTo(tx + r, ty);
  ctx.lineTo(tx + tooltipW - r, ty);
  ctx.quadraticCurveTo(tx + tooltipW, ty, tx + tooltipW, ty + r);
  ctx.lineTo(tx + tooltipW, ty + tooltipH - r);
  ctx.quadraticCurveTo(
    tx + tooltipW,
    ty + tooltipH,
    tx + tooltipW - r,
    ty + tooltipH,
  );
  ctx.lineTo(tx + r, ty + tooltipH);
  ctx.quadraticCurveTo(tx, ty + tooltipH, tx, ty + tooltipH - r);
  ctx.lineTo(tx, ty + r);
  ctx.quadraticCurveTo(tx, ty, tx + r, ty);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  let textY = ty + 5;
  for (let i = 0; i < allTextLines.length; i++) {
    ctx.fillStyle = textColors[i] ?? DS_COLORS.raw.textSecondary;
    ctx.fillText(allTextLines[i], tx + 7, textY);
    textY += lineH;
  }

  ctx.restore();
}
