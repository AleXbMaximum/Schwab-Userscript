export const SPARKLINE_WIDTH = 52;
export const SPARKLINE_HEIGHT = 20;

const POS_R = 32,
  POS_G = 169,
  POS_B = 69;
const NEG_R = 215,
  NEG_G = 49,
  NEG_B = 38;

interface ColorTier {
  threshold: number;
  fillAlpha: number;
  lineAlpha: number;
}

const COLOR_TIERS: readonly ColorTier[] = [
  { threshold: 0.5, fillAlpha: 0.06, lineAlpha: 0.3 },
  { threshold: 1.0, fillAlpha: 0.1, lineAlpha: 0.45 },
  { threshold: 2.0, fillAlpha: 0.15, lineAlpha: 0.65 },
  { threshold: 3.0, fillAlpha: 0.22, lineAlpha: 0.8 },
  { threshold: 5.0, fillAlpha: 0.28, lineAlpha: 0.92 },
  { threshold: Infinity, fillAlpha: 0.35, lineAlpha: 1.0 },
];

const BASELINE_DASH: readonly [number, number] = [2, 2];
const BASELINE_STROKE = "rgba(142,142,147,0.62)";
const BASELINE_WIDTH = 0.9;

export interface SparklineColors {
  line: string;
  fill: string;
}

export function getSparklineColors(changePct: number): SparklineColors {
  const abs = Math.abs(changePct);
  const isPositive = changePct >= 0;
  const tier =
    COLOR_TIERS.find((t) => abs < t.threshold) ??
    COLOR_TIERS[COLOR_TIERS.length - 1];
  const [r, g, b] = isPositive ? [POS_R, POS_G, POS_B] : [NEG_R, NEG_G, NEG_B];
  return {
    line: `rgba(${r},${g},${b},${tier.lineAlpha})`,
    fill: `rgba(${r},${g},${b},${tier.fillAlpha})`,
  };
}

export function createHiDpiSparklineCanvas(): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(SPARKLINE_WIDTH * dpr);
  canvas.height = Math.round(SPARKLINE_HEIGHT * dpr);
  canvas.style.cssText = `width:${SPARKLINE_WIDTH}px;height:${SPARKLINE_HEIGHT}px;display:block;`;
  canvas.className = "table-sparkline-canvas";
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.scale(dpr, dpr);
  return canvas;
}

function computeYRange(
  prices: number[],
  changePct: number,
  previousClose: number | null,
): { min: number; max: number } {
  const abs = Math.abs(changePct);

  if (abs < 0.5 && prices.length > 0) {
    // Pin Y-axis to ±1% of the opening price so tiny moves don't fill the chart.
    const open = prices[0];
    let lo = open * 0.99;
    let hi = open * 1.01;
    if (previousClose !== null && previousClose > 0) {
      lo = Math.min(lo, previousClose);
      hi = Math.max(hi, previousClose);
    }
    return { min: lo, max: hi };
  }

  // Auto-scale to data range with small padding.
  let min = Infinity;
  let max = -Infinity;
  for (const p of prices) {
    if (p < min) min = p;
    if (p > max) max = p;
  }
  // Include previousClose in data range so the baseline is always visible.
  if (previousClose !== null && previousClose > 0) {
    if (previousClose < min) min = previousClose;
    if (previousClose > max) max = previousClose;
  }
  if (!Number.isFinite(min) || min === max) {
    const mid = Number.isFinite(min) ? min : 100;
    return { min: mid - 1, max: mid + 1 };
  }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}
export function drawIntradaySparkline(
  canvas: HTMLCanvasElement,
  prices: number[],
  changePct: number,
  previousClose?: number | null,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx || prices.length < 2) return;

  const w = SPARKLINE_WIDTH;
  const h = SPARKLINE_HEIGHT;
  const pad = 1;
  const prevClose = previousClose ?? null;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const { min, max } = computeYRange(prices, changePct, prevClose);
  const colors = getSparklineColors(changePct);
  const n = prices.length;

  const xStep = (w - pad * 2) / (n - 1);
  const yRange = max - min || 1;
  const toX = (i: number) => pad + i * xStep;
  const toY = (v: number) => pad + ((max - v) / yRange) * (h - pad * 2);

  if (prevClose !== null && prevClose > 0) {
    const baseY = toY(prevClose);
    ctx.save();
    ctx.setLineDash(BASELINE_DASH);
    ctx.strokeStyle = BASELINE_STROKE;
    ctx.lineWidth = BASELINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(pad, baseY);
    ctx.lineTo(w - pad, baseY);
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.moveTo(toX(0), h);
  for (let i = 0; i < n; i++) {
    ctx.lineTo(toX(i), toY(prices[i]));
  }
  ctx.lineTo(toX(n - 1), h);
  ctx.closePath();
  ctx.fillStyle = colors.fill;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(prices[0]));
  for (let i = 1; i < n; i++) {
    ctx.lineTo(toX(i), toY(prices[i]));
  }
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1.2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  const lastIdx = n - 1;
  ctx.beginPath();
  ctx.arc(toX(lastIdx), toY(prices[lastIdx]), 1.5, 0, Math.PI * 2);
  ctx.fillStyle = colors.line;
  ctx.fill();
}
