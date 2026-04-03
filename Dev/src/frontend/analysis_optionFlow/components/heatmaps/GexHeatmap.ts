import { ui_createElement } from "frontend/components/core/createElement";
import { createPillGroup } from "frontend/components/core/pillGroup";
import { createGexHeatmap } from "frontend/charts/types/HeatmapFactory";
import type { HeatmapChartHandle } from "frontend/charts/types/HeatmapTypes";
import { clamp } from "shared/utils/math/numeric";
import type { GexHeatmapData } from "../../types";
import { FLOW_CHART_PROFILES } from "../chartProfiles";
import {
  type WindowPct,
  type MatrixMode,
  toDeltaMatrix,
  filterByWindow,
  getMedianSpot,
  formatStrike,
  getMatrixBounds,
  transposeMatrix,
  snapToGrid,
} from "./heatmapMatrix";
import {
  CELL_WIDTH,
  computeProportionalWidths,
  drawRowLabels,
  drawSummaryColumn,
} from "./heatmapCanvas";
import {
  type GexType,
  selectGexMatrix,
  formatScaleValue,
  formatCompactValue,
} from "./gexHeatmapUtils";
import {
  buildHeatmapPanelScaffold,
  attachHeatmapResizeObserver,
} from "./heatmapPanelScaffold";

export function renderGexHeatmap(data: GexHeatmapData): HTMLElement & {
  cleanup?: () => void;
  update?: (d: GexHeatmapData) => void;
} {
  const { panel, headerRow, canvases, scale } =
    buildHeatmapPanelScaffold<GexHeatmapData>({
      profile: FLOW_CHART_PROFILES.gexHeatmap,
      formatScaleValue,
    });

  const { rowLabelCanvas, matrixCanvas, summaryCanvas, scrollWrap, heatmapContainer } =
    canvases;

  const gexPills = createPillGroup<GexType>(
    [
      { label: "Net", value: "net" },
      { label: "Call", value: "call" },
      { label: "Put", value: "put" },
    ],
    "net",
    () => rebuildHeatmap(),
    "GEX:",
  );

  const modePills = createPillGroup<MatrixMode>(
    [
      { label: "Level", value: "level" },
      { label: "Delta", value: "delta" },
    ],
    "delta",
    () => rebuildHeatmap(),
    "Mode:",
  );

  const winPills = createPillGroup<WindowPct>(
    [
      { label: "\u00B11%", value: 1 },
      { label: "\u00B12%", value: 2 },
      { label: "\u00B13%", value: 3 },
      { label: "\u00B15%", value: 5 },
      { label: "\u00B110%", value: 10 },
      { label: "\u00B115%", value: 15 },
    ],
    3,
    () => rebuildHeatmap(),
    "ATM:",
  );

  headerRow.appendChild(gexPills.element);
  headerRow.appendChild(modePills.element);
  headerRow.appendChild(winPills.element);

  if (data.times.length === 0 || data.strikes.length === 0) {
    panel.appendChild(
      ui_createElement("div", {
        text: "No strike leg data available for this date.",
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

  function rebuildHeatmap(preserveScrollPosition: boolean = false): void {
    const previousScrollLeft = scrollWrap.scrollLeft;
    const medianSpot = getMedianSpot(currentData.spots);
    const baseMat = selectGexMatrix(currentData, gexPills.getValue());
    const mat =
      modePills.getValue() === "delta" ? toDeltaMatrix(baseMat) : baseMat;
    const filtered = filterByWindow(currentData.spots, currentData.strikes, mat, winPills.getValue());
    const sampled = snapToGrid(
      filtered.strikes,
      filtered.matrix,
      medianSpot,
      maxCols,
    );

    sampled.strikes.reverse();
    sampled.matrix = sampled.matrix.map((row) => [...row].reverse());
    const displayMatrix = transposeMatrix(sampled.matrix);
    const strikeLabels = sampled.strikes.map(formatStrike);
    const timeLabels = currentData.times;

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

    const rowCount = sampled.strikes.length;
    const effectiveCellWidth = heatmap?.cellWidth ?? CELL_WIDTH;

    const spotPrices = currentData.spots;
    const bounds = getMatrixBounds(displayMatrix);
    scale.syncDomain(Math.max(bounds.absMax, 1));
    const scaleRange = scale.getRange();

    // Compute proportional column widths to fit container
    const containerWidth = scrollWrap.clientWidth;
    const columnWidths =
      containerWidth > 0 && timeLabels.length > 0
        ? computeProportionalWidths(timeLabels, containerWidth, 20)
        : undefined;

    if (heatmap) {
      heatmap.update(displayMatrix, strikeLabels, timeLabels, {
        highlightRow: atmRow,
        summaryColumn,
        summaryRow,
        spotPrices,
        rowNumericValues: sampled.strikes,
        colorRangeMin: -scaleRange,
        colorRangeMax: scaleRange,
        columnWidths,
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
          summaryRowShowValues: false,
          columnWidths,
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
      formatCompactValue,
      grandTotal,
    );

    requestAnimationFrame(() => {
      // Skip scroll positioning when using proportional widths (fits container)
      if (columnWidths) return;
      if (preserveScrollPosition) {
        const maxScroll = Math.max(
          0,
          scrollWrap.scrollWidth - scrollWrap.clientWidth,
        );
        scrollWrap.scrollLeft = clamp(previousScrollLeft, 0, maxScroll);
      } else {
        scrollWrap.scrollLeft = Math.max(
          0,
          scrollWrap.scrollWidth - scrollWrap.clientWidth,
        );
      }
    });
  }

  scale.onScaleInput(() => rebuildHeatmap(true));
  rebuildHeatmap();

  const resizeHandle = attachHeatmapResizeObserver(heatmapContainer, () =>
    rebuildHeatmap(true),
  );

  panel.update = (d: GexHeatmapData) => {
    currentData = d;
    rebuildHeatmap();
  };

  panel.cleanup = () => {
    resizeHandle.disconnect();
    scale.removeScaleInput();
    heatmap?.destroy();
    heatmap = null;
  };

  return panel;
}
