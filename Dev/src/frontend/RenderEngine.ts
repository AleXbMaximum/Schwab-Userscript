import { holdings_renderPage } from "./trade_holdings/page";
import { riskManagement_renderPage } from "./trade_portfolio/page";
import { options_renderPage } from "./analysis_options/page";
import { optionFlow_renderPage } from "./analysis_optionFlow/page";
import { aiAnalysis_renderPage } from "./analysis_ai/page";
import { news_renderPage } from "./news_page/page";
import { analysisVisualize_renderPage } from "./analysis_visualize/page";
import { logService } from "../shared/log/core/LogService";
import { getLayoutMode } from "./components/core/behaviors/layoutMode";

const log = logService.namespace("render");

export type ViewName =
  | "HOLDINGS"
  | "PORTFOLIO"
  | "VISUALIZE"
  | "OPTIONS"
  | "OPTION_FLOW"
  | "AI_ANALYSIS"
  | "NEWS"
  | (string & {});

export type ViewContainer = HTMLElement & {
  cleanup?: () => void;
  /**
   * Optional snapshot hook. When a persistent view is hidden, the engine
   * calls `getState()` and caches the return value. On the next view-in,
   * the cached value is exposed via `viewCtx.restoredViewState` so the
   * renderer can re-hydrate.
   */
  getState?: () => unknown;
};

export type UIElements = {
  indicesContainer?: HTMLElement | null;
  totalsContainer?: HTMLElement | null;
  [key: string]: unknown;
};

type PersistentEntry = {
  container: ViewContainer | null;
  capturedState: unknown;
};

export class RenderEngine<
  Ctx extends Record<string, unknown> = Record<string, unknown>,
