/**
 * PageShell — shared page-level layout container.
 *
 * Provides a consistent layout structure for section-based pages:
 *   header → sticky layers → content
 *
 * All zones share the same horizontal padding (`hPad`); sticky `top`
 * offsets are synchronised automatically via ResizeObserver.
 *
 * Pages that don't need sections (Holdings, Trade) can skip PageShell
 * and set their own wrapper padding.
 */

import { ui_createElement } from "../core/builders/createElement";

export type PageShellOptions = {
  /** Horizontal padding applied to every zone. Default `20`. */
  hPad?: number;
  /** Top padding for the header zone. Default `12`. */
  headerTopPad?: number;
  /** Bottom padding for the header zone. Default `10`. */
  headerBottomPad?: number;
  /** Bottom padding for the content zone. Default `20`. */
  contentBottomPad?: number;
};

export type StickyLayer = {
  /** The container element for this sticky layer (append your content here). */
  el: HTMLElement;
};

export type PageShellResult = {
  /** Root element — mount this in your view's container. */
  root: HTMLElement;
  /** Header zone — for page title, input bars, settings icon, etc. */
  header: HTMLElement;
  /**
   * Register a new sticky layer. Layers stack top-down in call order.
   * Returns a container; append your sticky component into it.
   * PageShell handles `position: sticky`, `top`, and `z-index`.
   */
  addStickyLayer: (zIndex?: number) => StickyLayer;
  /** Content zone — for section layout, grids, tables. */
  content: HTMLElement;
  /** Force re-sync of all sticky `top` offsets. */
  syncStickyTops: () => void;
  /** Cleanup ResizeObserver and listeners. */
  cleanup: () => void;
};

const Z_STICKY = [120, 110, 100, 90];

export function createPageShell(
  options: PageShellOptions = {},
): PageShellResult {
  const {
    hPad = 20,
    headerTopPad = 12,
    headerBottomPad = 10,
    contentBottomPad = 20,
  } = options;

  const cleanupFns: (() => void)[] = [];

  const root = ui_createElement("div", {
    className: "ax-page-shell",
    styleString:
      "display: flex; flex-direction: column; min-height: 0; width: 100%;",
  });

  const header = ui_createElement("div", {
    className: "ax-page-shell__header",
    styleString: `padding: ${headerTopPad}px ${hPad}px ${headerBottomPad}px;`,
  });
  root.appendChild(header);

  const stickyLayers: HTMLElement[] = [];

  function syncStickyTops(): void {
    let accum = 0;
    for (const layer of stickyLayers) {
      layer.style.top = `${accum}px`;
      // Measure rendered height (0 when display: none)
      const layerH =
        layer.getBoundingClientRect().height || layer.offsetHeight || 0;
      accum += Math.round(layerH);
    }
  }

  function addStickyLayer(zIndex?: number): StickyLayer {
    const idx = stickyLayers.length;
    const z = zIndex ?? Z_STICKY[idx] ?? 80;

    const layer = ui_createElement("div", {
      className: "ax-page-shell__sticky",
      styleString: `position: sticky; z-index: ${z}; padding: 0 ${hPad}px; background: var(--ax-bg, transparent);`,
    });

    stickyLayers.push(layer);
    root.insertBefore(layer, content);
    syncStickyTops();

    return { el: layer };
  }

  const content = ui_createElement("div", {
    className: "ax-page-shell__content",
    styleString: `padding: 0 ${hPad}px ${contentBottomPad}px; flex: 1; min-height: 0;`,
  });
  root.appendChild(content);

  // Re-sync when any sticky layer or root changes size
  const ro = new ResizeObserver(() => syncStickyTops());
  ro.observe(root);
  cleanupFns.push(() => ro.disconnect());

  const onResize = () => syncStickyTops();
  window.addEventListener("resize", onResize);
  cleanupFns.push(() => window.removeEventListener("resize", onResize));

  function cleanup(): void {
    for (const fn of cleanupFns) fn();
    cleanupFns.length = 0;
  }

  return { root, header, addStickyLayer, content, syncStickyTops, cleanup };
}
