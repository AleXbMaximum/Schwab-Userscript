import { CHART_COLORS } from "../ChartTheme";
import { isDarkTheme } from "frontend/components/core/axTheme/controller";
import { withShadow } from "frontend/components/core/axTheme/renderMode/canvasShadow";
import {
  formatCompactDollar,
  formatCurrencyLocale,
  formatPct,
} from "shared/utils/format/formatters";
import { createTooltipHost } from "shared/utils/dom/tooltipHost";
import type { HeatmapOptions, HeatmapChartHandle } from "./HeatmapTypes";
import {
  interpolateSpotX,
  interpolateSpotY,
  traceRoundRect,
} from "./heatmapInterpolation";
import {
  renderHeatmap,
  HEATMAP_CELL_GAP,
  HEATMAP_CELL_RADIUS,
} from "./heatmapRenderer";
import {
  drawColorScale as drawColorScaleDecoration,
  drawSpotLine as drawSpotLineDecoration,
} from "./heatmapDecorations";

export function createHeatmapChart(opts: HeatmapOptions): HeatmapChartHandle {
  return new HeatmapChart(opts);
}

class HeatmapChart implements HeatmapChartHandle {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: Required<HeatmapOptions>;
  private hoveredCell: { row: number; col: number } | null = null;
  private hoveredSummaryCol: number | null = null;
  private tooltipHost: HTMLElement | null = null;
  private tooltip: HTMLDivElement | null = null;
  private minValue: number = 0;
  private maxValue: number = 0;
  private animationProgress: number = 1;
  private animationId: number | null = null;

  // Performance: cached base image for fast hover restore
  private baseImageData: ImageData | null = null;
  private hoverRafId: number | null = null;

  // Variable column width support
  private colOffsets: number[] = [];
  private colWidths: number[] = [];
  private totalGridWidth: number = 0;

  public get colHeaderHeight(): number {
    return this.options.rotateColumnLabels ? 90 : 50;
  }
  // Theme-aware grid background — getter so each draw resolves the current theme.
  private get gridBg(): string {
    return isDarkTheme() ? "rgba(255, 255, 255, 0.035)" : "rgba(0, 0, 0, 0.035)";
  }

  public get cellHeight(): number {
    return this.options.cellHeight;
  }
  public get cellWidth(): number {
    return this.options.cellWidth;
  }

  /** Extra vertical space reserved for a top-positioned color scale (bar + labels). */
  private get colorScaleTopH(): number {
    return this.options.showColorScale &&
      this.options.colorScalePosition === "top"
      ? 34
      : 0;
  }

  /** Y offset where the grid (cells) begins, accounting for column headers and top color scale. */
  private get gridStartY(): number {
    return this.colHeaderHeight + this.colorScaleTopH;
  }

  private get rowLabelW(): number {
    return this.options.drawRowLabels ? 80 : 0;
  }

  /** Left edge of a column relative to the grid start (startX). */
  private colX(col: number): number {
    return this.colOffsets[col] ?? 0;
  }

  /** Effective pixel width of a column. */
  private colW(col: number): number {
    return this.colWidths[col] ?? this.options.cellWidth;
  }

  /** Recompute per-column widths and cumulative offsets. */
  private computeColumnLayout(): void {
    const { columns, cellWidth, columnWidths } = this.options;
    if (columnWidths && columnWidths.length === columns.length) {
      this.colWidths = columnWidths;
    } else {
      this.colWidths = columns.map(() => cellWidth);
    }

    this.colOffsets = [];
    let offset = 0;
    for (let i = 0; i < this.colWidths.length; i++) {
      this.colOffsets.push(offset);
      offset += this.colWidths[i];
    }
    this.totalGridWidth = offset;
  }

  constructor(options: HeatmapOptions) {
    this.canvas = options.canvas;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get 2D context from canvas");
    }
    this.ctx = ctx;

