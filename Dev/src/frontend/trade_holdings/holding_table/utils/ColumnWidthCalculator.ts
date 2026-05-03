import type { HoldingsTableColumnId } from "../../../../shared/types/holdingsTableColumns";

export interface ColumnWidthConfig {
  columnIds: HoldingsTableColumnId[];
  colElements: HTMLTableColElement[];
  headerRow: HTMLTableRowElement;
  tbody: HTMLTableSectionElement;
  onWidthsApplied?: () => void;
}

export class ColumnWidthCalculator {
  private canvas: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D | null;
  private static readonly CACHE_GENERATION_LIMIT = 10_000;
  private static readonly STYLE_CACHE_TTL_MS = 1_000;
  private cacheCurrent = new Map<string, number>();
  private cachePrevious = new Map<string, number>();
  private maxTextWidths: number[];
  /** Symbol column tracks the full cell width (text + own padX + inline
   *  extras) per frame; reset at the start of each reconcile so it can
   *  shrink when expanded children collapse. */
  private maxSymbolCellWidth = 0;
  private isDirty = false;
  private rafId: number | null = null;
  private measureFont = "12px Arial";
  private lastFontKey = this.measureFont;
  private samplePaddingX = 20;
  private styleCacheSample: HTMLElement | null = null;
  private styleCacheAt = 0;

  /** Symbol-column-specific metrics, sampled separately for parent vs
   *  child rows so child measurement uses its actual `font-size: 0.9em`
   *  and `padding-left: 36px` instead of being approximated. */
  private parentSymbolFont = "12px Arial";
  private childSymbolFont = "12px Arial";
  private parentSymbolPadX = 20;
  private childSymbolPadX = 20;
  private symbolMetricsAt = 0;

  private readonly config: ColumnWidthConfig;
  private readonly columnCount: number;
  private readonly symbolColumnIndex: number;

  constructor(config: ColumnWidthConfig) {
    this.config = config;
    this.columnCount = config.columnIds.length;
    this.maxTextWidths = new Array(this.columnCount).fill(0);
    this.symbolColumnIndex = config.columnIds.indexOf("symbol");

    this.canvas = document.createElement("canvas");
    this.canvasCtx = this.canvas.getContext("2d");
  }

  private resolveSampleCell(): HTMLElement | null {
    const bodySample = this.config.tbody.rows[0]?.cells?.[0] as
      | HTMLElement
      | undefined;
    const headSample = this.config.headerRow.cells[0] as
      | HTMLElement
      | undefined;
    return bodySample ?? headSample ?? null;
  }

  private refreshStyleMetrics(force = false): void {
    const sample = this.resolveSampleCell();
    if (!sample) return;

    const now = performance.now();
    const cacheStillValid =
      !force &&
      this.styleCacheSample === sample &&
      now - this.styleCacheAt < ColumnWidthCalculator.STYLE_CACHE_TTL_MS;
    if (cacheStillValid) return;

    const style = window.getComputedStyle(sample);
    const nextFont =
      style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const nextPaddingX =
      parseFloat(style.paddingLeft || "0") +
      parseFloat(style.paddingRight || "0");

    this.styleCacheSample = sample;
    this.styleCacheAt = now;
    this.samplePaddingX = Number.isFinite(nextPaddingX) ? nextPaddingX : 20;

    if (nextFont !== this.lastFontKey) {
      this.lastFontKey = nextFont;
      this.measureFont = nextFont;
      this.cacheCurrent.clear();
      this.cachePrevious.clear();
    }
  }

  private getMeasureFont(): string {
    this.refreshStyleMetrics();
    return this.measureFont;
  }

