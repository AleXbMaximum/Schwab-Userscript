import { ui_createElement } from "../../../components/core/builders/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY } from "../../../components/core/styles/theme";
import { createTooltipHost } from "shared/utils/dom/tooltipHost";
import { traceRoundRect, setupCanvas } from "frontend/charts/ChartUtils";
import { CHART_COLORS, CHART_FONTS } from "frontend/charts/ChartTheme";
import { withShadow } from "frontend/components/core/axTheme/renderMode/canvasShadow";
import { isDarkTheme } from "frontend/components/core/axTheme";
import { marchingSquares, pickContourLevels } from "shared/utils/math/marchingSquares";
import type { VolSurfaceData } from "backend/computation/options/types";
import { createRenderFrame } from "../renderFrameController";
import { getFocusedLevels, subscribeFocusedLevels } from "../../focus/focusStrike";

const CELL_GAP = 1;
const CELL_RAD = 2;
const gridBg = (): string =>
  isDarkTheme() ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)";
const missingCellBg = (): string => (isDarkTheme() ? "#26262b" : "#f5f5f5");

function ivColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  if (c <= 0.5) {
    const f = c / 0.5; // 0→1
    const r = Math.round(32 + (255 - 32) * f);
    const g = Math.round(169 + (255 - 169) * f);
    const b = Math.round(69 + (255 - 69) * f);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const f = (c - 0.5) / 0.5; // 0→1
  const r = 255;
  const g = Math.round(255 * (1 - f));
  const b = Math.round(255 * (1 - f));
  return `rgb(${r}, ${g}, ${b})`;
}

