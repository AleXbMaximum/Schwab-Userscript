import type { HoldingsTableColumnId } from "../../../../shared/types/holdingsTableColumns";
import type { ColumnWidthCalculator } from "../utils/ColumnWidthCalculator";
import type { RowRenderData, TableUpdateContext } from "../types";
import { IntradaySparklineStore } from "./IntradaySparklineStore";
import {
  drawIntradaySparkline,
  SPARKLINE_WIDTH,
} from "./SparklineRenderer";
import type { ChartDataService } from "../../../../backend/core/network/chart/ChartDataService";
import { buildBadgeMeasureText } from "../table/assetBadges";

export { SPARKLINE_WIDTH };

const SUMMARY_TICKER_SLOT_CSS_VAR = "--summary-ticker-slot-width";
const SUMMARY_BADGE_SLOT_CSS_VAR = "--summary-badge-slot-width";
const SYMBOL_INLINE_GAP_PX = 6;
const SUMMARY_TICKER_SLOT_PADDING_PX = 2;
const SUMMARY_BADGE_SLOT_PADDING_PX = 2;

/** Parse a formatted percentage string like "-3.62%" or "+1.28%" to a number. */
const parsePctString = (s: string): number => {
  if (!s || s === "-" || s === "\u2014") return 0;
  const cleaned = s.replace(/[^\d.\-+]/g, "");
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? v : 0;
};

export interface SparklineManagerConfig {
  chartDataService: ChartDataService;
  tbl: HTMLTableElement;
  tbody: HTMLTableSectionElement;
  columnWidthCalculator: ColumnWidthCalculator;
  symbolColumnIndex: number;
}

export class SparklineManager {
  readonly sparklineStore: IntradaySparklineStore;
  private sparklineChangePctMap = new Map<string, number>();
  private prevSparklineChangePctMap = new Map<string, number>();
  private summaryTickerSlotWidthPx = 0;
  private summaryBadgeSlotWidthPx = 0;
  private lastSummaryLayoutRawVersion: number | null = null;

  private readonly tbl: HTMLTableElement;
  private readonly tbody: HTMLTableSectionElement;
  private readonly columnWidthCalculator: ColumnWidthCalculator;
  private readonly symbolColumnIndex: number;

  constructor(config: SparklineManagerConfig) {
    this.tbl = config.tbl;
    this.tbody = config.tbody;
    this.columnWidthCalculator = config.columnWidthCalculator;
    this.symbolColumnIndex = config.symbolColumnIndex;

    this.sparklineStore = new IntradaySparklineStore(config.chartDataService);

    this.sparklineStore.onUpdate((symbol) => {
      const data = this.sparklineStore.get(symbol);
      if (!data || data.prices.length < 2) return;
      const changePct = this.sparklineChangePctMap.get(symbol) ?? 0;
      const canvases = this.tbody.querySelectorAll<HTMLCanvasElement>(
        `canvas[data-sparkline="${CSS.escape(symbol)}"]`,
      );
      for (const canvas of canvases) {
        drawIntradaySparkline(canvas, data.prices, changePct, data.previousClose);
        canvas.setAttribute("data-sparkline-painted", "1");
      }
    });
  }

  shouldRecomputeSummarySymbolLayout(
    changeToken: TableUpdateContext["changeToken"] | undefined,
  ): boolean {
    if (this.summaryTickerSlotWidthPx <= 0 || this.summaryBadgeSlotWidthPx <= 0)
      return true;
    if (!changeToken || !changeToken.fullRebuild) return false;
    return this.lastSummaryLayoutRawVersion !== changeToken.rawVersion;
  }

