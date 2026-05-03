import { ui_createElement } from "../../../components/core/builders/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY } from "../../../components/core/styles/theme";
import { createPillGroup } from "../../../components/core/builders/pillGroup";
import { createTooltipHost } from "shared/utils/dom/tooltipHost";
import { traceRoundRect, setupCanvas } from "frontend/charts/ChartUtils";
import { CHART_FONTS } from "frontend/charts/ChartTheme";
import { formatCompactNumber } from "shared/utils/format/formatters";
import type { ActivitySurfaceData } from "backend/computation/options/types";
import { createRenderFrame } from "../renderFrameController";
import { getFocusedLevels, subscribeFocusedLevels } from "../../focus/focusStrike";

const CELL_GAP = 1;
const CELL_RAD = 2;
const GRID_BG = "rgba(0, 0, 0, 0.03)";

type ActivityMode = "vol" | "oi" | "ratio";

const MODE_LABELS: Record<ActivityMode, string> = {
  vol: "by Vol",
  oi: "by OI",
  ratio: "by log(Vol/OI+1)",
};

const MODE_DESCRIPTIONS: Record<ActivityMode, string> = {
  vol: "Tile depth reflects total volume. Red/blue split encodes put vs call volume share.",
  oi: "Tile depth reflects total open interest. Red/blue split encodes put vs call OI share.",
  ratio:
    "Tile depth reflects log(Volume/OI+1). Red/blue split shows where puts or calls dominate traded volume.",
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

const fmtCompact = (v: number | null): string =>
  formatCompactNumber(v, { nullText: "N/A" });

function fmtModeValue(mode: ActivityMode, v: number | null): string {
  if (v == null || !isFinite(v)) return "N/A";
  if (mode === "ratio") return v.toFixed(4);
  return fmtCompact(v);
}

export function renderUnusualActivity(
  surfaceData: ActivitySurfaceData,
  underlyingPrice: number | null,
): HTMLElement & {
  cleanup?: () => void;
  update?: (d: ActivitySurfaceData, p: number | null) => void;
  resize?: () => void;
} {
  const panel = ui_createElement("div", {
    styleString:
      DS_COMPONENTS.panel +
      " display: flex; flex-direction: column; height: 100%; overflow: hidden;",
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (d: ActivitySurfaceData, p: number | null) => void;
    resize?: () => void;
  };

  panel.appendChild(
    ui_createElement("h3", {
      text: "Options Activity Heatmap",
      styleString: DS_TYPOGRAPHY.panelTitle + " flex-shrink: 0;",
    }),
  );

  const descEl = ui_createElement("div", {
    text: MODE_DESCRIPTIONS.vol,
    styleString: DS_TYPOGRAPHY.panelDesc + " flex-shrink: 0;",
  });
  panel.appendChild(descEl);

  let currentMode: ActivityMode = "vol";

  const modePills = createPillGroup<ActivityMode>(
    [
      { label: "by Vol", value: "vol" },
      { label: "by OI", value: "oi" },
      { label: "by log(Vol/OI+1)", value: "ratio" },
    ],
    "vol",
    (mode) => {
      currentMode = mode;
      descEl.textContent = MODE_DESCRIPTIONS[mode];
      frame.schedule();
    },
  );
  modePills.element.style.marginBottom = "10px";
  modePills.element.style.flexShrink = "0";
  panel.appendChild(modePills.element);

  const canvasContainer = ui_createElement("div", {
    styleString: "overflow-x: auto; width: 100%; flex: 1 1 0; min-height: 0; overflow: hidden;",
  });
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display: block; cursor: crosshair;";
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "Options activity heatmap with put and call volume split",
  );
  canvasContainer.appendChild(canvas);
  panel.appendChild(canvasContainer);

  const { host: tooltipHost, tooltip } = createTooltipHost();

  let currentData = surfaceData;
  let currentPrice = underlyingPrice;
  let focusedLevels = getFocusedLevels();

  const computeLayout = (strikeCount: number) => {
    const containerW = Math.max(canvasContainer.clientWidth, 220);
    const compact = containerW < 560;
    const rowLabelW = compact ? 62 : 80;
    const colHeaderH = compact ? 38 : 45;
    const minCellW = compact ? 10 : 16;
    const maxCellW = compact ? 30 : 42;
    const availableW = Math.max(containerW - rowLabelW - 20, 120);
    const cellW = Math.max(
      minCellW,
      Math.min(maxCellW, availableW / Math.max(strikeCount, 1)),
    );
    const cellH = Math.round(cellW * 0.9);
    const legendH = compact ? 52 : 56;
    return { compact, rowLabelW, colHeaderH, cellW, cellH, legendH };
  };

  const getModeMatrix = (): (number | null)[][] => {
    if (currentMode === "vol") return currentData.volMatrix;
    if (currentMode === "oi") return currentData.oiMatrix;
    return currentData.ratioMatrix;
  };

  const renderHeatmap = () => {
    const { strikes, expirations } = currentData;
    const matrix = getModeMatrix();
    if (strikes.length === 0 || expirations.length === 0) {
      canvas.style.display = "none";
      return;
    }
    canvas.style.display = "block";

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const row of matrix) {
      for (const v of row) {
        if (v != null && isFinite(v)) {
          minVal = Math.min(minVal, v);
          maxVal = Math.max(maxVal, v);
        }
      }
    }
    if (!isFinite(minVal)) {
      minVal = 0;
      maxVal = 1;
    }

    const { compact, rowLabelW, colHeaderH, cellW, cellH, legendH } =
      computeLayout(strikes.length);

    const totalW = rowLabelW + strikes.length * cellW + 10;
    const totalH = colHeaderH + expirations.length * cellH + legendH;

    const ctx = setupCanvas(canvas, totalW, totalH);
    if (!ctx) return;

    ctx.fillStyle = "#3a3a3c";
    ctx.font = compact ? CHART_FONTS.denseLight : CHART_FONTS.labelSmall;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const step =
      cellW < 14 ? 6 : strikes.length > 20 ? 3 : strikes.length > 12 ? 2 : 1;
    for (let i = 0; i < strikes.length; i++) {
      if (i % step === 0) {
        const x = rowLabelW + i * cellW + cellW / 2;
        ctx.fillText(String(strikes[i]), x, colHeaderH - 4);
      }
    }

    if (currentPrice != null) {
      const atmIdx = strikes.reduce(
        (best, s, i) =>
          Math.abs(s - currentPrice) < Math.abs(strikes[best] - currentPrice)
            ? i
            : best,
        0,
      );
      const atmX = rowLabelW + atmIdx * cellW + cellW / 2;
      ctx.fillStyle = "#007AFF";
      ctx.font = compact ? CHART_FONTS.denseBold : CHART_FONTS.labelBold;
      ctx.fillText("ATM", atmX, colHeaderH - 16);
      ctx.beginPath();
      ctx.moveTo(atmX, colHeaderH - 14);
      ctx.lineTo(atmX - 3, colHeaderH - 10);
      ctx.lineTo(atmX + 3, colHeaderH - 10);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(0, 122, 255, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(atmX, colHeaderH);
      ctx.lineTo(atmX, colHeaderH + expirations.length * cellH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const lvl of focusedLevels) {
      const focusIdx = strikes.reduce(
        (best, s, i) =>
          Math.abs(s - lvl.strike) < Math.abs(strikes[best] - lvl.strike)
            ? i
            : best,
        0,
      );
      const focusX = rowLabelW + focusIdx * cellW + cellW / 2;
      ctx.strokeStyle = lvl.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(focusX, colHeaderH);
      ctx.lineTo(focusX, colHeaderH + expirations.length * cellH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = lvl.color;
      ctx.font = CHART_FONTS.dense;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(lvl.label, focusX, colHeaderH - 2);
    }

    // Grid background
    const gridW = strikes.length * cellW;
    const gridH = expirations.length * cellH;
    ctx.fillStyle = GRID_BG;
    traceRoundRect(ctx, rowLabelW, colHeaderH, gridW, gridH, 4);
    ctx.fill();

    for (let expIdx = 0; expIdx < expirations.length; expIdx++) {
      ctx.fillStyle = "#1c1c1e";
      ctx.font = compact ? CHART_FONTS.labelSmall : CHART_FONTS.axis;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const rowY = colHeaderH + expIdx * cellH + cellH / 2;
      const label = expirations[expIdx].label;
      ctx.fillText(label, rowLabelW - 6, rowY);

      for (let sIdx = 0; sIdx < strikes.length; sIdx++) {
        const modeVal = matrix[expIdx]?.[sIdx] ?? null;
        const useOI = currentMode === "oi";
        const callShare = useOI
          ? (currentData.callOiMatrix[expIdx]?.[sIdx] ?? null)
          : (currentData.callVolMatrix[expIdx]?.[sIdx] ?? null);
        const rawPutShare = useOI
          ? (currentData.putOiMatrix[expIdx]?.[sIdx] ?? null)
          : (currentData.putVolMatrix[expIdx]?.[sIdx] ?? null);
        const totalShare = (callShare ?? 0) + (rawPutShare ?? 0);

        const cx = rowLabelW + sIdx * cellW + CELL_GAP;
        const cy = colHeaderH + expIdx * cellH + CELL_GAP;
        const cw = cellW - CELL_GAP * 2;
        const ch = cellH - CELL_GAP * 2;

        if (modeVal == null && totalShare <= 0) {
          ctx.fillStyle = "#f5f5f5";
          traceRoundRect(ctx, cx, cy, cw, ch, CELL_RAD);
          ctx.fill();
        } else {
          const norm =
            maxVal > minVal && modeVal != null
              ? clamp01((modeVal - minVal) / (maxVal - minVal))
              : 0;
          const alpha = 0.16 + 0.74 * norm;
          const putShare =
            totalShare > 0 ? clamp01((rawPutShare ?? 0) / totalShare) : 0.5;
          const putW = Math.round(cw * putShare);

          ctx.save();
          traceRoundRect(ctx, cx, cy, cw, ch, CELL_RAD);
          ctx.clip();

          ctx.fillStyle = `rgba(215, 49, 38, ${alpha.toFixed(3)})`;
          ctx.fillRect(cx, cy, putW, ch);
          ctx.fillStyle = `rgba(0, 122, 255, ${alpha.toFixed(3)})`;
          ctx.fillRect(cx + putW, cy, cw - putW, ch);

          // Divider line
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx + putW, cy);
          ctx.lineTo(cx + putW, cy + ch);
          ctx.stroke();

          ctx.restore();
        }
      }
    }

    const legendY = colHeaderH + expirations.length * cellH + 22;
    const legendW = Math.min(200, totalW - rowLabelW - 40);
    const legendX = rowLabelW + (strikes.length * cellW - legendW) / 2;
    const legendBarH = 10;

    const shareLegendY = legendY - 16;
    const swatchW = 40;
    const swatchH = 8;
    const swatchX = legendX;

    ctx.save();
    traceRoundRect(ctx, swatchX, shareLegendY, swatchW, swatchH, swatchH / 2);
    ctx.clip();
    ctx.fillStyle = "rgba(215, 49, 38, 0.58)";
    ctx.fillRect(swatchX, shareLegendY, swatchW / 2, swatchH);
    ctx.fillStyle = "rgba(0, 122, 255, 0.58)";
    ctx.fillRect(swatchX + swatchW / 2, shareLegendY, swatchW / 2, swatchH);
    ctx.restore();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 0.5;
    traceRoundRect(ctx, swatchX, shareLegendY, swatchW, swatchH, swatchH / 2);
    ctx.stroke();

    ctx.fillStyle = "#777";
    ctx.font = CHART_FONTS.tick;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const splitLabel =
      currentMode === "oi"
        ? "Red=Put OI share, Blue=Call OI share"
        : "Red=Put Vol share, Blue=Call Vol share";
    ctx.fillText(splitLabel, swatchX + swatchW + 6, shareLegendY + swatchH / 2);

    const gradient = ctx.createLinearGradient(legendX, 0, legendX + legendW, 0);
    gradient.addColorStop(0, "rgba(0,0,0,0.06)");
    gradient.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = gradient;
    traceRoundRect(ctx, legendX, legendY, legendW, legendBarH, legendBarH / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 0.5;
    traceRoundRect(ctx, legendX, legendY, legendW, legendBarH, legendBarH / 2);
    ctx.stroke();

    ctx.fillStyle = "#8E8E93";
    ctx.font = CHART_FONTS.tick;
    ctx.textAlign = "left";
    ctx.fillText(
      fmtModeValue(currentMode, minVal),
      legendX,
      legendY + legendBarH + 12,
    );
    ctx.textAlign = "right";
    ctx.fillText(
      fmtModeValue(currentMode, maxVal),
      legendX + legendW,
      legendY + legendBarH + 12,
    );
    ctx.textAlign = "center";
    const modeLabel =
      currentMode === "vol"
        ? "Total Volume"
        : currentMode === "oi"
          ? "Total OI"
          : "log(Vol/OI+1)";
    ctx.fillText(modeLabel, legendX + legendW / 2, legendY + legendBarH + 12);
  };

  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { strikes, expirations } = currentData;
    const matrix = getModeMatrix();

    const { rowLabelW, colHeaderH, cellW, cellH } = computeLayout(
      strikes.length,
    );

    const col = Math.floor((mx - rowLabelW) / cellW);
    const row = Math.floor((my - colHeaderH) / cellH);

    if (
      col >= 0 &&
      col < strikes.length &&
      row >= 0 &&
      row < expirations.length
    ) {
      const modeVal = matrix[row]?.[col] ?? null;
      const callVol = currentData.callVolMatrix[row]?.[col] ?? null;
      const putVol = currentData.putVolMatrix[row]?.[col] ?? null;
      const callOI = currentData.callOiMatrix[row]?.[col] ?? null;
      const putOI = currentData.putOiMatrix[row]?.[col] ?? null;
      const pcVolRatio =
        callVol != null && callVol > 0 ? (putVol ?? 0) / callVol : null;
      const pcOiRatio =
        callOI != null && callOI > 0 ? (putOI ?? 0) / callOI : null;

      tooltip.innerHTML =
        `<div style="font-weight:700; margin-bottom:4px;">$${strikes[col]} &mdash; ${expirations[row].label} (${expirations[row].daysUntil}d)</div>` +
        `<div style="display:grid; grid-template-columns:auto 1fr; gap:2px 8px; font-size:11px;">` +
        `<span style="color:var(--ios-gray);">Call Vol:</span><b>${fmtCompact(callVol)}</b>` +
        `<span style="color:var(--ios-gray);">Put Vol:</span><b>${fmtCompact(putVol)}</b>` +
        `<span style="color:var(--ios-gray);">P/C Vol:</span><b>${pcVolRatio != null ? pcVolRatio.toFixed(3) : "N/A"}</b>` +
        `<span style="color:var(--ios-gray);">Call OI:</span><b>${fmtCompact(callOI)}</b>` +
        `<span style="color:var(--ios-gray);">Put OI:</span><b>${fmtCompact(putOI)}</b>` +
        `<span style="color:var(--ios-gray);">P/C OI:</span><b>${pcOiRatio != null ? pcOiRatio.toFixed(3) : "N/A"}</b>` +
        `</div>` +
        `<div style="margin-top:4px; font-size:10px; color:var(--ios-gray);">${MODE_LABELS[currentMode]}: <b>${fmtModeValue(currentMode, modeVal)}</b></div>`;

      tooltip.style.display = "block";
      tooltip.style.left = `${e.clientX + 12}px`;
      tooltip.style.top = `${e.clientY + 12}px`;
    } else {
      tooltip.style.display = "none";
    }
  };

  const onMouseLeave = () => {
    tooltip.style.display = "none";
  };

  const frame = createRenderFrame(panel, renderHeatmap);

  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseleave", onMouseLeave);

  frame.schedule();

  const unsubscribeFocus = subscribeFocusedLevels((levels) => {
    focusedLevels = levels;
    frame.schedule();
  });

  panel.update = (d: ActivitySurfaceData, p: number | null) => {
    currentData = d;
    currentPrice = p;
    frame.schedule();
  };

  panel.resize = () => {
    frame.schedule();
  };

  panel.cleanup = () => {
    unsubscribeFocus();
    canvas.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mouseleave", onMouseLeave);
    if (tooltipHost.parentNode) tooltipHost.parentNode.removeChild(tooltipHost);
    frame.destroy();
  };

  return panel;
}
