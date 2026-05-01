/**
 * Shared scaffolding for heatmap panels (GEX / OI).
 *
 * Extracts the duplicated panel wrapper, header row with color legend,
 * scale slider, canvas layout, and resize-observer wiring that was
 * previously copy-pasted across GexHeatmap.ts and OIHeatmap.ts.
 */

import { ui_createElement } from "frontend/components/core/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY } from "frontend/components/core/theme";
import { getHeatmapColor } from "frontend/charts/ChartTheme";
import { clamp } from "shared/utils/math/numeric";
import { RANGE_SLIDER_STEPS } from "./heatmapCanvas";
import type { OpeningChartProfile } from "../chartProfiles";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HeatmapPanelScaffold<D> {
  /** The root panel element (has .cleanup and .update attached). */
  panel: HTMLElement & { cleanup?: () => void; update?: (d: D) => void };
  /** Header row element – append pill groups here. */
  headerRow: HTMLElement;
  /** Elements for the three-canvas layout. */
  canvases: {
    rowLabelCanvas: HTMLCanvasElement;
    matrixCanvas: HTMLCanvasElement;
    summaryCanvas: HTMLCanvasElement;
    scrollWrap: HTMLElement;
    heatmapContainer: HTMLElement;
  };
  /** Scale control state and helpers. */
  scale: ScaleController;
}

export interface ScaleController {
  /** Current symmetric half-range value. */
  getRange: () => number;
  /**
   * Sync the slider/readout to match a new data domain.
   * On first call the range is set to `absMax`; subsequent calls clamp
   * the existing range into the new domain.
   */
  syncDomain: (absMax: number) => void;
  /** Readout label elements for legend endpoints. */
  legendMinLabel: HTMLElement;
  legendMaxLabel: HTMLElement;
  /** Attach a listener so the consumer can rebuild on scale input. */
  onScaleInput: (handler: () => void) => void;
  /** Remove the scale input listener (called during cleanup). */
  removeScaleInput: () => void;
}

// ── Builder ──────────────────────────────────────────────────────────────────