export function renderVolatilitySurface(
  surfaceData: VolSurfaceData,
  underlyingPrice: number | null,
): HTMLElement & {
  cleanup?: () => void;
  update?: (data: VolSurfaceData, price: number | null) => void;
  resize?: () => void;
} {
  const panel = ui_createElement("div", {
    styleString:
      DS_COMPONENTS.panel +
      " display: flex; flex-direction: column; height: 100%; overflow: hidden;",
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (data: VolSurfaceData, price: number | null) => void;
    resize?: () => void;
  };

  panel.appendChild(
    ui_createElement("h3", {
      text: "Volatility Surface",
      styleString: DS_TYPOGRAPHY.panelTitle + " flex-shrink: 0;",
    }),
  );
  panel.appendChild(
    ui_createElement("div", {
      text: "IV heatmap across expirations (X) and strikes (Y). Identify skew anomalies and term structure inversions.",
      styleString: DS_TYPOGRAPHY.panelDesc + " flex-shrink: 0;",
    }),
  );

  const canvasContainer = ui_createElement("div", {
    styleString: "overflow-x: auto; width: 100%; flex: 1 1 0; min-height: 0; overflow: hidden;",
  });
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display: block; cursor: crosshair;";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Volatility surface heatmap");
  canvasContainer.appendChild(canvas);
  panel.appendChild(canvasContainer);

  const { host: tooltipHost, tooltip } = createTooltipHost();

  let currentData = surfaceData;
  let currentPrice = underlyingPrice;
  let focusedLevels = getFocusedLevels();

  // After axis swap: columns = expirations, rows = strikes
  // Data access: matrix[expIdx][strikeIdx] → cell at column=expIdx, row=strikeIdx

  const computeLayout = (colCount: number, rowCount: number) => {
    const containerW = Math.max(canvasContainer.clientWidth, 220);
    const compact = containerW < 560;
    const rowLabelW = compact ? 52 : 66; // strike labels (shorter numbers)
    const colHeaderH = compact ? 58 : 66;
    const minCellW = compact ? 10 : 16;
    const maxCellW = compact ? 30 : 42;
    const availableW = Math.max(containerW - rowLabelW - 20, 120);
    const cellW = Math.max(
      minCellW,
      Math.min(maxCellW, availableW / Math.max(colCount, 1)),
    );
    const cellH = compact ? (rowCount > 20 ? 16 : 22) : rowCount > 20 ? 20 : 26;
    const legendH = 35;
    return { compact, rowLabelW, colHeaderH, cellW, cellH, legendH };
  };

  const renderHeatmap = () => {
    const { strikes, expirations, matrix } = currentData;
    if (strikes.length === 0 || expirations.length === 0) {
      canvas.style.display = "none";
      return;
    }
    canvas.style.display = "block";

    // Axes after swap: columns = expirations, rows = strikes
    const numCols = expirations.length;
    const numRows = strikes.length;

    let minIV = Infinity;
    let maxIV = -Infinity;
    for (const row of matrix) {
      for (const v of row) {
        if (v != null && isFinite(v)) {
          minIV = Math.min(minIV, v);
          maxIV = Math.max(maxIV, v);
        }
      }
    }
    if (!isFinite(minIV)) {
      minIV = 0;
      maxIV = 100;
    }

    const { compact, rowLabelW, colHeaderH, cellW, cellH, legendH } =
      computeLayout(numCols, numRows);

    const totalW = rowLabelW + numCols * cellW + 10;
    const totalH = colHeaderH + numRows * cellH + legendH;

    const ctx = setupCanvas(canvas, totalW, totalH);
    if (!ctx) return;

    // ── Column headers: expiration labels ───────────────────────────────
    ctx.fillStyle = CHART_COLORS.textSecondary;
    ctx.font = compact ? CHART_FONTS.denseLight : CHART_FONTS.labelSmall;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (let i = 0; i < numCols; i++) {
      const x = rowLabelW + i * cellW + cellW / 2;
      const step = cellW < 28 ? (numCols > 16 ? 4 : 2) : 1;
      if (i % step === 0) {
        ctx.save();
        ctx.translate(x, colHeaderH - 4);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(expirations[i].label, 0, 0);
        ctx.restore();
      }
    }

    // ── Row labels: strike values ───────────────────────────────────────
    // Grid background
    const gridW = numCols * cellW;
    const gridH = numRows * cellH;
    ctx.fillStyle = gridBg();
    traceRoundRect(ctx, rowLabelW, colHeaderH, gridW, gridH, 4);
    ctx.fill();

    // ATM row marker
    let atmRowIdx = -1;
    if (currentPrice != null) {
      atmRowIdx = strikes.reduce(
        (best, s, i) =>
          Math.abs(s - currentPrice!) < Math.abs(strikes[best] - currentPrice!)
            ? i
            : best,
        0,
      );
    }

    for (let sIdx = 0; sIdx < numRows; sIdx++) {
      // Row label (strike)
      ctx.fillStyle = sIdx === atmRowIdx ? "#007AFF" : CHART_COLORS.textPrimary;
      ctx.font = compact
        ? (sIdx === atmRowIdx ? CHART_FONTS.labelBold : CHART_FONTS.labelSmall)
        : (sIdx === atmRowIdx ? CHART_FONTS.axisBold : CHART_FONTS.axis);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const rowY = colHeaderH + sIdx * cellH + cellH / 2;
      const label =
        sIdx === atmRowIdx ? `${strikes[sIdx]} ▸` : String(strikes[sIdx]);
      const step = numRows > 25 ? 2 : 1;
      if (sIdx % step === 0 || sIdx === atmRowIdx) {
        ctx.fillText(label, rowLabelW - 4, rowY);
      }

      // Cells: iterate columns (expirations)
      for (let eIdx = 0; eIdx < numCols; eIdx++) {
        const iv = matrix[eIdx]?.[sIdx] ?? null;
        const x = rowLabelW + eIdx * cellW;
        const y = colHeaderH + sIdx * cellH;

        if (iv != null) {
          const norm = maxIV > minIV ? (iv - minIV) / (maxIV - minIV) : 0.5;
          ctx.fillStyle = ivColor(norm);
        } else {
          ctx.fillStyle = missingCellBg();
        }
        traceRoundRect(
          ctx,
          x + CELL_GAP,
          y + CELL_GAP,
          cellW - CELL_GAP * 2,
          cellH - CELL_GAP * 2,
          CELL_RAD,
        );
        ctx.fill();

        if (iv != null && cellW >= 32 && cellH >= 22) {
          const norm = maxIV > minIV ? (iv - minIV) / (maxIV - minIV) : 0.5;
          ctx.fillStyle = norm > 0.3 && norm < 0.7 ? "#1c1c1e" : "#fff";
          ctx.font = CHART_FONTS.dense;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(iv.toFixed(1), x + cellW / 2, y + cellH / 2);
        }
      }
    }

    // ── ATM horizontal line ─────────────────────────────────────────────
    if (atmRowIdx >= 0) {
      const atmY = colHeaderH + atmRowIdx * cellH + cellH / 2;
      ctx.save();
      ctx.strokeStyle = "rgba(0, 122, 255, 0.25)";
      ctx.lineWidth = cellH;
      ctx.beginPath();
      ctx.moveTo(rowLabelW, atmY);
      ctx.lineTo(rowLabelW + gridW, atmY);
      ctx.stroke();
      ctx.restore();
    }

    // ── Contour iso-lines ───────────────────────────────────────────────
    // Build transposed matrix: transposed[strikeIdx][expIdx] for marching squares
    // since our display is rows=strikes, cols=expirations
    {
      const transposed: (number | null)[][] = [];
      for (let s = 0; s < numRows; s++) {
        const tRow: (number | null)[] = [];
        for (let e = 0; e < numCols; e++) {
          tRow.push(matrix[e]?.[s] ?? null);
        }
        transposed.push(tRow);
      }

      const levels = pickContourLevels(minIV, maxIV, 8);
      for (const level of levels) {
        const segs = marchingSquares(transposed, level, numRows, numCols);
        if (segs.length === 0) continue;

        ctx.save();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);

        // marchingSquares returns (x=col, y=row) → (x=exp, y=strike) in our transposed frame
        for (const s of segs) {
          ctx.beginPath();
          ctx.moveTo(rowLabelW + s.x1 * cellW, colHeaderH + s.y1 * cellH);
          ctx.lineTo(rowLabelW + s.x2 * cellW, colHeaderH + s.y2 * cellH);
          ctx.stroke();
        }

        // Label at midpoint of a representative segment
        const mid = segs[Math.floor(segs.length / 2)];
        const lx = rowLabelW + ((mid.x1 + mid.x2) / 2) * cellW;
        const ly = colHeaderH + ((mid.y1 + mid.y2) / 2) * cellH;
        const text = level.toFixed(0) + "%";
        ctx.font = CHART_FONTS.dense;
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fillRect(lx - tw / 2 - 2, ly - 5, tw + 4, 10);
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, lx, ly);

        ctx.restore();
      }
    }

    // ── Focused level lines (horizontal, since strikes are now rows) ────
    for (const lvl of focusedLevels) {
      const focusIdx = strikes.reduce(
        (best, s, i) =>
          Math.abs(s - lvl.strike) < Math.abs(strikes[best] - lvl.strike)
            ? i
            : best,
        0,
      );
      const focusY = colHeaderH + focusIdx * cellH + cellH / 2;
      ctx.strokeStyle = lvl.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(rowLabelW - 10, focusY);
      ctx.lineTo(rowLabelW + numCols * cellW, focusY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = lvl.color;
      ctx.font = compact ? CHART_FONTS.dense : CHART_FONTS.label;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(lvl.label, rowLabelW - 14, focusY);
    }

    // ── Mark lowest IV per expiration column with a dot ─────────────────
    for (let eIdx = 0; eIdx < numCols; eIdx++) {
      let lowestIV = Infinity;
      let lowestRow = -1;
      for (let sIdx = 0; sIdx < numRows; sIdx++) {
        const iv = matrix[eIdx]?.[sIdx] ?? null;
        if (iv != null && iv < lowestIV) {
          lowestIV = iv;
          lowestRow = sIdx;
        }
      }
      if (lowestRow >= 0) {
        const cx = rowLabelW + eIdx * cellW + cellW / 2;
        const cy = colHeaderH + lowestRow * cellH + cellH / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        withShadow(
          ctx,
          { color: "rgba(26, 26, 46, 0.5)", blur: 5 },
          () => {
            ctx.fillStyle = "#1a1a2e";
            ctx.fill();
          },
        );
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // ── Legend ───────────────────────────────────────────────────────────
    const legendY = colHeaderH + numRows * cellH + 8;
    const legendW = Math.min(200, totalW - rowLabelW - 40);
    const legendX = rowLabelW + (numCols * cellW - legendW) / 2;
    const legendBarH = 10;

    const gradient = ctx.createLinearGradient(legendX, 0, legendX + legendW, 0);
    gradient.addColorStop(0, ivColor(0));
    gradient.addColorStop(0.25, ivColor(0.25));
    gradient.addColorStop(0.5, ivColor(0.5));
    gradient.addColorStop(0.75, ivColor(0.75));
    gradient.addColorStop(1, ivColor(1));
    ctx.fillStyle = gradient;
    traceRoundRect(ctx, legendX, legendY, legendW, legendBarH, legendBarH / 2);
    ctx.fill();
    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.lineWidth = 0.5;
    traceRoundRect(ctx, legendX, legendY, legendW, legendBarH, legendBarH / 2);
    ctx.stroke();

    ctx.fillStyle = CHART_COLORS.neutral;
    ctx.font = CHART_FONTS.tick;
    ctx.textAlign = "left";
    ctx.fillText(`${minIV.toFixed(0)}%`, legendX, legendY + legendBarH + 12);
    ctx.textAlign = "right";
    ctx.fillText(
      `${maxIV.toFixed(0)}%`,
      legendX + legendW,
      legendY + legendBarH + 12,
    );
    ctx.textAlign = "center";
    ctx.fillText("IV", legendX + legendW / 2, legendY + legendBarH + 12);
  };

  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { strikes, expirations, matrix } = currentData;

    const numCols = expirations.length;
    const numRows = strikes.length;
    const { rowLabelW, colHeaderH, cellW, cellH } = computeLayout(
      numCols,
      numRows,
    );

    // col = expiration index, row = strike index
    const col = Math.floor((mx - rowLabelW) / cellW);
    const row = Math.floor((my - colHeaderH) / cellH);

    if (col >= 0 && col < numCols && row >= 0 && row < numRows) {
      const iv = matrix[col]?.[row];
      const atmIdx =
        currentPrice != null
          ? strikes.reduce(
              (best, s, i) =>
                Math.abs(s - currentPrice) <
                Math.abs(strikes[best] - currentPrice)
                  ? i
                  : best,
              0,
            )
          : null;
      const atmIV = atmIdx != null ? (matrix[col]?.[atmIdx] ?? null) : null;
      const moneynessPct =
        currentPrice != null
          ? ((strikes[row] - currentPrice) / currentPrice) * 100
          : null;
      const deltaVsATM = iv != null && atmIV != null ? iv - atmIV : null;
      tooltip.innerHTML =
        `<div style="font-weight:600; margin-bottom:3px;">${expirations[col].label}</div>` +
        `<div>DTE: ${expirations[col].daysUntil}d</div>` +
        `<div>Strike: $${strikes[row]}</div>` +
        `<div>IV: ${iv != null ? iv.toFixed(2) + "%" : "N/A"}</div>` +
        `<div>ATM IV (same expiry): ${atmIV != null ? atmIV.toFixed(2) + "%" : "N/A"}</div>` +
        `<div>\u0394IV vs ATM: ${deltaVsATM != null ? (deltaVsATM >= 0 ? "+" : "") + deltaVsATM.toFixed(2) + "pp" : "N/A"}</div>` +
        `<div>Moneyness vs spot: ${moneynessPct != null ? (moneynessPct >= 0 ? "+" : "") + moneynessPct.toFixed(2) + "%" : "N/A"}</div>`;
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

  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseleave", onMouseLeave);

  const frame = createRenderFrame(panel, renderHeatmap);
  frame.schedule();

  const unsubscribeFocus = subscribeFocusedLevels((levels) => {
    focusedLevels = levels;
    frame.schedule();
  });

  panel.update = (data: VolSurfaceData, price: number | null) => {
    currentData = data;
    currentPrice = price;
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
