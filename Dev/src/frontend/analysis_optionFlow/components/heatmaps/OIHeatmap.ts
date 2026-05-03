import { ui_createElement } from "frontend/components/core/builders/createElement";
import { createPillGroup } from "frontend/components/core/builders/pillGroup";
import { createGexHeatmap } from "frontend/charts/types/HeatmapFactory";
import type { HeatmapChartHandle } from "frontend/charts/types/HeatmapTypes";
import type { OIHeatmapData } from "../../types";
import { FLOW_CHART_PROFILES } from "../chartProfiles";
import {
  type WindowPct,
  type MatrixMode,
  toDeltaMatrix,
  filterByWindow,
  getMedianSpot,
  formatStrike,
  transposeMatrix,
  snapToGrid,
} from "./heatmapMatrix";
import {
  CELL_WIDTH,
  drawRowLabels,
  drawSummaryColumn,
} from "./heatmapCanvas";
import {
  buildHeatmapPanelScaffold,
  attachHeatmapResizeObserver,
} from "./heatmapPanelScaffold";

type OIType = "call" | "put" | "total";

function selectOIMatrix(data: OIHeatmapData, type: OIType): number[][] {
  switch (type) {
    case "call":
      return data.callOIMatrix;
    case "put":
      return data.putOIMatrix;
    default:
      return data.callOIMatrix.map((row, ri) =>
        row.map((v, ci) => v + (data.putOIMatrix[ri]?.[ci] ?? 0)),
      );
  }
}

function formatOI(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

// ── Panel renderer ──────────────────────────────────────────────────────────

export function renderOIHeatmap(
  data: OIHeatmapData,
): HTMLElement & { cleanup?: () => void; update?: (d: OIHeatmapData) => void } {
  const { panel, headerRow, canvases, scale } =
    buildHeatmapPanelScaffold<OIHeatmapData>({
      profile: FLOW_CHART_PROFILES.oiHeatmap,
      formatScaleValue: formatOI,
    });

  const { rowLabelCanvas, matrixCanvas, summaryCanvas, scrollWrap, heatmapContainer } =
    canvases;

  const oiPills = createPillGroup<OIType>(
    [
      { label: "Total", value: "total" },
      { label: "Call", value: "call" },
      { label: "Put", value: "put" },
    ],
    "total",
    () => rebuild(),
    "OI:",
  );

  const modePills = createPillGroup<MatrixMode>(
    [
      { label: "Delta", value: "delta" },
      { label: "Level", value: "level" },
    ],
    "delta",
    () => rebuild(),
    "Mode:",
  );

  const winPills = createPillGroup<WindowPct>(
    [
      { label: "\u00B13%", value: 3 },
      { label: "\u00B15%", value: 5 },
      { label: "\u00B110%", value: 10 },
      { label: "\u00B115%", value: 15 },
    ],
    5,
    () => rebuild(),
    "ATM:",
  );

  headerRow.appendChild(oiPills.element);
  headerRow.appendChild(modePills.element);
  headerRow.appendChild(winPills.element);

  if (data.times.length === 0 || data.strikes.length === 0) {
    panel.appendChild(
      ui_createElement("div", {
        text: "No OI data available for this date.",
        styleString:
          "color:var(--ios-gray); font-size:12px; padding:20px 0; text-align:center;",
      }),
    );
    panel.update = () => {};
    panel.cleanup = () => {};
    return panel;
  }

  panel.appendChild(heatmapContainer);

  let currentData = data;
  let heatmap: HeatmapChartHandle | null = null;
  const maxCols = 25;

  function rebuild(): void {
    const medianSpot = getMedianSpot(currentData.spots);
    const baseMat = selectOIMatrix(currentData, oiPills.getValue());
    const mat =
      modePills.getValue() === "delta" ? toDeltaMatrix(baseMat) : baseMat;
    const filtered = filterByWindow(currentData.spots, currentData.strikes, mat, winPills.getValue());
    const sampled = snapToGrid(
      filtered.strikes,
      filtered.matrix,
      medianSpot,
      maxCols,
    );

    // Reverse strikes (highest first) and transpose: rows=strikes, cols=times
    sampled.strikes.reverse();
    sampled.matrix = sampled.matrix.map((row) => [...row].reverse());
    const displayMatrix = transposeMatrix(sampled.matrix);
    const timeLabels = currentData.times;

    const strikeLabels = sampled.strikes.map(formatStrike);

    let atmRow = -1;
    if (medianSpot > 0 && sampled.strikes.length > 0) {
      let bestDist = Infinity;
      for (let i = 0; i < sampled.strikes.length; i++) {
        const dist = Math.abs(sampled.strikes[i] - medianSpot);
        if (dist < bestDist) {
          bestDist = dist;
          atmRow = i;
        }
      }
    }

    // Summary: per-strike sum across time, per-time sum across strikes
    const summaryColumn = displayMatrix.map((row) =>
      row.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0),
    );
    const summaryRow = Array.from({ length: timeLabels.length }, (_, colIdx) =>
      displayMatrix.reduce(
        (s, row) => s + (Number.isFinite(row[colIdx]) ? row[colIdx] : 0),
        0,
      ),
    );
    const grandTotal = summaryColumn.reduce((s, v) => s + v, 0);

    // Symmetric color range
    let absMax = 0;
    for (const row of displayMatrix) {
      for (const v of row) {
        const a = Math.abs(v);
        if (a > absMax) absMax = a;
      }
    }
    scale.syncDomain(absMax);
    const scaleRange = scale.getRange();

    const rowCount = sampled.strikes.length;
    const effectiveCellWidth = heatmap?.cellWidth ?? CELL_WIDTH;
    const spotPrices = currentData.spots;

    if (heatmap) {
      heatmap.update(displayMatrix, strikeLabels, timeLabels, {
        highlightRow: atmRow,
        summaryColumn,
        summaryRow,
        spotPrices,
        rowNumericValues: sampled.strikes,
        colorRangeMin: -scaleRange,
        colorRangeMax: scaleRange,
      });
    } else {
      heatmap = createGexHeatmap(
        matrixCanvas,
        strikeLabels,
        timeLabels,
        displayMatrix,
        -1,
        summaryColumn,
        {
          drawRowLabels: false,
          drawSummaryColumn: false,
          spotPrices,
          rowNumericValues: sampled.strikes,
          highlightRow: atmRow,
          summaryRow,
          showColorScale: false,
          colorRangeMin: -scaleRange,
          colorRangeMax: scaleRange,
        },
      );
    }

    drawRowLabels(
      rowLabelCanvas,
      strikeLabels,
      rowCount,
      atmRow,
      summaryRow.length > 0,
    );
    drawSummaryColumn(
      summaryCanvas,
      summaryColumn,
      rowCount,
      effectiveCellWidth,
      formatOI,
      grandTotal,
    );

    requestAnimationFrame(() => {
      scrollWrap.scrollLeft = Math.max(
        0,
        scrollWrap.scrollWidth - scrollWrap.clientWidth,
      );
    });
  }

  scale.onScaleInput(() => rebuild());
  rebuild();

  const resizeHandle = attachHeatmapResizeObserver(heatmapContainer, () =>
    rebuild(),
  );

  panel.update = (d: OIHeatmapData) => {
    currentData = d;
    rebuild();
  };

  panel.cleanup = () => {
    resizeHandle.disconnect();
    scale.removeScaleInput();
    heatmap?.destroy();
    heatmap = null;
  };

  return panel;
}
