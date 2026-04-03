import type { Logger } from "shared/log/Logger";
import { newsService } from "./NewsService";

// Bridges holdings symbol scope into the shared NewsService lifecycle.
export class NewsLifecycleCoordinator {
  private readonly logger: Logger;
  private started = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  start(initialSymbols: string[]): void {
    if (this.started) {
      newsService.updateSymbols(initialSymbols);
      return;
    }
    this.started = true;
    newsService.start(initialSymbols);
    this.logger.info("started", { symbolCount: initialSymbols.length });
  }

  stop(): void {
    if (!this.started) return;
    newsService.stop();
    this.started = false;
    this.logger.info("stopped");
  }

  handleSymbolDelta(delta: { all: string[] }): void {
    if (!this.started) {
      this.start(delta.all);
      return;
    }
    newsService.updateSymbols(delta.all);
  }
}
