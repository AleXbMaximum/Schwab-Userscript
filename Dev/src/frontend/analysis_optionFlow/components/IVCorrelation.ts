import { ui_createElement } from "frontend/components/core/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY, DS_BUTTONS } from "frontend/components/core/theme";
import { getHeatmapColor } from "frontend/charts/ChartTheme";
import { pearsonCorrelation } from "shared/utils/math/statistics";
import type { OptionCapture } from "backend/core/db/capture/optionMonitorTypes";
import { loadMultiSymbolHistory } from "../data/monitorHistory";

// ── Helpers ─────────────────────────────────────────────────────────────────

interface DailyIV {
  date: string;
  iv: number;
}

/** Deduplicate to one snapshot per date, extract ATM IV. */
function dailyIVSeries(history: OptionCapture[]): DailyIV[] {
  const byDate = new Map<string, OptionCapture>();
  for (const snap of history) {
    const date = snap.capturedAt.substring(0, 10);
    const existing = byDate.get(date);
    if (!existing || existing.capturedAt < snap.capturedAt) {
      byDate.set(date, snap);
    }
  }
  return Array.from(byDate.entries())
    .filter(([, snap]) => snap.atmIV != null && Number.isFinite(snap.atmIV))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, snap]) => ({ date, iv: snap.atmIV! }));
}

/** Compute daily IV changes (first differences). */
function dailyChanges(series: DailyIV[]): Map<string, number> {
  const changes = new Map<string, number>();
  for (let i = 1; i < series.length; i++) {
    changes.set(series[i].date, series[i].iv - series[i - 1].iv);
  }
  return changes;
}

/** Pearson correlation between two arrays — delegates to shared math. */
const pearson = pearsonCorrelation;

interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
}

function computeCorrelation(
  allHistory: Map<string, OptionCapture[]>,
): CorrelationMatrix {
  const symbols = Array.from(allHistory.keys()).sort();
  const changeMap = new Map<string, Map<string, number>>();
  for (const sym of symbols) {
    const series = dailyIVSeries(allHistory.get(sym) ?? []);
    changeMap.set(sym, dailyChanges(series));
  }

  // Find overlapping dates
  const allDates = new Set<string>();
  for (const changes of changeMap.values()) {
    for (const date of changes.keys()) allDates.add(date);
  }

  const matrix: number[][] = [];
  for (let i = 0; i < symbols.length; i++) {
    const row: number[] = [];
    const changesI = changeMap.get(symbols[i])!;
    for (let j = 0; j < symbols.length; j++) {
      if (i === j) {
        row.push(1);
        continue;
      }
      const changesJ = changeMap.get(symbols[j])!;
      const aVals: number[] = [];
      const bVals: number[] = [];
      for (const date of allDates) {
        const a = changesI.get(date);
        const b = changesJ.get(date);
        if (a != null && b != null) {
          aVals.push(a);
          bVals.push(b);
        }
      }
      row.push(pearson(aVals, bVals));
    }
    matrix.push(row);
  }

  return { symbols, matrix };
}

// ── Canvas renderer ─────────────────────────────────────────────────────────

const LABEL_PAD = 6;

