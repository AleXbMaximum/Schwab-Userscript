import { CHART_COLORS, CHART_FONTS, getHeatmapColor } from "../ChartTheme";
import { clamp, normalize } from "shared/utils/math/numeric";
import { formatCompactDollar } from "shared/utils/format/formatters";
import { traceRoundRect } from "./heatmapInterpolation";
import type { HeatmapOptions } from "./HeatmapTypes";

export const HEATMAP_CELL_GAP = 1;
export const HEATMAP_CELL_RADIUS = 2;

export type RenderContext = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  options: Required<HeatmapOptions>;
  minValue: number;
  maxValue: number;
  totalGridWidth: number;
  gridStartY: number;
  rowLabelWidth: number;
  colX: (col: number) => number;
  colW: (col: number) => number;
  gridBg: string;
  setBaseImageData: (data: ImageData) => void;
  renderHoverOnly: () => void;
  drawSpotLine: (startX: number, startY: number) => void;
  drawColorScale: () => void;
};

function normalizeCellValue(c: RenderContext, value: number): number {
  const { options, minValue, maxValue } = c;
  if (options.colorScale === "diverging") {
    if (!Number.isFinite(value)) return 0;
    const rawMin = Number.isFinite(options.colorRangeMin)
      ? options.colorRangeMin
      : minValue;
    const rawMax = Number.isFinite(options.colorRangeMax)
      ? options.colorRangeMax
      : maxValue;
    const minBound = Math.min(rawMin, 0);
    const maxBound = Math.max(rawMax, 0);
    if (value >= 0) {
      const positiveDenom =
        maxBound > 0 ? maxBound : Math.max(Math.abs(maxValue), 1);
      return clamp(value / positiveDenom, 0, 1);
    }
    const negativeDenom =
      minBound < 0 ? Math.abs(minBound) : Math.max(Math.abs(minValue), 1);
    return clamp(value / negativeDenom, -1, 0);
  }
  return normalize(value, minValue, maxValue);
}

function getTextColorForNormalized(normalizedValue: number): string {
  return Math.abs(normalizedValue) > 0.5 ? "#fff" : "#000";
}

function formatCompactValue(value: number): string {
  return formatCompactDollar(value, { sign: true });
}

