import { holdings_renderPage } from "./trade_holdings/page";
import { riskManagement_renderPage } from "./trade_portfolio/page";
import { options_renderPage } from "./analysis_options/page";
import { optionFlow_renderPage } from "./analysis_optionFlow/page";
import { aiAnalysis_renderPage } from "./analysis_ai/page";
import { news_renderPage } from "./news_page/page";
import { analysisVisualize_renderPage } from "./analysis_visualize/page";
import { logService } from "../shared/log/core/LogService";
import { getLayoutMode } from "./components/core/layoutMode";

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

export type ViewContainer = HTMLElement & { cleanup?: () => void };

export type UIElements = {
  indicesContainer?: HTMLElement | null;
  totalsContainer?: HTMLElement | null;
  [key: string]: unknown;
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

  changeView(viewName: ViewName): void {
    if (this.currentView === viewName) return;

    const previousView = this.currentView;
    if (
      this.currentContainer &&
      typeof this.currentContainer.cleanup === "function"
    ) {
      this.currentContainer.cleanup();
    }

    this.contentContainer.innerHTML = "";
    this.currentView = viewName;
    log.info("view.changed", { from: previousView, to: viewName });

    let newContent: ViewContainer;

    Object.assign(this.viewCtx, this.uiElements as Record<string, unknown>);

    switch (viewName) {
      case "HOLDINGS":
        newContent = holdings_renderPage(this.viewCtx as any) as ViewContainer;
        break;
      case "PORTFOLIO":
        newContent = riskManagement_renderPage(
          this.viewCtx as any,
        ) as ViewContainer;
        break;
      case "VISUALIZE":
        newContent = analysisVisualize_renderPage(this.viewCtx as any) as ViewContainer;
        break;
      case "OPTIONS":
        newContent = options_renderPage(this.viewCtx as any) as ViewContainer;
        break;
      case "OPTION_FLOW":
        newContent = optionFlow_renderPage(this.viewCtx as any) as ViewContainer;
        break;
      case "AI_ANALYSIS":
        newContent = aiAnalysis_renderPage(
          this.viewCtx as any,
        ) as ViewContainer;
        break;
      case "NEWS":
        newContent = news_renderPage(this.viewCtx as any) as ViewContainer;
        break;
      default:
        newContent = document.createElement("div") as ViewContainer;
        newContent.textContent = "Unknown View";
    }

    this.currentContainer = newContent;
    this.contentContainer.appendChild(newContent);
  }

  updateContext(
    newCtx: Partial<Ctx> & Record<string, unknown>,
    options: { rerender?: boolean } = {},
  ): void {
    const { rerender = true } = options;

    this.ctx = { ...(this.ctx as Record<string, unknown>), ...newCtx } as Ctx;
    Object.assign(this.viewCtx, newCtx);

    if (!this.currentView) return;

    if (!rerender) return;

    const view = this.currentView;
    this.currentView = null;
    this.changeView(view);
  }
}
