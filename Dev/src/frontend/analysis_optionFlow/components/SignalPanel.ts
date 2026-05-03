import { ui_createElement } from "frontend/components/core/builders/createElement";
import {
  DS_COLORS,
  DS_TYPOGRAPHY,
  DS_SPACING,
  DS_RADIUS,
  DS_OPACITY,
  DS_COMPONENTS,
} from "frontend/components/core/styles/theme";
import { isDarkTheme } from "frontend/components/core/axTheme";
import { CHART_FONTS } from "frontend/charts/ChartTheme";
import type {
  SignalResult,
  SignalSeverity,
  SignalChartData,
  SparklineChartData,
  GaugeChartData,
  BarsChartData,
  MultiLineChartData,
} from "../signals/types";
import { OPTIONS_SEMANTIC_COLORS } from "frontend/charts/ChartTheme";

// ── Canvas sizing ───────────────────────────────────────────────────────────

const CHART_HEIGHT = 40;

// ── Severity styling ────────────────────────────────────────────────────────

function severityStyle(severity: SignalSeverity): {
  bg: string;
  border: string;
  dotColor: string;
  lineColor: string;
  fillColor: string;
} {
  switch (severity) {
    case "bullish":
      return {
        bg: DS_COLORS.bgPositive,
        border: `rgba(32,169,69,${DS_OPACITY.border})`,
        dotColor: DS_COLORS.raw.positive,
        lineColor: DS_COLORS.raw.positive,
        fillColor: "rgba(32,169,69,0.12)",
      };
    case "bearish":
      return {
        bg: DS_COLORS.bgNegative,
        border: `rgba(215,49,38,${DS_OPACITY.border})`,
        dotColor: DS_COLORS.raw.negative,
        lineColor: DS_COLORS.raw.negative,
        fillColor: "rgba(215,49,38,0.12)",
      };
    case "alert":
      return {
        bg: DS_COLORS.bgNeutral,
        border: `rgba(215,129,0,${DS_OPACITY.border})`,
        dotColor: DS_COLORS.raw.neutral,
        lineColor: DS_COLORS.raw.neutral,
        fillColor: "rgba(215,129,0,0.12)",
      };
    default:
      return {
        bg: DS_COLORS.bgMuted,
        border: "var(--ax-tone-muted-border)",
        dotColor: DS_COLORS.raw.muted,
        lineColor: DS_COLORS.raw.muted,
        fillColor: isDarkTheme()
          ? "rgba(162,162,167,0.18)"
          : "rgba(142,142,147,0.10)",
      };
  }
}

// ── Canvas helpers ──────────────────────────────────────────────────────────

function createHiDpiCanvas(width: number, height: number): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.cssText = `width:${width}px; height:${height}px; display:block;`;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.scale(dpr, dpr);
  return canvas;
}

function minMax(arr: number[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const v of arr) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) return { min: 0, max: 1 };
  if (min === max) return { min: min - 1, max: max + 1 };
  return { min, max };
}

// ── Mini chart renderers ────────────────────────────────────────────────────