  computeAndApplySummaryLayout(
    virtualRows: RowRenderData[],
    changeToken: TableUpdateContext["changeToken"] | undefined,
  ): void {
    const nextTickerSlotWidthPx =
      this.computeSummaryTickerSlotWidthPx(virtualRows);
    const nextBadgeSlotWidthPx =
      this.computeSummaryBadgeSlotWidthPx(virtualRows);

    if (nextTickerSlotWidthPx !== this.summaryTickerSlotWidthPx) {
      this.applySummaryTickerSlotWidth(nextTickerSlotWidthPx);
    }
    if (nextBadgeSlotWidthPx !== this.summaryBadgeSlotWidthPx) {
      this.applySummaryBadgeSlotWidth(nextBadgeSlotWidthPx);
    }
    if (changeToken?.fullRebuild) {
      this.lastSummaryLayoutRawVersion = changeToken.rawVersion;
    }
  }

  /** Push the summary-row inline layout (ticker slot + sparkline + badge
   *  slot) as a fixed offset into the symbol-column accumulator. The
   *  reconciler resets that accumulator each frame, so this must run
   *  every reconcile pass even when the slot widths themselves are
   *  unchanged. */
  applySymbolColumnContribution(): void {
    if (this.symbolColumnIndex < 0) return;
    if (this.summaryTickerSlotWidthPx <= 0) return;
    let inlinePx =
      this.summaryTickerSlotWidthPx + SPARKLINE_WIDTH + SYMBOL_INLINE_GAP_PX;
    if (this.summaryBadgeSlotWidthPx > 0) {
      inlinePx += SYMBOL_INLINE_GAP_PX + this.summaryBadgeSlotWidthPx;
    }
    const fullPx = this.columnWidthCalculator.measureSymbolCellTotalPx(
      "",
      false,
      inlinePx,
    );
    this.columnWidthCalculator.recordSymbolCellWidth(fullPx);
  }

  updateSparklines(
    virtualRows: RowRenderData[],
    changeToken: TableUpdateContext["changeToken"] | undefined,
  ): void {
    const isFullRebuild = !!(changeToken && changeToken.fullRebuild);
    const touchedKeys = changeToken?.touchedUnderlyingKeys;
    const symbolsToRepaint = new Set<string>();

    if (isFullRebuild || !touchedKeys) {
      // Full rebuild: recompute entire sparkline change-pct map
      const underlyingSymbols: string[] = [];
      const nextSparklineChangePctMap = new Map<string, number>();
      for (const rd of virtualRows) {
        if (rd.isSummary && rd.linkTarget) {
          underlyingSymbols.push(rd.linkTarget);
          const pctStr =
            rd.values.get("priceChngPct" as HoldingsTableColumnId) ?? "";
          const pct = parsePctString(pctStr);
          nextSparklineChangePctMap.set(rd.linkTarget, pct);
          if (this.prevSparklineChangePctMap.get(rd.linkTarget) !== pct) {
            symbolsToRepaint.add(rd.linkTarget);
          }
        }
      }
      this.sparklineChangePctMap = nextSparklineChangePctMap;
      this.prevSparklineChangePctMap = new Map(nextSparklineChangePctMap);
      if (underlyingSymbols.length > 0) {
        this.sparklineStore.requestSymbols(underlyingSymbols);
      }
    } else {
      // Incremental: only update touched underlying keys
      for (const rd of virtualRows) {
        if (!rd.isSummary || !rd.linkTarget) continue;
        if (!touchedKeys.includes(rd.linkTarget)) continue;
        const pctStr =
          rd.values.get("priceChngPct" as HoldingsTableColumnId) ?? "";
        const pct = parsePctString(pctStr);
        if (this.sparklineChangePctMap.get(rd.linkTarget) !== pct) {
          symbolsToRepaint.add(rd.linkTarget);
        }
        this.sparklineChangePctMap.set(rd.linkTarget, pct);
        this.prevSparklineChangePctMap.set(rd.linkTarget, pct);
      }
      // Still request all known symbols (handles stale re-fetch)
      if (this.sparklineChangePctMap.size > 0) {
        this.sparklineStore.requestSymbols([
          ...this.sparklineChangePctMap.keys(),
        ]);
      }
    }
    this.paintSparklines(symbolsToRepaint);
  }

  dispose(): void {
    this.sparklineStore.dispose();
  }

