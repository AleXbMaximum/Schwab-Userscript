import type { CandleBucket } from "../data/candleAggregation";
import { DS_COLORS } from "../../../components/core/theme";

const CANDLE_GREEN = DS_COLORS.raw.positive;
const CANDLE_RED = DS_COLORS.raw.negative;

/**
 * Determine candle color: standard close >= open = green, else red.
 * Always compares within each candle (not against metric baseline),
 * so individual candle direction is visible even when all values
 * are above/below baseline.
 */
function candleColor(bucket: CandleBucket): string {
  return bucket.close >= bucket.open ? CANDLE_GREEN : CANDLE_RED;
}

/**
 * Draw OHLC candlestick bars on the chart canvas.
 * The last candle is drawn with reduced alpha to indicate it is still forming.
 */
export function drawCandlesticks(
  ctx: CanvasRenderingContext2D,
  buckets: CandleBucket[],
  toX: (ts: number) => number,
  toY: (value: number) => number,
  candleWidthPx: number,
): void {
  if (buckets.length === 0) return;

  const halfW = candleWidthPx / 2;
  const lastIdx = buckets.length - 1;

  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    const isLast = i === lastIdx;

    // Center X of the candle is at bucket midpoint timestamp
    const cx = toX(b.startTs + (b.endTs - b.startTs) / 2);
    const color = candleColor(b);

    if (isLast) ctx.globalAlpha = 0.5;

    // Wick (high to low)
    const wickTop = toY(b.high);
    const wickBot = toY(b.low);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, wickTop);
    ctx.lineTo(cx, wickBot);
    ctx.stroke();

    // Body (open to close)
    const bodyTop = toY(Math.max(b.open, b.close));
    const bodyBot = toY(Math.min(b.open, b.close));
    const bodyH = Math.max(1, bodyBot - bodyTop);

    ctx.fillStyle = color;
    ctx.fillRect(cx - halfW, bodyTop, candleWidthPx, bodyH);

    if (isLast) ctx.globalAlpha = 1;
  }
}
