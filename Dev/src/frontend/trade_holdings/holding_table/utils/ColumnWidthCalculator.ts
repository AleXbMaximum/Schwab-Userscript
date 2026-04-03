import type { HoldingsTableColumnId } from "../../../../shared/holdingsTableColumns";

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
  private columnExtraWidths: number[];
  private hasChildSymbolIndent = false;
  private isDirty = false;
  private rafId: number | null = null;
  private measureFont = "12px Arial";
  private lastFontKey = this.measureFont;
  private samplePaddingX = 20;
  private styleCacheSample: HTMLElement | null = null;
  private styleCacheAt = 0;

  private readonly config: ColumnWidthConfig;
  private readonly columnCount: number;

  constructor(config: ColumnWidthConfig) {
    this.config = config;
    this.columnCount = config.columnIds.length;
    this.maxTextWidths = new Array(this.columnCount).fill(0);
    this.columnExtraWidths = new Array(this.columnCount).fill(0);

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

  updateColumnWidth(columnIndex: number, text: string): void {
    const font = this.getMeasureFont();
    const width = this.measureText(text, font);
    if (width > this.maxTextWidths[columnIndex]) {
      this.maxTextWidths[columnIndex] = width;
      this.markDirty();
    }
  }

  setColumnExtraWidth(columnIndex: number, extraWidth: number): void {
    if (columnIndex < 0 || columnIndex >= this.columnCount) return;
    if (!Number.isFinite(extraWidth)) return;
    const safeExtra = Math.max(0, extraWidth);
    if (safeExtra !== this.columnExtraWidths[columnIndex]) {
      this.columnExtraWidths[columnIndex] = safeExtra;
      this.markDirty();
    }
  }

  updateWidthsForRow(values: string[]): void {
    const font = this.getMeasureFont();

    for (let i = 0; i < Math.min(values.length, this.columnCount); i++) {
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

  setHasChildSymbolIndent(hasIndent: boolean): void {
    if (hasIndent && !this.hasChildSymbolIndent) {
      this.hasChildSymbolIndent = true;
      this.markDirty();
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
      let w = this.maxTextWidths[i];
      w += this.columnExtraWidths[i] ?? 0;

      if (this.hasChildSymbolIndent && this.config.columnIds[i] === "symbol") {
        w += 30;
      }

      const col = this.config.colElements[i];
      if (col) {
        col.style.width = `${Math.ceil(w + padX + 2)}px`;
      }
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
    this.columnExtraWidths = new Array(this.columnCount).fill(0);
    this.hasChildSymbolIndent = false;
    this.isDirty = true;
    this.cacheCurrent.clear();
    this.cachePrevious.clear();
    this.measureFont = "12px Arial";
    this.lastFontKey = "";
    this.samplePaddingX = 20;
    this.styleCacheSample = null;
    this.styleCacheAt = 0;
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