  /** Draw sparklines only for symbols that changed or canvases not painted yet. */
  private paintSparklines(symbolsToRefresh?: Set<string>): void {
    const canvases = this.tbody.querySelectorAll<HTMLCanvasElement>(
      "canvas[data-sparkline]",
    );
    for (const canvas of canvases) {
      const sym = canvas.getAttribute("data-sparkline");
      if (!sym) continue;
      const shouldRefresh = symbolsToRefresh
        ? symbolsToRefresh.has(sym) ||
          canvas.getAttribute("data-sparkline-painted") !== "1"
        : canvas.getAttribute("data-sparkline-painted") !== "1";
      if (!shouldRefresh) continue;
      const data = this.sparklineStore.get(sym);
      if (!data || data.prices.length < 2) continue;
      const changePct = this.sparklineChangePctMap.get(sym) ?? 0;
      drawIntradaySparkline(canvas, data.prices, changePct, data.previousClose);
      canvas.setAttribute("data-sparkline-painted", "1");
    }
  }

  private computeSummaryTickerSlotWidthPx(rows: RowRenderData[]): number {
    let measureFont: string | undefined;
    const sampleLabel = this.tbody.querySelector<HTMLElement>(
      ".table-row--summary .table-symbol-label",
    );
    if (sampleLabel) {
      const style = window.getComputedStyle(sampleLabel);
      measureFont =
        style.font ||
        `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    }

    let maxWidth = 0;
    for (const rowData of rows) {
      if (!rowData.isSummary) continue;
      const symbolText = String(rowData.values.get("symbol") ?? "").trim();
      if (!symbolText || symbolText === "-" || symbolText === "\u2014")
        continue;
      const w = this.columnWidthCalculator.measureText(symbolText, measureFont);
      if (w > maxWidth) maxWidth = w;
    }
    if (maxWidth <= 0) return 0;
    return Math.ceil(maxWidth + SUMMARY_TICKER_SLOT_PADDING_PX);
  }

  private computeSummaryBadgeSlotWidthPx(rows: RowRenderData[]): number {
    let measureFont: string | undefined;
    const sampleBadge = this.tbody.querySelector<HTMLElement>(
      ".table-row--summary .table-asset-badges",
    );
    if (sampleBadge) {
      const style = window.getComputedStyle(sampleBadge);
      measureFont =
        style.font ||
        `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    }

    let maxWidth = 0;
    for (const rowData of rows) {
      if (!rowData.isSummary) continue;
      const text = buildBadgeMeasureText(rowData.assetBadges);
      if (!text) continue;
      const w = this.columnWidthCalculator.measureText(text, measureFont);
      if (w > maxWidth) maxWidth = w;
    }
    if (maxWidth <= 0) return 0;
    return Math.ceil(maxWidth + SUMMARY_BADGE_SLOT_PADDING_PX);
  }

  private applySummaryTickerSlotWidth(nextWidthPx: number): void {
    if (nextWidthPx <= 0) {
      this.summaryTickerSlotWidthPx = 0;
      this.tbl.style.removeProperty(SUMMARY_TICKER_SLOT_CSS_VAR);
      return;
    }
    this.summaryTickerSlotWidthPx = nextWidthPx;
    this.tbl.style.setProperty(
      SUMMARY_TICKER_SLOT_CSS_VAR,
      `${this.summaryTickerSlotWidthPx}px`,
    );
  }

  private applySummaryBadgeSlotWidth(nextWidthPx: number): void {
    if (nextWidthPx <= 0) {
      this.summaryBadgeSlotWidthPx = 0;
      this.tbl.style.removeProperty(SUMMARY_BADGE_SLOT_CSS_VAR);
      return;
    }
    this.summaryBadgeSlotWidthPx = nextWidthPx;
    this.tbl.style.setProperty(
      SUMMARY_BADGE_SLOT_CSS_VAR,
      `${this.summaryBadgeSlotWidthPx}px`,
    );
  }
}