function renderCorrelationCanvas(
  corr: CorrelationMatrix,
  maxWidth: number,
): HTMLCanvasElement {
  const n = corr.symbols.length;
  const dpr = window.devicePixelRatio || 1;

  // Measure label width dynamically
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d")!;
  mctx.font = "bold 10px -apple-system, BlinkMacSystemFont, sans-serif";
  let labelW = 0;
  for (const sym of corr.symbols) {
    labelW = Math.max(labelW, mctx.measureText(sym).width);
  }
  labelW = Math.ceil(labelW) + LABEL_PAD * 2;

  // Compute cell size to fill available width
  const available = maxWidth - labelW;
  const cellSize = Math.max(20, Math.min(40, Math.floor(available / n)));
  const headerH = Math.ceil(labelW * 0.72); // rotated labels need less vertical

  const w = labelW + n * cellSize;
  const h = headerH + n * cellSize;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.cssText = `width:${w}px; height:${h}px; display:block;`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);

  const fontSize = Math.max(9, Math.min(10, cellSize * 0.28));
  const valueFontSize = Math.max(9, Math.min(9, cellSize * 0.26));

  // Column headers (rotated)
  ctx.save();
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = "#3a3a3c";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  for (let j = 0; j < n; j++) {
    const x = labelW + j * cellSize + cellSize / 2;
    const y = headerH - 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.fillText(corr.symbols[j], 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // Row labels + cells
  const gap = 1;
  const rad = 2;
  for (let i = 0; i < n; i++) {
    const y = headerH + i * cellSize;

    // Row label
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = "#3a3a3c";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(corr.symbols[i], labelW - LABEL_PAD, y + cellSize / 2);

    for (let j = 0; j < n; j++) {
      const x = labelW + j * cellSize;
      const val = corr.matrix[i][j];

      ctx.fillStyle = getHeatmapColor(val);
      ctx.beginPath();
      ctx.roundRect(
        x + gap,
        y + gap,
        cellSize - gap * 2,
        cellSize - gap * 2,
        rad,
      );
      ctx.fill();

      ctx.font = `bold ${valueFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = Math.abs(val) > 0.5 ? "#fff" : "#1c1c1e";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(val.toFixed(2), x + cellSize / 2, y + cellSize / 2);
    }
  }

  return canvas;
}

// ── Public render ───────────────────────────────────────────────────────────

export function renderIVCorrelation(
  symbols: string[],
): HTMLElement & { cleanup?: () => void } {
  const panel = ui_createElement("div", {
    styleString: DS_COMPONENTS.panel + " margin-bottom: 0;",
  }) as HTMLElement & { cleanup?: () => void };

  // Compact header: title + summary on same line
  const header = ui_createElement("div", {
    styleString:
      "display:flex; align-items:baseline; gap:8px; margin-bottom:4px; flex-wrap:wrap;",
  });
  header.appendChild(
    ui_createElement("h3", {
      text: "IV Correlation",
      styleString:
        DS_TYPOGRAPHY.panelTitle + " margin-bottom:0; flex-shrink:0;",
    }),
  );
  const summaryEl = ui_createElement("span", {
    text: `${symbols.length} symbols`,
    styleString:
      "font-size:10px; color:var(--ios-text-secondary,#666); white-space:nowrap;",
  });
  header.appendChild(summaryEl);
  panel.appendChild(header);

  const contentSlot = ui_createElement("div", {
    styleString:
      "min-height: 40px; display: flex; align-items: center; justify-content: center;",
  });

  const loadBtn = ui_createElement("button", {
    text: "Load",
    styleString: DS_BUTTONS.primary + " padding: 6px 16px; font-size: 11px;",
    events: {
      click: async () => {
        loadBtn.textContent = "Loading\u2026";
        (loadBtn as HTMLButtonElement).disabled = true;
        try {
          const allHistory = await loadMultiSymbolHistory(symbols);
          const corr = computeCorrelation(allHistory);

          contentSlot.innerHTML = "";

          if (corr.symbols.length < 2) {
            contentSlot.appendChild(
              ui_createElement("div", {
                text: "Need 2+ symbols with IV history.",
                styleString:
                  "color:#999; font-size:11px; text-align:center; padding:12px;",
              }),
            );
            return;
          }

          // Summary stats
          const flatCorr = corr.matrix.flatMap((row, i) =>
            row.filter((_, j) => j > i),
          );
          const avgCorr =
            flatCorr.length > 0
              ? flatCorr.reduce((s, v) => s + v, 0) / flatCorr.length
              : 0;
          summaryEl.textContent = `${corr.symbols.length} sym \u00B7 avg ${avgCorr.toFixed(2)} \u00B7 ${flatCorr.length} pairs`;

          // Measure available width from panel
          const panelWidth = panel.clientWidth || 320;
          const padding = 24; // panel padding
          const canvas = renderCorrelationCanvas(corr, panelWidth - padding);
          contentSlot.appendChild(canvas);
        } catch (err) {
          contentSlot.innerHTML = "";
          contentSlot.appendChild(
            ui_createElement("div", {
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
              styleString:
                "color:red; font-size:11px; text-align:center; padding:12px;",
            }),
          );
        } finally {
          loadBtn.textContent = "Reload";
          (loadBtn as HTMLButtonElement).disabled = false;
        }
      },
    },
  });

  contentSlot.appendChild(loadBtn);
  panel.appendChild(contentSlot);

  panel.cleanup = () => {
    // No persistent resources to clean up for this static canvas panel
  };

  return panel;
}