export function renderHeatmap(c: RenderContext): void {
  const { ctx, canvas, options, totalGridWidth, gridStartY, rowLabelWidth } = c;
  const { rows, columns, data, cellWidth, cellHeight, showValues, valueFormatter } = options;

  const dpr = window.devicePixelRatio || 1;
  const canvasW = canvas.width / dpr;
  const canvasH = canvas.height / dpr;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvasW, canvasH);

  const startX = rowLabelWidth;
  const startY = gridStartY;
  const gap = HEATMAP_CELL_GAP;
  const rad = HEATMAP_CELL_RADIUS;

  const gridW = totalGridWidth;
  const gridH = rows.length * cellHeight;
  ctx.fillStyle = c.gridBg;
  traceRoundRect(ctx, startX, startY, gridW, gridH, 4);
  ctx.fill();

  ctx.fillStyle = CHART_COLORS.textSecondary;
  ctx.font = CHART_FONTS.heatmapLight;
  if (options.rotateColumnLabels) {
    for (let col = 0; col < columns.length; col++) {
      const centerX = startX + c.colX(col) + c.colW(col) / 2;
      ctx.save();
      ctx.translate(centerX, startY - 6);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(columns[col], 0, 0);
      ctx.restore();
    }
  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const minLabelSpacing = 60;
    let lastLabelX = -Infinity;
    for (let col = 0; col < columns.length; col++) {
      const centerX = startX + c.colX(col) + c.colW(col) / 2;
      if (
        centerX - lastLabelX < minLabelSpacing &&
        col !== 0 &&
        col !== columns.length - 1
      )
        continue;
      ctx.fillText(columns[col], centerX, startY - 6);
      lastLabelX = centerX;
    }
  }

  for (let row = 0; row < rows.length; row++) {
    for (let col = 0; col < columns.length; col++) {
      const value = data[row][col];
      const cw = c.colW(col);
      const x = startX + c.colX(col);
      const y = startY + row * cellHeight;
      const normalizedValue = normalizeCellValue(c, value);
      const color = getHeatmapColor(normalizedValue);

      ctx.fillStyle = color;
      traceRoundRect(ctx, x + gap, y + gap, cw - gap * 2, cellHeight - gap * 2, rad);
      ctx.fill();

      if (showValues) {
        ctx.fillStyle = getTextColorForNormalized(normalizedValue);
        ctx.font = CHART_FONTS.heatmap;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const displayValue =
          Math.abs(value) > 1000
            ? formatCompactValue(value)
            : valueFormatter(value);
        ctx.fillText(displayValue, x + cw / 2, y + cellHeight / 2);
      }
    }
  }

  const hCol = options.highlightCol;
  if (hCol >= 0 && hCol < columns.length) {
    const hcw = c.colW(hCol);
    const hx = startX + c.colX(hCol) + hcw / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0, 122, 255, 0.06)";
    ctx.fillRect(startX + c.colX(hCol), startY, hcw, rows.length * cellHeight);
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0, 122, 255, 0.5)";
    ctx.beginPath();
    ctx.moveTo(hx, startY);
    ctx.lineTo(hx, startY + rows.length * cellHeight);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = CHART_COLORS.info;
    ctx.font = CHART_FONTS.axisBold;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(options.highlightColLabel, hx, startY - 20);
    ctx.beginPath();
    ctx.moveTo(hx - 4, startY - 18);
    ctx.lineTo(hx + 4, startY - 18);
    ctx.lineTo(hx, startY - 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const hRow = options.highlightRow;
  if (hRow >= 0 && hRow < rows.length) {
    const hy = startY + hRow * cellHeight + cellHeight / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0, 122, 255, 0.06)";
    ctx.fillRect(startX, startY + hRow * cellHeight, totalGridWidth, cellHeight);
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0, 122, 255, 0.5)";
    ctx.beginPath();
    ctx.moveTo(startX, hy);
    ctx.lineTo(startX + totalGridWidth, hy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  const summaryRowData = options.summaryRow;
  if (summaryRowData.length > 0) {
    const rowGap = 8;
    const summaryRowY = startY + rows.length * cellHeight + rowGap;
    let rowAbsMax = 0;
    for (const v of summaryRowData) {
      if (Number.isFinite(v)) rowAbsMax = Math.max(rowAbsMax, Math.abs(v));
    }
    for (let col = 0; col < columns.length && col < summaryRowData.length; col++) {
      const value = summaryRowData[col];
      const cw = c.colW(col);
      const x = startX + c.colX(col);
      const norm = rowAbsMax > 0 ? clamp(value / rowAbsMax, -1, 1) : 0;
      const color = getHeatmapColor(norm);
      ctx.fillStyle = color;
      traceRoundRect(ctx, x + gap, summaryRowY + gap, cw - gap * 2, cellHeight - gap * 2, rad);
      ctx.fill();
      if (options.summaryRowShowValues) {
        ctx.fillStyle = getTextColorForNormalized(norm);
        ctx.font = CHART_FONTS.axisSemibold;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(formatCompactValue(value), x + cw / 2, summaryRowY + cellHeight / 2);
      }
    }
  }

  const summary = options.summaryColumn;
  if (summary.length > 0 && options.drawSummaryColumn) {
    const gapWidth = 8;
    const summaryX = startX + totalGridWidth + gapWidth;
    ctx.fillStyle = CHART_COLORS.textSecondary;
    ctx.font = CHART_FONTS.heatmap;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(options.summaryColumnLabel, summaryX + cellWidth / 2, startY - 6);
    let sumAbsMax = 0;
    for (const v of summary) {
      if (Number.isFinite(v)) sumAbsMax = Math.max(sumAbsMax, Math.abs(v));
    }
    for (let row = 0; row < rows.length && row < summary.length; row++) {
      const value = summary[row];
      const x = summaryX;
      const y = startY + row * cellHeight;
      const norm = sumAbsMax > 0 ? clamp(value / sumAbsMax, -1, 1) : 0;
      const color = getHeatmapColor(norm);
      ctx.fillStyle = color;
      traceRoundRect(ctx, x + gap, y + gap, cellWidth - gap * 2, cellHeight - gap * 2, rad);
      ctx.fill();
      ctx.fillStyle = getTextColorForNormalized(norm);
      ctx.font = CHART_FONTS.heatmap;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const displayValue =
        Math.abs(value) > 1000
          ? formatCompactValue(value)
          : options.valueFormatter(value);
      ctx.fillText(displayValue, x + cellWidth / 2, y + cellHeight / 2);
    }
  }

  c.drawSpotLine(startX, startY);

  if (options.drawRowLabels) {
    ctx.fillStyle = CHART_COLORS.textPrimary;
    ctx.font = CHART_FONTS.rowLabel;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let row = 0; row < rows.length; row++) {
      const y = startY + row * cellHeight + cellHeight / 2;
      ctx.fillText(rows[row], startX - 10, y);
    }
  }

  if (options.showColorScale) {
    c.drawColorScale();
  }

  c.setBaseImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
  ctx.restore();
  c.renderHoverOnly();
}
