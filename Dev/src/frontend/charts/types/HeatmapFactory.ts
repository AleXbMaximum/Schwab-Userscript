import { CHART_COLORS } from "../ChartTheme";
import { formatCurrencyLocale } from "shared/utils/formatters";
import type { HeatmapChartHandle } from "./HeatmapTypes";
import { createHeatmapChart } from "./HeatmapChart";

export function createGexHeatmap(
  canvas: HTMLCanvasElement,
  rowLabels: string[],
  colLabels: string[],
  matrix: number[][],
  highlightCol: number,
  summaryColumn: number[],
  opts?: {
    drawRowLabels?: boolean;
    drawSummaryColumn?: boolean;
    spotPrices?: number[];
    strikeNumericValues?: number[];
    rowNumericValues?: number[];
    highlightRow?: number;
    summaryRow?: number[];
    showColorScale?: boolean;
    colorRangeMin?: number;
    colorRangeMax?: number;
    summaryRowShowValues?: boolean;
    columnWidths?: number[];
  },
): HeatmapChartHandle {
  return createHeatmapChart({
    canvas,
    rows: rowLabels,
    columns: colLabels,
    data: matrix,
    valueFormatter: (value) => formatCurrencyLocale(value, 0),
    showValues: false,
    cellWidth: 50,
    cellHeight: 24,
    padding: 0,
    colorScale: "diverging",
    highlightCol,
    highlightColLabel: "ATM",
    highlightRow: opts?.highlightRow,
    highlightRowLabel: "ATM",
    summaryColumn,
    summaryColumnLabel: "\u03A3",
    summaryRow: opts?.summaryRow,
    drawRowLabels: opts?.drawRowLabels,
    drawSummaryColumn: opts?.drawSummaryColumn,
    spotPrices: opts?.spotPrices,
    columnNumericValues: opts?.strikeNumericValues,
    rowNumericValues: opts?.rowNumericValues,
    showColorScale: opts?.showColorScale,
    colorRangeMin: opts?.colorRangeMin,
    colorRangeMax: opts?.colorRangeMax,
    summaryRowShowValues: opts?.summaryRowShowValues,
    columnWidths: opts?.columnWidths,
  });
}

export function createScenarioHeatmap(
  canvas: HTMLCanvasElement,
  marketMoves: string[],
  volMoves: string[],
  pnlMatrix: number[][],
): HeatmapChartHandle {
  return createHeatmapChart({
    canvas,
    rows: marketMoves,
    columns: volMoves,
    data: pnlMatrix,
    title: "",
    valueFormatter: (value) => formatCurrencyLocale(value, 0),
    showValues: true,
    cellWidth: 90,
    cellHeight: 42,
    padding: 0,
    colorScale: "diverging",
  });
}

export function createCorrelationHeatmap(
  canvas: HTMLCanvasElement,
  rowTickers: string[],
  colTickers: string[],
  matrix: number[][],
  opts?: {
    mode: "correlation" | "beta";
    sampleSizes?: number[][];
    rSquared?: number[][];
    colorRangeMin?: number;
    colorRangeMax?: number;
    summaryColumn?: number[];
  },
): HeatmapChartHandle {
  const isBeta = opts?.mode === "beta";
  const sampleSizes = opts?.sampleSizes;
  const rSquared = opts?.rSquared;

  // Build index maps for fast tooltip lookups
  const rowIndex = new Map(rowTickers.map((t, i) => [t, i]));
  const colIndex = new Map(colTickers.map((t, i) => [t, i]));

  return createHeatmapChart({
    canvas,
    rows: rowTickers,
    columns: colTickers,
    data: matrix,
    valueFormatter: (v) => (Number.isFinite(v) ? v.toFixed(2) : "N/A"),
    showValues: true,
    cellWidth: 48,
    cellHeight: 36,
    padding: 0,
    colorScale: "diverging",
    drawRowLabels: true,
    drawSummaryColumn: (opts?.summaryColumn?.length ?? 0) > 0,
    summaryColumn: opts?.summaryColumn ?? [],
    summaryColumnLabel: isBeta ? "Avg \u03B2" : "Avg \u03C1",
    showColorScale: false,
    colorScalePosition: "top",
    squareCells: true,
    rotateColumnLabels: true,
    colorRangeMin: opts?.colorRangeMin ?? (isBeta ? undefined : -1),
    colorRangeMax: opts?.colorRangeMax ?? (isBeta ? undefined : 1),
    tooltipFormatter: (row, col, value) => {
      const rowIdx = rowIndex.get(row) ?? -1;
      const colIdx = colIndex.get(col) ?? -1;
      const n =
        rowIdx >= 0 && colIdx >= 0 ? (sampleSizes?.[rowIdx]?.[colIdx] ?? 0) : 0;
      const r2 =
        rowIdx >= 0 && colIdx >= 0 ? rSquared?.[rowIdx]?.[colIdx] : undefined;

      if (!Number.isFinite(value)) {
        const reason =
          r2 != null && Number.isFinite(r2)
            ? `R\u00b2 = ${r2.toFixed(3)} (below threshold)`
            : "Insufficient data";
        return (
          `<div style="font-weight:600; margin-bottom:4px;">${row} vs ${col}</div>` +
          `<div style="color:${CHART_COLORS.textSecondary};">${reason}</div>`
        );
      }
      const label = isBeta ? "Beta" : "Correlation";
      const r2Line =
        isBeta && r2 != null && Number.isFinite(r2)
          ? `<div style="font-size:11px; color:${CHART_COLORS.textSecondary};">R\u00b2: ${r2.toFixed(3)}</div>`
          : "";
      return (
        `<div style="font-weight:600; margin-bottom:4px;">${row} vs ${col}</div>` +
        `<div>${label}: ${value.toFixed(3)}</div>` +
        r2Line +
        (n > 0
          ? `<div style="font-size:11px; color:${CHART_COLORS.textSecondary}; margin-top:2px;">Sample: ${n}</div>`
          : "")
      );
    },
  });
}