export function buildHeatmapPanelScaffold<D>(opts: {
  profile: OpeningChartProfile;
  formatScaleValue: (v: number) => string;
}): HeatmapPanelScaffold<D> {
  const { profile, formatScaleValue } = opts;

  const panelStyle =
    DS_COMPONENTS.panel +
    ` width: ${profile.canvas.width ?? "100%"};` +
    (profile.canvas.minHeight
      ? ` min-height: ${profile.canvas.minHeight};`
      : "");
  const titleStyle = DS_TYPOGRAPHY.panelTitle;

  // ── Panel ──────────────────────────────────────────────────────────────
  const panel = ui_createElement("div", {
    styleString: panelStyle,
  }) as HTMLElement & { cleanup?: () => void; update?: (d: D) => void };

  // ── Header row ─────────────────────────────────────────────────────────
  const headerRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap;",
  });
  headerRow.appendChild(
    ui_createElement("h3", {
      text: profile.title,
      styleString: titleStyle + " margin-bottom: 0; flex-shrink: 0;",
    }),
  );
  headerRow.appendChild(
    ui_createElement("div", { styleString: "flex: 1;" }),
  );

  // ── Color legend bar ───────────────────────────────────────────────────
  const HORIZ_GRADIENT = `linear-gradient(to right, ${[
    { stop: 0, value: -1 },
    { stop: 25, value: -0.5 },
    { stop: 50, value: 0 },
    { stop: 75, value: 0.5 },
    { stop: 100, value: 1 },
  ]
    .map((p) => `${getHeatmapColor(p.value)} ${p.stop}%`)
    .join(", ")})`;

  const colorBarGroup = ui_createElement("div", {
    styleString: "display: flex; align-items: center; gap: 4px;",
  });
  const legendMinLabel = ui_createElement("span", {
    text: "\u2212",
    styleString:
      "font-size: 10px; font-weight: 600; color: var(--ios-text-secondary, #666); line-height: 1;",
  });
  const legendBar = ui_createElement("div", {
    styleString:
      `height: 10px; width: 120px; border-radius: 5px;` +
      ` border: 1px solid var(--ax-border); background: ${HORIZ_GRADIENT};`,
  });
  const legendMaxLabel = ui_createElement("span", {
    text: "+",
    styleString:
      "font-size: 10px; font-weight: 600; color: var(--ios-text-secondary, #666); line-height: 1;",
  });
  colorBarGroup.appendChild(legendMinLabel);
  colorBarGroup.appendChild(legendBar);
  colorBarGroup.appendChild(legendMaxLabel);

  const scaleSlider = document.createElement("input");
  scaleSlider.type = "range";
  scaleSlider.style.cssText =
    "width: 80px; accent-color: #007AFF; transform: scale(0.85);";
  scaleSlider.setAttribute("aria-label", "Color scale range");

  const scaleReadout = ui_createElement("span", {
    text: "\u00B1--",
    styleString:
      "font-size: 10px; font-weight: 600; color: var(--ios-text-secondary, #666); white-space: nowrap;",
  });

  const colorScaleGroup = ui_createElement("div", {
    styleString: "display: flex; align-items: center; gap: 6px;",
  });
  colorScaleGroup.appendChild(colorBarGroup);
  colorScaleGroup.appendChild(scaleSlider);
  colorScaleGroup.appendChild(scaleReadout);
  headerRow.appendChild(colorScaleGroup);

  panel.appendChild(headerRow);

  // ── Canvas layout ──────────────────────────────────────────────────────
  const heatmapContainer = ui_createElement("div", {
    styleString:
      "display: flex; overflow: hidden; align-items: flex-start; width: 100%;" +
      (profile.canvas.minHeight
        ? ` min-height: ${profile.canvas.minHeight};`
        : ""),
  });

  const rowLabelCanvas = document.createElement("canvas");
  rowLabelCanvas.style.cssText = "flex-shrink: 0; position: relative;";
  const rowLabelWrap = ui_createElement("div", {
    styleString: "flex-shrink: 0; position: relative;",
  });
  rowLabelWrap.appendChild(rowLabelCanvas);
  rowLabelWrap.appendChild(
    ui_createElement("div", {
      styleString:
        "position: absolute; top: 0; right: -12px; width: 12px; height: 100%;" +
        " background: var(--ax-bg-sticky-shadow);" +
        " pointer-events: none; z-index: 1;",
    }),
  );
  heatmapContainer.appendChild(rowLabelWrap);

  const scrollWrap = ui_createElement("div", {
    styleString:
      "overflow-x: auto; overflow-y: hidden; flex: 1; min-width: 0;",
  });
  const matrixCanvas = document.createElement("canvas");
  scrollWrap.appendChild(matrixCanvas);
  heatmapContainer.appendChild(scrollWrap);

  const summaryCanvas = document.createElement("canvas");
  const summaryWrap = ui_createElement("div", {
    styleString: "flex-shrink: 0; position: relative;",
  });
  summaryWrap.appendChild(
    ui_createElement("div", {
      styleString:
        "position: absolute; top: 0; left: -12px; width: 12px; height: 100%;" +
        " background: var(--ax-bg-sticky-shadow-reverse);" +
        " pointer-events: none; z-index: 1;",
    }),
  );
  summaryWrap.appendChild(summaryCanvas);
  heatmapContainer.appendChild(summaryWrap);

  // ── Scale controller ───────────────────────────────────────────────────
  let scaleAbsDomain = 1;
  let scaleRange = 1;
  let scaleInitialized = false;
  let syncingScale = false;
  let scaleInputHandler: (() => void) | null = null;

  function updateScaleReadout(): void {
    scaleReadout.textContent = `\u00B1${formatScaleValue(scaleRange)}`;
    legendMaxLabel.textContent = `+${formatScaleValue(scaleRange)}`;
    legendMinLabel.textContent = formatScaleValue(-scaleRange);
  }

  function syncDomain(absMax: number): void {
    scaleAbsDomain = Math.max(absMax, 1);
    if (!scaleInitialized) {
      scaleRange = scaleAbsDomain;
      scaleInitialized = true;
    } else {
      scaleRange = clamp(scaleRange, scaleAbsDomain * 0.01, scaleAbsDomain);
    }
    const step = Math.max(scaleAbsDomain / RANGE_SLIDER_STEPS, 0.001);
    syncingScale = true;
    scaleSlider.min = String(step);
    scaleSlider.max = String(scaleAbsDomain);
    scaleSlider.step = String(step);
    scaleSlider.value = String(scaleRange);
    syncingScale = false;
    updateScaleReadout();
  }

  const internalHandler = () => {
    if (syncingScale) return;
    scaleRange = clamp(
      Number(scaleSlider.value),
      scaleAbsDomain * 0.01,
      scaleAbsDomain,
    );
    updateScaleReadout();
    scaleInputHandler?.();
  };
  scaleSlider.addEventListener("input", internalHandler);

  const scale: ScaleController = {
    getRange: () => scaleRange,
    syncDomain,
    legendMinLabel,
    legendMaxLabel,
    onScaleInput: (handler) => {
      scaleInputHandler = handler;
    },
    removeScaleInput: () => {
      scaleSlider.removeEventListener("input", internalHandler);
    },
  };

  return {
    panel,
    headerRow,
    canvases: {
      rowLabelCanvas,
      matrixCanvas,
      summaryCanvas,
      scrollWrap,
      heatmapContainer,
    },
    scale,
  };
}

// ── Resize observer helper ───────────────────────────────────────────────────

export function attachHeatmapResizeObserver(
  target: HTMLElement,
  onResize: () => void,
): { disconnect: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new ResizeObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onResize, 150);
  });
  observer.observe(target);
  return {
    disconnect: () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    },
  };
}