    this.options = {
      ...options,
      title: options.title || "",
      valueFormatter:
        options.valueFormatter || ((v) => formatCurrencyLocale(v, 0)),
      showValues: options.showValues ?? true,
      cellWidth: options.cellWidth || 80,
      cellHeight: options.cellHeight || 50,
      padding: options.padding || 60,
      colorScale: options.colorScale || "diverging",
      highlightCol: options.highlightCol ?? -1,
      highlightColLabel: options.highlightColLabel ?? "ATM",
      summaryColumn: options.summaryColumn ?? [],
      summaryColumnLabel: options.summaryColumnLabel ?? "\u03A3",
      summaryRow: options.summaryRow ?? [],
      drawRowLabels: options.drawRowLabels ?? true,
      drawSummaryColumn: options.drawSummaryColumn ?? true,
      spotPrices: options.spotPrices ?? [],
      columnNumericValues: options.columnNumericValues ?? [],
      rowNumericValues: options.rowNumericValues ?? [],
      highlightRow: options.highlightRow ?? -1,
      highlightRowLabel: options.highlightRowLabel ?? "ATM",
      showColorScale: options.showColorScale ?? true,
      colorScalePosition: options.colorScalePosition ?? "bottom",
      colorRangeMin: options.colorRangeMin,
      colorRangeMax: options.colorRangeMax,
      tooltipFormatter: options.tooltipFormatter,
      summaryRowShowValues: options.summaryRowShowValues ?? true,
      columnWidths: options.columnWidths,
      squareCells: options.squareCells ?? false,
      rotateColumnLabels: options.rotateColumnLabels ?? false,
    };

    this.calculateMinMax();
    this.computeColumnLayout();

    this.setupCanvas();

    this.setupInteractivity();

