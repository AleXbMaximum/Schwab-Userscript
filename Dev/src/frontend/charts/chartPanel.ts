/**
 * Chart Panel Framework
 *
 * Standardized 4-zone panel layout for chart components:
 *   Zone 1: Header (title + description) — flex-shrink: 0
 *   Zone 2: Controls (optional: tabs, pills, mode buttons) — flex-shrink: 0
 *   Zone 3: Info (optional: metric badges, summary cards) — flex-shrink: 0
 *   Zone 4: Canvas — flex: 1, fills remaining height
 *
 * The panel uses `display: flex; flex-direction: column; height: 100%` so it
 * fills its grid slot. The canvas wrapper takes all remaining vertical space.
 */

import { ui_createElement } from "../components/core/builders/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY } from "../components/core/styles/theme";
import { chartManager } from "./ChartManager";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChartPanelConfig<TData> {
  title: string;
  description?: string;
  /** Zone 2: built once at creation, not rebuilt on update. */
  controls?: HTMLElement;
  /** Zone 3: rebuilt on each update call. Return null to hide. */
  buildInfo?: (data: TData) => HTMLElement | null;
  /** Zone 4: build a Chart.js config from current data. */
  buildChartConfig: (data: TData) => any;
  /** Destroy and recreate the chart on each update (needed for mode switches). */
  destroyOnUpdate?: boolean;
  /** Extra content appended after the canvas (e.g., collapsible tables). */
  footer?: HTMLElement;
}

export interface ChartPanelResult<TData> extends HTMLElement {
  update?: (data: TData) => void;
  cleanup?: () => void;
  /** Direct access to the canvas element for plugins or custom overlays. */
  canvas: HTMLCanvasElement;
}

// ── Legacy types (kept for backward compatibility with optionFlow) ──────────

export interface ChartPanelCanvasLayout {
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
}

export interface LegacyChartPanelConfig<TData> {
  title: string;
  description?: string;
  canvasLayout?: ChartPanelCanvasLayout;
  headerContent?: HTMLElement;
  destroyOnUpdate?: boolean;
  buildConfig: (data: TData) => any;
}

// ── Panel style ─────────────────────────────────────────────────────────────

const PANEL_STYLE =
  DS_COMPONENTS.panel +
  " display: flex; flex-direction: column; height: 100%; overflow: hidden;";

const CANVAS_WRAP_STYLE =
  "position: relative; flex: 1 1 0; min-height: 0; overflow: hidden;";

const CANVAS_STYLE = "position: absolute; inset: 0; width: 100%; height: 100%;";

// ── Main API ────────────────────────────────────────────────────────────────

export function createChartPanel<TData>(
  config: ChartPanelConfig<TData>,
  initialData: TData,
): ChartPanelResult<TData> {
  const panel = ui_createElement("div", {
    styleString: PANEL_STYLE,
  }) as ChartPanelResult<TData>;

  // Zone 1: Header
  panel.appendChild(
    ui_createElement("h3", {
      text: config.title,
      styleString: DS_TYPOGRAPHY.panelTitle + " flex-shrink: 0;",
    }),
  );

  if (config.description) {
    panel.appendChild(
      ui_createElement("div", {
        text: config.description,
        styleString: DS_TYPOGRAPHY.panelDesc + " flex-shrink: 0;",
      }),
    );
  }

  // Zone 2: Controls (static, built once)
  if (config.controls) {
    config.controls.style.flexShrink = "0";
    panel.appendChild(config.controls);
  }

  // Zone 3: Info (dynamic, rebuilt on update)
  const infoSlot = ui_createElement("div", {
    styleString: "flex-shrink: 0;",
  });
  panel.appendChild(infoSlot);

  // Zone 4: Canvas
  const canvasWrap = document.createElement("div");
  canvasWrap.style.cssText = CANVAS_WRAP_STYLE;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = CANVAS_STYLE;
  canvasWrap.appendChild(canvas);
  panel.appendChild(canvasWrap);
  panel.canvas = canvas;

  // Footer (optional)
  if (config.footer) {
    config.footer.style.flexShrink = "0";
    panel.appendChild(config.footer);
  }

  // ── Render logic ────────────────────────────────────────────────────────

  let currentData = initialData;

  const render = () => {
    // Update info zone
    if (config.buildInfo) {
      infoSlot.innerHTML = "";
      const infoEl = config.buildInfo(currentData);
      if (infoEl) infoSlot.appendChild(infoEl);
    }

    // Update chart
    const chartConfig = config.buildChartConfig(currentData);
    if (config.destroyOnUpdate) chartManager.destroy(canvas);
    chartManager.createOrUpdate(canvas, chartConfig);
  };

  render();

  panel.update = (data: TData) => {
    currentData = data;
    render();
  };

  panel.cleanup = () => chartManager.destroy(canvas);

  return panel;
}

// ── Legacy API (backward compatible with optionFlow charts) ─────────────────

function buildLegacyCanvasStyle(layout?: ChartPanelCanvasLayout): string {
  const resolved: ChartPanelCanvasLayout = {
    width: "100%",
    height: layout?.height ?? "clamp(180px, 36vh, 260px)",
    maxHeight: layout?.maxHeight,
    minHeight: layout?.minHeight,
    minWidth: layout?.minWidth,
    maxWidth: layout?.maxWidth,
  };

  const styleParts = ["display: block;"];

  if (resolved.width) styleParts.push(`width: ${resolved.width};`);
  if (resolved.minWidth) styleParts.push(`min-width: ${resolved.minWidth};`);
  if (resolved.maxWidth) styleParts.push(`max-width: ${resolved.maxWidth};`);
  if (resolved.height) styleParts.push(`height: ${resolved.height};`);
  if (resolved.minHeight) styleParts.push(`min-height: ${resolved.minHeight};`);
  if (resolved.maxHeight) styleParts.push(`max-height: ${resolved.maxHeight};`);

  return styleParts.join(" ");
}

export function createLegacyChartPanel<TData>(
  config: LegacyChartPanelConfig<TData>,
  initialData: TData,
): ChartPanelResult<TData> {
  const panelStyle = DS_COMPONENTS.panel;

  const panel = ui_createElement("div", {
    styleString: panelStyle,
  }) as ChartPanelResult<TData>;

  panel.appendChild(
    ui_createElement("h3", {
      text: config.title,
      styleString: config.headerContent
        ? DS_TYPOGRAPHY.panelTitle + " margin-bottom: 0; flex-shrink: 0;"
        : DS_TYPOGRAPHY.panelTitle,
    }),
  );

  if (config.description) {
    panel.appendChild(
      ui_createElement("div", {
        text: config.description,
        styleString: DS_TYPOGRAPHY.panelDesc,
      }),
    );
  }

  if (config.headerContent) {
    panel.appendChild(config.headerContent);
  }

  const canvasWrap = document.createElement("div");
  canvasWrap.style.cssText =
    "position: relative;" + buildLegacyCanvasStyle(config.canvasLayout);
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position: absolute; inset: 0; width: 100%; height: 100%;";
  canvasWrap.appendChild(canvas);
  panel.appendChild(canvasWrap);
  panel.canvas = canvas;

  let currentData = initialData;

  const render = () => {
    const chartConfig = config.buildConfig(currentData);
    if (config.destroyOnUpdate) chartManager.destroy(canvas);
    chartManager.createOrUpdate(canvas, chartConfig);
  };

  render();

  panel.update = (data: TData) => {
    currentData = data;
    render();
  };

  panel.cleanup = () => chartManager.destroy(canvas);

  return panel;
}
