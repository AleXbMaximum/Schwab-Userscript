export interface HeatmapCell {
  row: number;
  col: number;
  value: number;
  label?: string;
}

export interface HeatmapOptions {
  canvas: HTMLCanvasElement;
  rows: string[];
  columns: string[];
  data: number[][];
  title?: string;
  valueFormatter?: (value: number) => string;
  showValues?: boolean;
  cellWidth?: number;
  cellHeight?: number;
  padding?: number;
  colorScale?: "diverging" | "sequential";
  highlightCol?: number;
  highlightColLabel?: string;
  summaryColumn?: number[];
  summaryColumnLabel?: string;
  drawRowLabels?: boolean;
  drawSummaryColumn?: boolean;
  summaryRow?: number[];
  spotPrices?: number[];
  columnNumericValues?: number[];
  rowNumericValues?: number[];
  highlightRow?: number;
  highlightRowLabel?: string;
  showColorScale?: boolean;
  colorScalePosition?: "top" | "bottom";
  colorRangeMin?: number;
  colorRangeMax?: number;
  tooltipFormatter?: (row: string, col: string, value: number) => string;
  summaryRowShowValues?: boolean;
  columnWidths?: number[];
  squareCells?: boolean;
  rotateColumnLabels?: boolean;
}

export interface HeatmapChartHandle {
  update(
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
  ): void;
  getColumnCenterX(col: number): number;
  getRowCenterY(row: number): number;
  readonly colHeaderHeight: number;
  readonly cellHeight: number;
  readonly cellWidth: number;
  destroy(): void;
}
