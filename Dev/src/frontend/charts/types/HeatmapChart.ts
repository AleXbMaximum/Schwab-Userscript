import { isDarkTheme } from "frontend/components/core/axTheme/controller";
import { withShadow } from "frontend/components/core/axTheme/renderMode/canvasShadow";
import {
  formatCompactDollar,
  formatCurrencyLocale,
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
import {
  positionHeatmapTooltip,
  showCellTooltip,
  showSummaryRowTooltipImpl,
  hideHeatmapTooltip,
} from "./heatmapTooltip";

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
          traceRoundRect(
            this.ctx,
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
          traceRoundRect(
            this.ctx,
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
    if (this.tooltip) positionHeatmapTooltip(this.tooltip, clientX, clientY);
  }

  private showTooltip(
    x: number,
    y: number,
    cell: { row: number; col: number },
  ): void {
    showCellTooltip(this.tooltip, this.options, this.maxValue, x, y, cell);
  }

  private showSummaryRowTooltip(
    clientX: number,
    clientY: number,
    col: number,
  ): void {
    showSummaryRowTooltipImpl(
      this.tooltip,
      this.options,
      (v) => formatCompactDollar(v, { sign: true }),
      clientX,
      clientY,
      col,
    );
  }

  private hideTooltip(): void {
    hideHeatmapTooltip(this.tooltip);
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

  private drawColorScale(): void {
    drawColorScaleDecoration({
      ctx: this.ctx,
      options: this.options,
      minValue: this.minValue,
      maxValue: this.maxValue,
      rowLabelWidth: this.rowLabelW,
      totalGridWidth: this.totalGridWidth,
      gridStartY: this.gridStartY,
    });
  }

  private drawSpotLine(startX: number, startY: number): void {
    drawSpotLineDecoration({
      ctx: this.ctx,
      options: this.options,
      startX,
      startY,
      colX: (col) => this.colX(col),
      colW: (col) => this.colW(col),
      interpolateSpotX: (value, colValues, sx, _cw) =>
        interpolateSpotX(
          value,
          colValues,
          sx,
          (col) => this.colX(col),
          (col) => this.colW(col),
        ),
      interpolateSpotY: (value, rowValues, sy, ch) =>
        interpolateSpotY(value, rowValues, sy, ch),
    });
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