> {
  private contentContainer: HTMLElement;
  private ctx: Ctx;
  private uiElements: UIElements;
  private viewCtx: Record<string, unknown>;
  private currentView: ViewName | null;
  private currentContainer: ViewContainer | null;
  /** Views registered as persistent: rendered once, hidden when inactive. */
  private persistentViews = new Map<ViewName, PersistentEntry>();
  private disposed = false;

  constructor(contentContainer: HTMLElement, ctx: Ctx, uiElements: UIElements) {
    this.contentContainer = contentContainer;
    this.ctx = ctx;
    this.uiElements = uiElements;
    this.viewCtx = {
      ...(this.ctx as Record<string, unknown>),
      ...(this.uiElements as Record<string, unknown>),
      layoutMode: getLayoutMode(),
    };
    this.currentView = null;
    this.currentContainer = null;
  }

  /**
   * Mark a view as persistent: it is rendered once on first activation and
   * hidden (`display: none`) on subsequent view-outs instead of being
   * unmounted. The view's optional `getState()` hook is called on view-out
   * and the result is exposed via `viewCtx.restoredViewState` on view-in.
   */
  registerPersistentView(viewName: ViewName): void {
    if (!this.persistentViews.has(viewName)) {
      this.persistentViews.set(viewName, {
        container: null,
        capturedState: undefined,
      });
    }
  }

  changeView(viewName: ViewName): void {
    if (this.disposed) return;
    if (this.currentView === viewName) return;

    const previousView = this.currentView;
    const previousContainer = this.currentContainer;

    // ── 1. Tear down or hide the previous view ──────────────────────────
    if (previousContainer) {
      const prevEntry = previousView
        ? this.persistentViews.get(previousView)
        : undefined;
      if (prevEntry) {
        try {
          if (typeof previousContainer.getState === "function") {
            prevEntry.capturedState = previousContainer.getState();
          }
        } catch (e) {
          log.warn("view.getState.error", {
            view: previousView,
            error: (e as Error)?.message ?? String(e),
          });
        }
        previousContainer.style.display = "none";
      } else {
        if (typeof previousContainer.cleanup === "function") {
          try {
            previousContainer.cleanup();
          } catch (e) {
            log.warn("view.cleanup.error", {
              view: previousView,
              error: (e as Error)?.message ?? String(e),
            });
          }
        }
        previousContainer.remove();
      }
    }

    this.currentView = viewName;
    log.info("view.changed", { from: previousView, to: viewName });

    Object.assign(this.viewCtx, this.uiElements as Record<string, unknown>);

    // ── 2. Resolve target container ─────────────────────────────────────
    const persistent = this.persistentViews.get(viewName);
    let target: ViewContainer;

    if (persistent && persistent.container) {
      target = persistent.container;
      target.style.display = "";
    } else {
      // First activation (persistent or non-persistent): render fresh.
      // Inject any captured state into viewCtx for the renderer to consume.
      this.viewCtx.restoredViewState = persistent?.capturedState ?? null;
      target = this.renderView(viewName);
      this.viewCtx.restoredViewState = null;
      if (persistent) {
        persistent.container = target;
      }
    }

    this.currentContainer = target;
    if (target.parentNode !== this.contentContainer) {
      this.contentContainer.appendChild(target);
    }
  }

  updateContext(
    newCtx: Partial<Ctx> & Record<string, unknown>,
    options: { rerender?: boolean } = {},
  ): void {
    if (this.disposed) return;
    const { rerender = true } = options;

    this.ctx = { ...(this.ctx as Record<string, unknown>), ...newCtx } as Ctx;
    Object.assign(this.viewCtx, newCtx);

    if (!this.currentView) return;
    if (!rerender) return;

    const view = this.currentView;
    // Force a fresh render. For persistent views, drop the cached container
    // so renderView() rebuilds from current ctx.
    const persistent = this.persistentViews.get(view);
    if (persistent && persistent.container) {
      const old = persistent.container;
      if (typeof old.cleanup === "function") {
        try {
          old.cleanup();
        } catch {
          /* swallow */
        }
      }
      old.remove();
      persistent.container = null;
    }
    this.currentView = null;
    this.changeView(view);
  }

  /** Tear down the current view + every persistent view. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (
      this.currentContainer &&
      !this.isContainerOwnedByPersistent(this.currentContainer)
    ) {
      this.tryCleanup(this.currentContainer);
      this.currentContainer.remove();
    }
    this.currentContainer = null;
    this.currentView = null;

    for (const [, entry] of this.persistentViews) {
      if (entry.container) {
        this.tryCleanup(entry.container);
        entry.container.remove();
        entry.container = null;
      }
      entry.capturedState = undefined;
    }
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private renderView(viewName: ViewName): ViewContainer {
    const ctx = this.viewCtx as any;
    switch (viewName) {
      case "HOLDINGS":
        return holdings_renderPage(ctx) as ViewContainer;
      case "PORTFOLIO":
        return riskManagement_renderPage(ctx) as ViewContainer;
      case "VISUALIZE":
        return analysisVisualize_renderPage(ctx) as ViewContainer;
      case "OPTIONS":
        return options_renderPage(ctx) as ViewContainer;
      case "OPTION_FLOW":
        return optionFlow_renderPage(ctx) as ViewContainer;
      case "AI_ANALYSIS":
        return aiAnalysis_renderPage(ctx) as ViewContainer;
      case "NEWS":
        return news_renderPage(ctx) as ViewContainer;
      default: {
        const fallback = document.createElement("div") as ViewContainer;
        fallback.textContent = "Unknown View";
        return fallback;
      }
    }
  }

  private isContainerOwnedByPersistent(container: ViewContainer): boolean {
    for (const entry of this.persistentViews.values()) {
      if (entry.container === container) return true;
    }
    return false;
  }

  private tryCleanup(container: ViewContainer): void {
    if (typeof container.cleanup === "function") {
      try {
        container.cleanup();
      } catch (e) {
        log.warn("view.cleanup.error", {
          error: (e as Error)?.message ?? String(e),
        });
      }
    }
  }
}