  /** Sample real parent and (if expanded) child symbol cells to capture
   *  their actual font and padding. Falls back to parent metrics when no
   *  child row is present. */
  private refreshSymbolMetrics(force = false): void {
    if (this.symbolColumnIndex < 0) return;
    const now = performance.now();
    if (
      !force &&
      now - this.symbolMetricsAt < ColumnWidthCalculator.STYLE_CACHE_TTL_MS
    ) {
      return;
    }

    let parentCell: HTMLElement | null = null;
    let childCell: HTMLElement | null = null;
    const tbody = this.config.tbody;
    const rowCount = tbody.rows.length;
    for (let i = 0; i < rowCount; i++) {
      const row = tbody.rows[i];
      const cell = row.cells[this.symbolColumnIndex] as HTMLElement | undefined;
      if (!cell) continue;
      if (row.classList.contains("table-row--child")) {
        if (!childCell) childCell = cell;
      } else if (!parentCell) {
        parentCell = cell;
      }
      if (parentCell && childCell) break;
    }
    if (!parentCell) {
      const headSample = this.config.headerRow.cells[
        this.symbolColumnIndex
      ] as HTMLElement | undefined;
      if (headSample) parentCell = headSample;
    }

    const fontFromStyle = (s: CSSStyleDeclaration): string =>
      s.font || `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const padFromStyle = (s: CSSStyleDeclaration): number => {
      const v =
        parseFloat(s.paddingLeft || "0") + parseFloat(s.paddingRight || "0");
      return Number.isFinite(v) ? v : 0;
    };

    if (parentCell) {
      const s = window.getComputedStyle(parentCell);
      this.parentSymbolFont = fontFromStyle(s);
      this.parentSymbolPadX = padFromStyle(s);
    }
    if (childCell) {
      const s = window.getComputedStyle(childCell);
      this.childSymbolFont = fontFromStyle(s);
      this.childSymbolPadX = padFromStyle(s);
    } else {
      this.childSymbolFont = this.parentSymbolFont;
      this.childSymbolPadX = this.parentSymbolPadX;
    }

    this.symbolMetricsAt = now;
  }

  measureText(text: string, font?: string): number {
    const measureFont = font ?? this.getMeasureFont();
    const safeText = text ?? "";
    const key = measureFont + "|" + safeText;

    const cachedCurrent = this.cacheCurrent.get(key);
    if (cachedCurrent != null) return cachedCurrent;

    const cachedPrevious = this.cachePrevious.get(key);
    if (cachedPrevious != null) {
      this.cacheCurrent.set(key, cachedPrevious);
      return cachedPrevious;
    }

    if (!this.canvasCtx) return safeText.length * 8;

    this.canvasCtx.font = measureFont;
    const w = this.canvasCtx.measureText(safeText).width;
    this.cacheCurrent.set(key, w);

    if (this.cacheCurrent.size > ColumnWidthCalculator.CACHE_GENERATION_LIMIT) {
      this.cachePrevious = this.cacheCurrent;
      this.cacheCurrent = new Map<string, number>();
    }

    return w;
  }

  /** Compute the full symbol-cell width for a single row: text width at
   *  the row's actual font size, plus the row's own horizontal padding,
   *  plus any inline extras (used by summary rows to reserve room for
   *  the sparkline and badge slots). */
  measureSymbolCellTotalPx(
    text: string,
    isChild: boolean,
    extraInlinePx = 0,
  ): number {
    this.refreshSymbolMetrics();
    const font = isChild ? this.childSymbolFont : this.parentSymbolFont;
    const padX = isChild ? this.childSymbolPadX : this.parentSymbolPadX;
    const safeExtra = Number.isFinite(extraInlinePx)
      ? Math.max(0, extraInlinePx)
      : 0;
    return this.measureText(text, font) + padX + safeExtra;
  }

  recordSymbolCellWidth(px: number): void {
    if (!Number.isFinite(px) || px <= 0) return;
    if (px > this.maxSymbolCellWidth) {
      this.maxSymbolCellWidth = px;
      this.markDirty();
    }
  }

  /** Clear the symbol-column accumulator at the start of each reconcile
   *  so widening from a transient expansion can be undone on collapse. */
  resetSymbolColumnWidth(): void {
    if (this.maxSymbolCellWidth !== 0) {
      this.maxSymbolCellWidth = 0;
      this.markDirty();
    }
  }

  updateColumnWidth(columnIndex: number, text: string): void {
    if (columnIndex === this.symbolColumnIndex) return;
    const font = this.getMeasureFont();
    const width = this.measureText(text, font);
    if (width > this.maxTextWidths[columnIndex]) {
      this.maxTextWidths[columnIndex] = width;
      this.markDirty();
    }
  }

  updateWidthsForRow(values: string[]): void {
    const font = this.getMeasureFont();

    for (let i = 0; i < Math.min(values.length, this.columnCount); i++) {
      if (i === this.symbolColumnIndex) continue;
      const width = this.measureText(values[i] ?? "", font);
      if (width > this.maxTextWidths[i]) {
        this.maxTextWidths[i] = width;
        this.isDirty = true;
      }
    }

    if (this.isDirty) {
      this.scheduleReflow();
    }
  }

  private markDirty(): void {
    this.isDirty = true;
    this.scheduleReflow();
  }

  private scheduleReflow(): void {
    if (this.rafId !== null) return;

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (this.isDirty) {
        this.applyWidths();
        this.isDirty = false;
      }
    });
  }

  private applyWidths(): void {
    this.refreshStyleMetrics(true);
    const padX = this.samplePaddingX;

    for (let i = 0; i < this.columnCount; i++) {
      const col = this.config.colElements[i];
      if (!col) continue;
      if (i === this.symbolColumnIndex) {
        if (this.maxSymbolCellWidth > 0) {
          col.style.width = `${Math.ceil(this.maxSymbolCellWidth + 2)}px`;
        } else {
          col.style.width = "";
        }
        continue;
      }
      const w = this.maxTextWidths[i];
      col.style.width = `${Math.ceil(w + padX + 2)}px`;
    }

    const spacerCol = this.config.colElements[this.columnCount];
    if (spacerCol) {
      spacerCol.style.width = "";
    }

    this.config.onWidthsApplied?.();
  }

  forceReflow(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.applyWidths();
    this.isDirty = false;
  }

  reset(): void {
    this.maxTextWidths = new Array(this.columnCount).fill(0);
    this.maxSymbolCellWidth = 0;
    this.isDirty = true;
    this.cacheCurrent.clear();
    this.cachePrevious.clear();
    this.measureFont = "12px Arial";
    this.lastFontKey = "";
    this.samplePaddingX = 20;
    this.styleCacheSample = null;
    this.styleCacheAt = 0;
    this.parentSymbolFont = "12px Arial";
    this.childSymbolFont = "12px Arial";
    this.parentSymbolPadX = 20;
    this.childSymbolPadX = 20;
    this.symbolMetricsAt = 0;
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  getMaxWidths(): readonly number[] {
    return this.maxTextWidths;
  }
}