function drawSparkline(
  canvas: HTMLCanvasElement,
  data: SparklineChartData,
  lineColor: string,
  fillColor: string,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx || data.points.length < 2) return;

  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  const pad = 2;

  const { min, max } = minMax(data.points);
  const n = data.points.length;

  const xStep = (w - pad * 2) / (n - 1);
  const yScale = (h - pad * 2) / (max - min);
  const toX = (i: number) => pad + i * xStep;
  const toY = (v: number) => pad + (max - v) * yScale;

  // Fill area under line
  ctx.beginPath();
  ctx.moveTo(toX(0), h);
  for (let i = 0; i < n; i++) {
    ctx.lineTo(toX(i), toY(data.points[i]));
  }
  ctx.lineTo(toX(n - 1), h);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(data.points[0]));
  for (let i = 1; i < n; i++) {
    ctx.lineTo(toX(i), toY(data.points[i]));
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Current value dot
  const ci = data.currentIdx;
  if (ci >= 0 && ci < n) {
    ctx.beginPath();
    ctx.arc(toX(ci), toY(data.points[ci]), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }
}

function drawGauge(
  canvas: HTMLCanvasElement,
  data: GaugeChartData,
  severity: SignalSeverity,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  const pad = 4;
  const trackH = 6;
  const trackY = h / 2 - trackH / 2;
  const trackW = w - pad * 2;

  const rangeSpan = data.range[1] - data.range[0];
  if (rangeSpan <= 0) return;

  const norm = (v: number) =>
    Math.max(0, Math.min(1, (v - data.range[0]) / rangeSpan));
  const toX = (v: number) => pad + norm(v) * trackW;

  // Track background
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.beginPath();
  ctx.roundRect(pad, trackY, trackW, trackH, trackH / 2);
  ctx.fill();

  // Colored zone: green above flip, red below flip
  const flipX = toX(data.reference);
  const spotX = toX(data.value);
  const aboveFlip = data.value >= data.reference;

  if (aboveFlip) {
    ctx.fillStyle = "rgba(32,169,69,0.25)";
    ctx.beginPath();
    ctx.roundRect(flipX, trackY, spotX - flipX, trackH, trackH / 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(215,49,38,0.25)";
    ctx.beginPath();
    ctx.roundRect(spotX, trackY, flipX - spotX, trackH, trackH / 2);
    ctx.fill();
  }

  // Gamma flip marker (vertical line)
  ctx.strokeStyle = OPTIONS_SEMANTIC_COLORS.gammaFlip;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(flipX, trackY - 4);
  ctx.lineTo(flipX, trackY + trackH + 4);
  ctx.stroke();
  ctx.setLineDash([]);

  // Spot marker (circle)
  const spotColor =
    severity === "bullish"
      ? DS_COLORS.raw.positive
      : severity === "bearish"
        ? DS_COLORS.raw.negative
        : DS_COLORS.raw.neutral;
  ctx.beginPath();
  ctx.arc(spotX, trackY + trackH / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = spotColor;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Labels
  ctx.font = CHART_FONTS.tickSmall;
  ctx.textAlign = "center";
  ctx.fillStyle = OPTIONS_SEMANTIC_COLORS.gammaFlip;
  ctx.fillText("\u03B3", flipX, trackY - 6);
  ctx.fillStyle = spotColor;
  ctx.fillText("S", spotX, trackY + trackH + 12);
}

function drawBars(
  canvas: HTMLCanvasElement,
  data: BarsChartData,
  severity: SignalSeverity,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx || data.values.length === 0) return;

  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  const pad = 2;
  const labelH = 10;
  const chartH = h - pad - labelH;

  const { min, max } = minMax(data.values);
  const n = data.values.length;
  const gap = 2;
  const barW = Math.max(4, (w - pad * 2 - gap * (n - 1)) / n);

  const yScale = chartH / (max - min || 1);

  // Determine bar colors: highlight backwardation (near > far)
  const isBackwardation = severity === "bearish" || severity === "alert";
  const barColor = isBackwardation
    ? DS_COLORS.raw.negative
    : DS_COLORS.raw.positive;
  const barAlpha = isBackwardation
    ? "rgba(215,49,38,0.6)"
    : "rgba(32,169,69,0.6)";

  for (let i = 0; i < n; i++) {
    const x = pad + i * (barW + gap);
    const barH = Math.max(2, (data.values[i] - min) * yScale);
    const y = pad + chartH - barH;

    ctx.fillStyle = barAlpha;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 2);
    ctx.fill();

    // Label below bar
    ctx.font = CHART_FONTS.tickSmall;
    ctx.textAlign = "center";
    ctx.fillStyle = DS_COLORS.raw.muted;
    ctx.fillText(data.labels[i], x + barW / 2, h - 1);
  }

  // Trend line connecting bar tops
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = pad + i * (barW + gap) + barW / 2;
    const barH = Math.max(2, (data.values[i] - min) * yScale);
    const y = pad + chartH - barH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = barColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMultiLine(
  canvas: HTMLCanvasElement,
  data: MultiLineChartData,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  const pad = 2;

  // Global min/max across all series
  let globalMin = Infinity;
  let globalMax = -Infinity;
  let maxLen = 0;
  for (const s of data.series) {
    for (const v of s.points) {
      if (v < globalMin) globalMin = v;
      if (v > globalMax) globalMax = v;
    }
    if (s.points.length > maxLen) maxLen = s.points.length;
  }
  if (!Number.isFinite(globalMin) || globalMin === globalMax) {
    globalMin = (globalMin || 0) - 1;
    globalMax = (globalMax || 0) + 1;
  }

  const xStep = maxLen > 1 ? (w - pad * 2) / (maxLen - 1) : 0;
  const yScale = (h - pad * 2) / (globalMax - globalMin);
  const toX = (i: number) => pad + i * xStep;
  const toY = (v: number) => pad + (globalMax - v) * yScale;

  for (const series of data.series) {
    if (series.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(series.points[0]));
    for (let i = 1; i < series.points.length; i++) {
      ctx.lineTo(toX(i), toY(series.points[i]));
    }
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    // End dot
    const lastIdx = series.points.length - 1;
    ctx.beginPath();
    ctx.arc(toX(lastIdx), toY(series.points[lastIdx]), 2, 0, Math.PI * 2);
    ctx.fillStyle = series.color;
    ctx.fill();
  }
}

// ── Chart dispatcher ────────────────────────────────────────────────────────

function renderMiniChart(
  chartData: SignalChartData,
  severity: SignalSeverity,
  lineColor: string,
  fillColor: string,
  containerWidth: number,
): HTMLCanvasElement {
  const canvas = createHiDpiCanvas(containerWidth, CHART_HEIGHT);

  // Defer drawing until next frame so layout is settled
  requestAnimationFrame(() => {
    switch (chartData.kind) {
      case "sparkline":
        drawSparkline(canvas, chartData, lineColor, fillColor);
        break;
      case "gauge":
        drawGauge(canvas, chartData, severity);
        break;
      case "bars":
        drawBars(canvas, chartData, severity);
        break;
      case "multiLine":
        drawMultiLine(canvas, chartData);
        break;
    }
  });

  return canvas;
}

// ── Card renderer ───────────────────────────────────────────────────────────

function renderSignalCard(signal: SignalResult): HTMLElement {
  const style = severityStyle(signal.severity);

  const card = ui_createElement("div", {
    styleString:
      `background: ${style.bg}; border: 1px solid ${style.border};` +
      ` border-radius: ${DS_RADIUS.md}; padding: ${DS_SPACING.sm} ${DS_SPACING.md};` +
      ` display: flex; flex-direction: column; gap: ${DS_SPACING.xs}; min-width: 0;`,
  });

  // Header: dot + label
  const header = ui_createElement("div", {
    styleString: `display: flex; align-items: center; gap: ${DS_SPACING.sm};`,
  });

  const dot = ui_createElement("div", {
    styleString: DS_COMPONENTS.statusDot(style.dotColor),
  });

  const label = ui_createElement("span", {
    text: signal.label,
    styleString: DS_TYPOGRAPHY.metricLabelMini + " white-space: nowrap;",
  });

  header.appendChild(dot);
  header.appendChild(label);

  // Value
  const value = ui_createElement("div", {
    text: signal.value,
    styleString:
      DS_TYPOGRAPHY.metricValue +
      " white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
  });

  // Mini chart (if data available)
  const chartSlot = ui_createElement("div", {
    styleString: `width: 100%; min-height: ${CHART_HEIGHT}px;`,
  });

  // Detail
  const detail = ui_createElement("div", {
    text: signal.detail,
    styleString:
      DS_TYPOGRAPHY.caption +
      " white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
  });

  card.appendChild(header);
  card.appendChild(value);
  card.appendChild(chartSlot);
  card.appendChild(detail);

  // Tooltip: show full detail on hover for truncated text
  card.title = `${signal.label}: ${signal.value}\n${signal.detail}`;

  // Render chart after DOM insertion so we know the container width
  if (signal.chartData) {
    requestAnimationFrame(() => {
      const containerW = chartSlot.offsetWidth || 120;
      const canvas = renderMiniChart(
        signal.chartData!,
        signal.severity,
        style.lineColor,
        style.fillColor,
        containerW,
      );
      chartSlot.appendChild(canvas);
    });
  }

  return card;
}

// ── Panel entry ─────────────────────────────────────────────────────────────

export function renderSignalPanel(signals: SignalResult[]): HTMLElement {
  const strip = ui_createElement("div", {
    styleString:
      `display: grid; grid-template-columns: repeat(${signals.length}, 1fr);` +
      ` gap: ${DS_SPACING.md}; margin-bottom: ${DS_SPACING.lg};`,
  });

  for (const signal of signals) {
    strip.appendChild(renderSignalCard(signal));
  }

  return strip;
}
