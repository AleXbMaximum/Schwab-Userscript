// Shared canvas drawing utilities for GEX / OI heatmap side-panels.

import { CHART_COLORS, CHART_FONTS, getHeatmapColor } from "frontend/charts/ChartTheme";
import { setupCanvas, traceRoundRect } from "frontend/charts/ChartUtils";
import { clamp } from "shared/utils/math/numeric";

// ── Layout constants ──

export const COL_HEADER_HEIGHT = 50;
export const CELL_HEIGHT = 24;
export const CELL_WIDTH = 50;
export const TIME_LABEL_WIDTH = 70;
export const SUMMARY_GAP = 8;
export const CELL_GAP = 1;
export const CELL_RADIUS = 2;
export const RANGE_SLIDER_STEPS = 400;

// ── Canvas primitives ──

function setupCanvas2D(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  const ctx = setupCanvas(canvas, width, height);
  if (!ctx)
    throw new Error("Could not create 2D canvas context for heatmap");
  return ctx;
}

export function auxCanvasHeight(
  rowCount: number,
  hasSummaryRow: boolean,
): number {
  const summaryRowExtra = hasSummaryRow ? CELL_HEIGHT + SUMMARY_GAP : 0;
  return rowCount * CELL_HEIGHT + COL_HEADER_HEIGHT + summaryRowExtra + 30 + 15;
}

export function computeProportionalWidths(
  timeLabels: string[],
  availableWidth: number,
  minCellWidth: number = 20,
): number[] {
  if (timeLabels.length <= 1) return timeLabels.map(() => availableWidth);

  const minutes = timeLabels.map((t) => {
    const parts = t.split(":");
    return Number(parts[0]) * 60 + Number(parts[1] ?? 0);
  });

  const intervals: number[] = [];
  for (let i = 0; i < minutes.length - 1; i++) {
    intervals.push(Math.max(minutes[i + 1] - minutes[i], 1));
  }
  intervals.push(intervals[intervals.length - 1]);

  const totalInterval = intervals.reduce((s, v) => s + v, 0);

  let widths = intervals.map((iv) =>
    Math.max((iv / totalInterval) * availableWidth, minCellWidth),
  );

  const sum = widths.reduce((s, v) => s + v, 0);
  widths = widths.map((w) => (w / sum) * availableWidth);

  return widths;
}

// ── Side-panel drawing ──

export function drawRowLabels(
  canvas: HTMLCanvasElement,
  labels: string[],
  rowCount: number,
  atmRow?: number,
  hasSummaryRow?: boolean,
): void {
  const width = TIME_LABEL_WIDTH;
  const height = auxCanvasHeight(rowCount, !!hasSummaryRow);
  const ctx = setupCanvas2D(canvas, width, height);

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i < rowCount && i < labels.length; i++) {
    const y = COL_HEADER_HEIGHT + i * CELL_HEIGHT + CELL_HEIGHT / 2;
    if (i === atmRow) {
      ctx.fillStyle = CHART_COLORS.info;
      ctx.font = CHART_FONTS.heatmapBold;
    } else {
      ctx.fillStyle = CHART_COLORS.textPrimary;
      ctx.font = CHART_FONTS.heatmapLight;
    }
    ctx.fillText(labels[i], width - 10, y);
  }

  if (hasSummaryRow) {
    const summaryY =
      COL_HEADER_HEIGHT +
      rowCount * CELL_HEIGHT +
      SUMMARY_GAP +
      CELL_HEIGHT / 2;
    ctx.fillStyle = CHART_COLORS.textSecondary;
    ctx.font = CHART_FONTS.heatmap;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("\u03A3", width - 10, summaryY);
  }
}

export function drawSummaryColumn(
  canvas: HTMLCanvasElement,
  summary: number[],
  rowCount: number,
  cellWidth: number,
  formatValue: (v: number) => string,
  grandTotal?: number,
): void {
  const width = cellWidth + SUMMARY_GAP;
  const hasSummaryRow = grandTotal != null;
  const height = auxCanvasHeight(rowCount, hasSummaryRow);
  const ctx = setupCanvas2D(canvas, width, height);

  const startX = SUMMARY_GAP;

  ctx.fillStyle = CHART_COLORS.textSecondary;
  ctx.font = CHART_FONTS.axisSemibold;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("\u03A3", startX + cellWidth / 2, COL_HEADER_HEIGHT - 6);

  let absMax = 0;
  for (const v of summary) {
    if (isFinite(v)) absMax = Math.max(absMax, Math.abs(v));
  }

  for (let i = 0; i < rowCount && i < summary.length; i++) {
    const value = summary[i];
    const y = COL_HEADER_HEIGHT + i * CELL_HEIGHT;
    const norm = absMax > 0 ? clamp(value / absMax, -1, 1) : 0;
    const color = getHeatmapColor(norm);

    ctx.fillStyle = color;
    traceRoundRect(
      ctx,
      startX + CELL_GAP,
      y + CELL_GAP,
      cellWidth - CELL_GAP * 2,
      CELL_HEIGHT - CELL_GAP * 2,
      CELL_RADIUS,
    );
    ctx.fill();

    const brightness = Math.abs(norm);
    ctx.fillStyle = brightness > 0.5 ? "#fff" : "#000";
    ctx.font = CHART_FONTS.axisSemibold;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      formatValue(value),
      startX + cellWidth / 2,
      y + CELL_HEIGHT / 2,
    );
  }

  if (hasSummaryRow) {
    const summaryY = COL_HEADER_HEIGHT + rowCount * CELL_HEIGHT + SUMMARY_GAP;
    ctx.fillStyle = "#e8e8ed";
    traceRoundRect(
      ctx,
      startX + CELL_GAP,
      summaryY + CELL_GAP,
      cellWidth - CELL_GAP * 2,
      CELL_HEIGHT - CELL_GAP * 2,
      CELL_RADIUS,
    );
    ctx.fill();

    ctx.fillStyle = CHART_COLORS.textPrimary;
    ctx.font = CHART_FONTS.axisBold;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      formatValue(grandTotal),
      startX + cellWidth / 2,
      summaryY + CELL_HEIGHT / 2,
    );
  }
}
