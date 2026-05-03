import { CHART_COLORS, CHART_FONTS } from "../ChartTheme";
import { withShadow } from "frontend/components/core/axTheme/renderMode/canvasShadow";
import { traceRoundRect, formatScaleLabel } from "./heatmapInterpolation";
import type { HeatmapOptions } from "./HeatmapTypes";

export type ColorScaleContext = {
  ctx: CanvasRenderingContext2D;
  options: Required<HeatmapOptions>;
  minValue: number;
  maxValue: number;
  rowLabelWidth: number;
  totalGridWidth: number;
  gridStartY: number;
};

export function drawColorScale(c: ColorScaleContext): void {
  const { ctx, options, minValue, maxValue, rowLabelWidth, totalGridWidth, gridStartY } = c;
  const { rows, cellHeight } = options;
  const gridRight = rowLabelWidth + totalGridWidth;

  const scaleWidth = Math.min(200, gridRight - rowLabelWidth);
  const scaleHeight = 10;
  const isTop = options.colorScalePosition === "top";

  let scaleX: number;
  let scaleY: number;
  if (isTop) {
    scaleX = rowLabelWidth;
    scaleY = 6;
  } else {
    const hasSummaryRow = options.summaryRow.length > 0;
    const summaryRowExtra = hasSummaryRow ? cellHeight + 8 : 0;
    const gridBottom = gridStartY + rows.length * cellHeight + summaryRowExtra;
    scaleX = gridRight - scaleWidth;
    scaleY = gridBottom + 10;
  }

  const gradient = ctx.createLinearGradient(scaleX, 0, scaleX + scaleWidth, 0);
  gradient.addColorStop(0, CHART_COLORS.heatmapScale[0]);
  gradient.addColorStop(0.25, CHART_COLORS.heatmapScale[1]);
  gradient.addColorStop(0.5, CHART_COLORS.heatmapScale[2]);
  gradient.addColorStop(0.75, CHART_COLORS.heatmapScale[3]);
  gradient.addColorStop(1, CHART_COLORS.heatmapScale[4]);

  ctx.fillStyle = gradient;
  traceRoundRect(ctx, scaleX, scaleY, scaleWidth, scaleHeight, scaleHeight / 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
  ctx.lineWidth = 0.5;
  traceRoundRect(ctx, scaleX, scaleY, scaleWidth, scaleHeight, scaleHeight / 2);
  ctx.stroke();

  const rawMin = Number.isFinite(options.colorRangeMin)
    ? options.colorRangeMin
    : minValue;
  const rawMax = Number.isFinite(options.colorRangeMax)
    ? options.colorRangeMax
    : maxValue;
  const labelY = scaleY + scaleHeight + 12;

  ctx.font = CHART_FONTS.labelSmall;
  ctx.fillStyle = CHART_COLORS.textSecondary;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(formatScaleLabel(rawMin), scaleX, labelY);

  ctx.textAlign = "center";
  ctx.fillText("0", scaleX + scaleWidth / 2, labelY);

  ctx.textAlign = "right";
  ctx.fillText(formatScaleLabel(rawMax), scaleX + scaleWidth, labelY);
}

export type SpotLineContext = {
  ctx: CanvasRenderingContext2D;
  options: Required<HeatmapOptions>;
  startX: number;
  startY: number;
  colX: (col: number) => number;
  colW: (col: number) => number;
  interpolateSpotX: (
    value: number,
    colValues: number[],
    startX: number,
    cellWidth: number,
  ) => number | null;
  interpolateSpotY: (
    value: number,
    rowValues: number[],
    startY: number,
    cellHeight: number,
  ) => number | null;
};

export function drawSpotLine(c: SpotLineContext): void {
  const { ctx, options, startX, startY, colX, colW } = c;
  const spots = options.spotPrices;
  const colVals = options.columnNumericValues;
  const rowVals = options.rowNumericValues;
  const { rows, columns, cellWidth, cellHeight } = options;

  if (spots.length === 0) return;

  const pathPoints: { x: number; y: number }[] = [];

  if (rowVals.length > 0) {
    for (let col = 0; col < columns.length && col < spots.length; col++) {
      const spot = spots[col];
      if (!Number.isFinite(spot) || spot <= 0) continue;
      const y = c.interpolateSpotY(spot, rowVals, startY, cellHeight);
      if (y == null) continue;
      pathPoints.push({ x: startX + colX(col) + colW(col) / 2, y });
    }
  } else if (colVals.length > 0) {
    for (let row = 0; row < rows.length && row < spots.length; row++) {
      const spot = spots[row];
      if (!Number.isFinite(spot) || spot <= 0) continue;
      const x = c.interpolateSpotX(spot, colVals, startX, cellWidth);
      if (x == null) continue;
      pathPoints.push({ x, y: startY + row * cellHeight + cellHeight / 2 });
    }
  } else {
    return;
  }

  if (pathPoints.length < 2) return;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  withShadow(ctx, { color: "rgba(0, 122, 255, 0.45)", blur: 10 }, () => {
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    ctx.strokeStyle = "rgba(0, 122, 255, 0.25)";
    ctx.lineWidth = 6;
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i++) {
    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i++) {
    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
  }
  ctx.strokeStyle = CHART_COLORS.info;
  ctx.lineWidth = 2;
  ctx.stroke();

  for (const pt of pathPoints) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
    withShadow(ctx, { color: "rgba(0, 122, 255, 0.5)", blur: 6 }, () => {
      ctx.fillStyle = CHART_COLORS.info;
      ctx.fill();
    });
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}