    this.render();
  }

  private calculateMinMax(): void {
    let min = Infinity;
    let max = -Infinity;

    for (const row of this.options.data) {
      for (const value of row) {
        if (isFinite(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
    }

    this.minValue = min;
    this.maxValue = max;
  }

  private setupCanvas(): void {
    const { rows, columns, cellHeight } = this.options;

    const hasSummary =
      this.options.summaryColumn.length > 0 && this.options.drawSummaryColumn;
    const rowLabelWidth = this.rowLabelW;
    const hasVariableWidths =
      this.options.columnWidths &&
      this.options.columnWidths.length === columns.length;

    if (!hasVariableWidths) {
      if (!this.options.squareCells) {
        const parentWidth = this.canvas.parentElement?.clientWidth;
        if (parentWidth && parentWidth > 0) {
          const availableWidth = parentWidth - 20;
          const totalCols = columns.length + (hasSummary ? 1 : 0);
          const computedCellWidth = Math.floor(
            (availableWidth - rowLabelWidth - 10) / totalCols,
          );
          (this.options as any).cellWidth = Math.max(
            40,
            Math.min(computedCellWidth, 120),
          );
        }
      }
      this.computeColumnLayout();
    }

    const colHeaderHeight = this.colHeaderHeight;
    const topScaleH = this.colorScaleTopH;
    const bottomLegendH =
      this.options.showColorScale && this.options.colorScalePosition !== "top"
        ? 30
        : 0;
    const summaryWidth = hasSummary ? this.options.cellWidth + 8 : 0;
    const hasSummaryRow = this.options.summaryRow.length > 0;
    const summaryRowExtra = hasSummaryRow ? cellHeight + 8 : 0;
    const width = this.totalGridWidth + rowLabelWidth + summaryWidth + 20;
    const height =
      topScaleH +
      rows.length * cellHeight +
      colHeaderHeight +
      summaryRowExtra +
      bottomLegendH +
      15;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);
  }

  private setupInteractivity(): void {
    this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
    this.canvas.addEventListener("mouseleave", this.onMouseLeave.bind(this));
    this.canvas.style.cursor = "default";

    const { host, tooltip } = createTooltipHost();
    this.tooltipHost = host;
    this.tooltip = tooltip;
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const cell = this.getCellAtPosition(x, y);

    if (cell) {
      this.hoveredCell = cell;
      this.hoveredSummaryCol = null;
      this.canvas.style.cursor = "pointer";
      this.showTooltip(event.clientX, event.clientY, cell);
      this.scheduleHoverRender();
    } else if (
      !this.options.summaryRowShowValues &&
      this.options.summaryRow.length > 0
    ) {
      const summaryCol = this.getSummaryRowCellAtPosition(x, y);
      if (summaryCol != null) {
        this.hoveredCell = null;
        this.hoveredSummaryCol = summaryCol;
        this.canvas.style.cursor = "pointer";
        this.showSummaryRowTooltip(event.clientX, event.clientY, summaryCol);
        this.scheduleHoverRender();
      } else {
        this.clearHover();
      }
    } else {
      this.clearHover();
    }
  }

  private onMouseLeave(): void {
    this.clearHover();
  }

  private clearHover(): void {
    if (this.hoveredCell || this.hoveredSummaryCol != null) {
      this.hoveredCell = null;
      this.hoveredSummaryCol = null;
      this.canvas.style.cursor = "default";
      this.hideTooltip();
      this.scheduleHoverRender();
    }
  }

  /** rAF-gated hover render: restores base image and draws only hover highlight. */
  private scheduleHoverRender(): void {
    if (this.hoverRafId != null) cancelAnimationFrame(this.hoverRafId);
    this.hoverRafId = requestAnimationFrame(() => {
      this.hoverRafId = null;
      this.renderHoverOnly();
    });
  }

  /** Restore cached base image and draw only hover cell highlight (no full redraw). */
  private renderHoverOnly(): void {
    if (!this.baseImageData) {
      this.render();
      return;
    }
    this.ctx.putImageData(this.baseImageData, 0, 0);

    const dpr = window.devicePixelRatio || 1;
    this.ctx.save();
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { cellHeight } = this.options;
    const startX = this.rowLabelW;
    const startY = this.gridStartY;
    const gap = HEATMAP_CELL_GAP;
    const rad = HEATMAP_CELL_RADIUS;

    if (this.hoveredCell) {
      const { row, col } = this.hoveredCell;
      const cw = this.colW(col);
      const x = startX + this.colX(col);
      const y = startY + row * cellHeight;
      withShadow(
        this.ctx,
        { color: "rgba(0, 0, 0, 0.4)", blur: 8 },
        () => {
          this.ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
          this.ctx.lineWidth = 2;
          this.traceRoundRect(
            x + gap,
            y + gap,
            cw - gap * 2,
            cellHeight - gap * 2,
            rad,
          );
          this.ctx.stroke();
        },
      );
    }

    if (this.hoveredSummaryCol != null) {
      const col = this.hoveredSummaryCol;
      const cw = this.colW(col);
      const x = startX + this.colX(col);
      const summaryRowY = startY + this.options.rows.length * cellHeight + 8;
      withShadow(
        this.ctx,
        { color: "rgba(0, 0, 0, 0.4)", blur: 8 },
        () => {
          this.ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
          this.ctx.lineWidth = 2;
          this.traceRoundRect(
            x + gap,
            summaryRowY + gap,
            cw - gap * 2,
            cellHeight - gap * 2,
            rad,
          );
          this.ctx.stroke();
        },
      );
    }

    this.ctx.restore();
  }

  private findColAtX(relX: number): number {
    let lo = 0;
    let hi = this.colOffsets.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (relX < this.colOffsets[mid]) {
        hi = mid - 1;
      } else if (relX >= this.colOffsets[mid] + this.colWidths[mid]) {
        lo = mid + 1;
      } else {
        return mid;
      }
    }
    return -1;
  }

  private getCellAtPosition(
    x: number,
    y: number,
  ): { row: number; col: number } | null {
    const { rows, columns, cellHeight } = this.options;

    const startX = this.rowLabelW;
    const startY = this.gridStartY;

    if (x < startX || y < startY) return null;

    const col = this.findColAtX(x - startX);
    const row = Math.floor((y - startY) / cellHeight);

    if (row >= 0 && row < rows.length && col >= 0 && col < columns.length) {
      return { row, col };
    }

    return null;
  }

  private getSummaryRowCellAtPosition(x: number, y: number): number | null {
    const { columns, cellHeight, rows } = this.options;
    const startX = this.rowLabelW;
    const summaryRowY = this.gridStartY + rows.length * cellHeight + 8;

    if (y < summaryRowY || y > summaryRowY + cellHeight) return null;
    if (x < startX) return null;

    const col = this.findColAtX(x - startX);
    if (
      col >= 0 &&
      col < columns.length &&
      col < this.options.summaryRow.length
    ) {
      return col;
    }
    return null;
  }

  private positionTooltip(clientX: number, clientY: number): void {
    if (!this.tooltip) return;
    const tooltipRect = this.tooltip.getBoundingClientRect();
    let left = clientX + 10;
    let top = clientY + 10;

    if (left + tooltipRect.width > window.innerWidth) {
      left = clientX - tooltipRect.width - 10;
    }
    if (top + tooltipRect.height > window.innerHeight) {
      top = clientY - tooltipRect.height - 10;
    }

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.display = "block";
  }

  private showTooltip(
    x: number,
    y: number,
    cell: { row: number; col: number },
  ): void {
    if (!this.tooltip) return;

    const { rows, columns, valueFormatter, tooltipFormatter } = this.options;
    const value = this.options.data[cell.row][cell.col];

    const rowLabel = rows[cell.row];
    const colLabel = columns[cell.col];

    if (tooltipFormatter) {
      this.tooltip.innerHTML = tooltipFormatter(rowLabel, colLabel, value);
    } else {
      this.tooltip.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 4px;">${rowLabel} × ${colLabel}</div>
                <div style="color: ${value >= 0 ? CHART_COLORS.success : CHART_COLORS.danger};">
                    Expected P&L: ${valueFormatter(value)}
                </div>
                <div style="font-size: 11px; color: ${CHART_COLORS.textSecondary}; margin-top: 4px;">
                    ${formatPct(this.maxValue > 0 ? value / this.maxValue : 0)} of max scenario
                </div>
            `;
    }

    this.positionTooltip(x, y);
  }

  private showSummaryRowTooltip(
    clientX: number,
    clientY: number,
    col: number,
  ): void {
    if (!this.tooltip) return;
    const value = this.options.summaryRow[col];
    const timeLabel = this.options.columns[col];
    this.tooltip.innerHTML =
      `<div style="font-weight: 600; margin-bottom: 2px;">${timeLabel}</div>` +
      `<div>\u03A3 GEX: ${this.formatCompactValue(value)}</div>`;
    this.positionTooltip(clientX, clientY);
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.style.display = "none";
    }
  }

  private render(): void {
    renderHeatmap({
      canvas: this.canvas,
      ctx: this.ctx,
      options: this.options,
      minValue: this.minValue,
      maxValue: this.maxValue,
      totalGridWidth: this.totalGridWidth,
      gridStartY: this.gridStartY,
      rowLabelWidth: this.rowLabelW,
      colX: (col) => this.colX(col),
      colW: (col) => this.colW(col),
      gridBg: this.gridBg,
      setBaseImageData: (data) => {
        this.baseImageData = data;
      },
      renderHoverOnly: () => this.renderHoverOnly(),
      drawSpotLine: (sx, sy) => this.drawSpotLine(sx, sy),
      drawColorScale: () => this.drawColorScale(),
    });
  }

  private formatCompactValue(value: number): string {
    return formatCompactDollar(value, { sign: true });
  }

  private traceRoundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    traceRoundRect(this.ctx, x, y, w, h, r);
  }

  private drawColorScale(): void {
    const { ctx } = this;
    const { rows, cellHeight } = this.options;
    const rowLabelWidth = this.rowLabelW;
    const gridRight = rowLabelWidth + this.totalGridWidth;

    const scaleWidth = Math.min(200, gridRight - rowLabelWidth);
    const scaleHeight = 10;
    const isTop = this.options.colorScalePosition === "top";

    let scaleX: number;
    let scaleY: number;
    if (isTop) {
      scaleX = rowLabelWidth;
      scaleY = 6;
    } else {
      const hasSummaryRow = this.options.summaryRow.length > 0;
      const summaryRowExtra = hasSummaryRow ? cellHeight + 8 : 0;
      const gridBottom =
        this.gridStartY + rows.length * cellHeight + summaryRowExtra;
      scaleX = gridRight - scaleWidth;
      scaleY = gridBottom + 10;
    }

    // Gradient bar
    const gradient = ctx.createLinearGradient(
      scaleX,
      0,
      scaleX + scaleWidth,
      0,
    );
    gradient.addColorStop(0, CHART_COLORS.heatmapScale[0]);
    gradient.addColorStop(0.25, CHART_COLORS.heatmapScale[1]);
    gradient.addColorStop(0.5, CHART_COLORS.heatmapScale[2]);
    gradient.addColorStop(0.75, CHART_COLORS.heatmapScale[3]);
    gradient.addColorStop(1, CHART_COLORS.heatmapScale[4]);

    ctx.fillStyle = gradient;
    this.traceRoundRect(
      scaleX,
      scaleY,
      scaleWidth,
      scaleHeight,
      scaleHeight / 2,
    );
    ctx.fill();

    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 0.5;
    this.traceRoundRect(
      scaleX,
      scaleY,
      scaleWidth,
      scaleHeight,
      scaleHeight / 2,
    );
    ctx.stroke();

    // Value labels
    const rawMin = Number.isFinite(this.options.colorRangeMin)
      ? this.options.colorRangeMin
      : this.minValue;
    const rawMax = Number.isFinite(this.options.colorRangeMax)
      ? this.options.colorRangeMax
      : this.maxValue;
    const labelY = scaleY + scaleHeight + 12;

    ctx.font = CHART_FONTS.labelSmall;
    ctx.fillStyle = CHART_COLORS.textSecondary;

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(this.formatScaleLabel(rawMin), scaleX, labelY);

    ctx.textAlign = "center";
    ctx.fillText("0", scaleX + scaleWidth / 2, labelY);

    ctx.textAlign = "right";
    ctx.fillText(this.formatScaleLabel(rawMax), scaleX + scaleWidth, labelY);
  }

  private formatScaleLabel(value: number): string {
    return formatScaleLabel(value);
  }

  private drawSpotLine(startX: number, startY: number): void {
    const { ctx } = this;
    const spots = this.options.spotPrices;
    const colVals = this.options.columnNumericValues;
    const rowVals = this.options.rowNumericValues;
    const { rows, columns, cellWidth, cellHeight } = this.options;

    if (spots.length === 0) return;

    const pathPoints: { x: number; y: number }[] = [];

    if (rowVals.length > 0) {
      for (let col = 0; col < columns.length && col < spots.length; col++) {
        const spot = spots[col];
        if (!Number.isFinite(spot) || spot <= 0) continue;

        const y = this.interpolateSpotY(spot, rowVals, startY, cellHeight);
        if (y == null) continue;

        pathPoints.push({ x: startX + this.colX(col) + this.colW(col) / 2, y });
      }
    } else if (colVals.length > 0) {
      for (let row = 0; row < rows.length && row < spots.length; row++) {
        const spot = spots[row];
        if (!Number.isFinite(spot) || spot <= 0) continue;

        const x = this.interpolateSpotX(spot, colVals, startX, cellWidth);
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

    // Pass 1: soft glow
    withShadow(
      ctx,
      { color: "rgba(0, 122, 255, 0.45)", blur: 10 },
      () => {
        ctx.beginPath();
        ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
        for (let i = 1; i < pathPoints.length; i++) {
          ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
        }
        ctx.strokeStyle = "rgba(0, 122, 255, 0.25)";
        ctx.lineWidth = 6;
        ctx.stroke();
      },
    );

    // Pass 2: white outline
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Pass 3: main blue line
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    ctx.strokeStyle = CHART_COLORS.info;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dots with glow
    for (const pt of pathPoints) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
      withShadow(
        ctx,
        { color: "rgba(0, 122, 255, 0.5)", blur: 6 },
        () => {
          ctx.fillStyle = CHART_COLORS.info;
          ctx.fill();
        },
      );
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  private interpolateSpotX(
    value: number,
    colValues: number[],
    startX: number,
    _cellWidth: number,
  ): number | null {
    return interpolateSpotX(
      value,
      colValues,
      startX,
      (col) => this.colX(col),
      (col) => this.colW(col),
    );
  }

  private interpolateSpotY(
    value: number,
    rowValues: number[],
    startY: number,
    cellHeight: number,
  ): number | null {
    return interpolateSpotY(value, rowValues, startY, cellHeight);
  }

  public update(
    newData: number[][],
    newRows?: string[],
    newColumns?: string[],
    extra?: {
      highlightCol?: number;
      highlightRow?: number;
      summaryColumn?: number[];
      summaryRow?: number[];
      spotPrices?: number[];
      columnNumericValues?: number[];
      rowNumericValues?: number[];
      colorRangeMin?: number;
      colorRangeMax?: number;
      columnWidths?: number[];
    },
  ): void {
    this.options.data = newData;
    if (newRows) this.options.rows = newRows;
    if (newColumns) this.options.columns = newColumns;
    if (extra) {
      if (extra.highlightCol != null)
        (this.options as any).highlightCol = extra.highlightCol;
      if (extra.highlightRow != null)
        (this.options as any).highlightRow = extra.highlightRow;
      if (extra.summaryColumn)
        (this.options as any).summaryColumn = extra.summaryColumn;
      if (extra.summaryRow) (this.options as any).summaryRow = extra.summaryRow;
      if (extra.spotPrices) (this.options as any).spotPrices = extra.spotPrices;
      if (extra.columnNumericValues)
        (this.options as any).columnNumericValues = extra.columnNumericValues;
      if (extra.rowNumericValues)
        (this.options as any).rowNumericValues = extra.rowNumericValues;
      if ("colorRangeMin" in extra)
        (this.options as any).colorRangeMin = extra.colorRangeMin;
      if ("colorRangeMax" in extra)
        (this.options as any).colorRangeMax = extra.colorRangeMax;
      if (extra.columnWidths)
        (this.options as any).columnWidths = extra.columnWidths;
    }
    this.calculateMinMax();
    this.computeColumnLayout();
    this.setupCanvas();
    this.baseImageData = null;
    this.render();
  }

  public getColumnCenterX(col: number): number {
    if (col < 0 || col >= this.options.columns.length) return 0;
    return this.rowLabelW + this.colX(col) + this.colW(col) / 2;
  }

  public getRowCenterY(row: number): number {
    if (row < 0 || row >= this.options.rows.length) return 0;
    return (
      this.gridStartY +
      row * this.options.cellHeight +
      this.options.cellHeight / 2
    );
  }

  public destroy(): void {
    if (this.tooltipHost && this.tooltipHost.parentNode) {
      this.tooltipHost.parentNode.removeChild(this.tooltipHost);
    }

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.hoverRafId !== null) {
      cancelAnimationFrame(this.hoverRafId);
    }

    this.baseImageData = null;

    this.canvas.removeEventListener("mousemove", this.onMouseMove.bind(this));
    this.canvas.removeEventListener("mouseleave", this.onMouseLeave.bind(this));
  }
}

