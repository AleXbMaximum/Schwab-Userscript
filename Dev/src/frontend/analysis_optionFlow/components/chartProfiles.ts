import type { ChartPanelCanvasLayout } from "frontend/charts/chartPanel";

export type OpeningChartId =
  | "statusBand"
  | "keyLevels"
  | "termStructure"
  | "flowIncrement"
  | "gexHeatmap"
  | "pcRatioMomentum"
  | "impliedVsRealized"
  | "vrpChart"
  | "ivCorrelation"
  | "oiHeatmap";

export type OpeningChartCategory =
  | "timeseries-multi-axis"
  | "timeseries-key-levels"
  | "timeseries-term-structure"
  | "timeseries-flow"
  | "timeseries-analytics"
  | "matrix-heatmap";

export interface OpeningChartProfile {
  id: OpeningChartId;
  title: string;
  category: OpeningChartCategory;
  canvas: ChartPanelCanvasLayout;
}

export const FLOW_CHART_PROFILES: Record<
  OpeningChartId,
  OpeningChartProfile
> = {
  statusBand: {
    id: "statusBand",
    title: "Intraday Status Band",
    category: "timeseries-multi-axis",
    canvas: {
      width: "100%",
      height: "280px",
      minHeight: "240px",
      maxHeight: "320px",
    },
  },
  keyLevels: {
    id: "keyLevels",
    title: "Key Levels",
    category: "timeseries-key-levels",
    canvas: {
      width: "100%",
      height: "300px",
      minHeight: "260px",
      maxHeight: "340px",
    },
  },
  termStructure: {
    id: "termStructure",
    title: "Term Structure Evolution",
    category: "timeseries-term-structure",
    canvas: {
      width: "100%",
      height: "260px",
      minHeight: "230px",
      maxHeight: "300px",
    },
  },
  flowIncrement: {
    id: "flowIncrement",
    title: "Flow Increments",
    category: "timeseries-flow",
    canvas: {
      width: "100%",
      height: "300px",
      minHeight: "260px",
      maxHeight: "340px",
    },
  },
  gexHeatmap: {
    id: "gexHeatmap",
    title: "GEX Strike-Time Heatmap",
    category: "matrix-heatmap",
    canvas: { width: "100%", minHeight: "360px", maxHeight: "680px" },
  },
  pcRatioMomentum: {
    id: "pcRatioMomentum",
    title: "P/C Ratio Momentum",
    category: "timeseries-analytics",
    canvas: {
      width: "100%",
      height: "280px",
      minHeight: "240px",
      maxHeight: "320px",
    },
  },
  impliedVsRealized: {
    id: "impliedVsRealized",
    title: "Implied vs Realized Move",
    category: "timeseries-analytics",
    canvas: {
      width: "100%",
      height: "280px",
      minHeight: "240px",
      maxHeight: "320px",
    },
  },
  vrpChart: {
    id: "vrpChart",
    title: "Volatility Risk Premium",
    category: "timeseries-analytics",
    canvas: {
      width: "100%",
      height: "280px",
      minHeight: "240px",
      maxHeight: "320px",
    },
  },
  ivCorrelation: {
    id: "ivCorrelation",
    title: "Cross-Asset IV Correlation",
    category: "matrix-heatmap",
    canvas: { width: "100%", minHeight: "300px", maxHeight: "600px" },
  },
  oiHeatmap: {
    id: "oiHeatmap",
    title: "OI Changes Heatmap",
    category: "matrix-heatmap",
    canvas: { width: "100%", minHeight: "360px", maxHeight: "680px" },
  },
};
