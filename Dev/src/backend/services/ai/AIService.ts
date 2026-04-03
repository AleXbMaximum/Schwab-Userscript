import { AIOrchestrator } from "./AIOrchestrator";
import type { PipelineClients } from "./AIOrchestrator";
import type { DataFetcher } from "./pipeline/DataFetcher";
import type { AIAnalysisStore } from "../../core/db/ai/AIAnalysisStore";
import type { MemoryStore } from "../../core/db/ai/MemoryStore";
import type {
  AIAnalysisConfig,
  AIAnalysisRecord,
  AIAnalysisState,
  AIProgressCallback,
  AIStreamCallback,
} from "./types";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("ai");

export type AIServiceDeps = {
  clients: PipelineClients;
  fetcher: DataFetcher;
  store: AIAnalysisStore;
  memoryStore: MemoryStore;
};

class AIService {
  private orchestrator: AIOrchestrator | null = null;
  private _isRunning = false;
  private currentState: AIAnalysisState | null = null;
  private lastRecord: AIAnalysisRecord | null = null;
  private listeners = new Set<AIProgressCallback>();
  private streamListeners = new Set<AIStreamCallback>();

  /** Subscribe to state updates and replay the current in-progress state. */
  subscribe(listener: AIProgressCallback): () => void {
    this.listeners.add(listener);
    if (this.currentState) {
      listener(this.currentState);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Subscribe to streaming token events (text, thinking, annotations). */
  subscribeStream(listener: AIStreamCallback): () => void {
    this.streamListeners.add(listener);
    return () => {
      this.streamListeners.delete(listener);
    };
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  getLastRecord(): AIAnalysisRecord | null {
    return this.lastRecord;
  }

  getState(): AIAnalysisState | null {
    return this.currentState;
  }

  /** Start a new analysis run. Throws if another run is already active. */
  async run(
    symbol: string,
    config: AIAnalysisConfig,
    deps: AIServiceDeps,
  ): Promise<AIAnalysisRecord> {
    if (this._isRunning) {
      throw new Error("An analysis is already in progress. Cancel it first.");
    }

    log.info("analysis.start", { symbol });

    this.orchestrator = new AIOrchestrator({
      clients: deps.clients,
      fetcher: deps.fetcher,
      store: deps.store,
      memoryStore: deps.memoryStore,
    });
    this._isRunning = true;
    this.currentState = null;

    try {
      const record = await this.orchestrator.runPipeline(
        symbol,
        (state) => {
          this.currentState = state;
          this.listeners.forEach((fn) => fn(state));
        },
        config,
        // Forward stream events to all stream listeners
        (event) => {
          this.streamListeners.forEach((fn) => {
            try {
              fn(event);
            } catch {
              /* listener error must not break other listeners */
            }
          });
        },
      );
      this.lastRecord = record;
      log.info("analysis.done", {
        symbol,
        tokensUsed: record.totalTokensUsed,
      });
      return record;
    } catch (err) {
      log.error("analysis.fail", {
        symbol,
        error: (err as Error)?.message ?? String(err),
      });
      throw err;
    } finally {
      this._isRunning = false;
      this.orchestrator = null;
    }
  }

  cancel(): void {
    if (this.orchestrator) {
      log.info("analysis.cancel");
    }
    this.orchestrator?.cancel();
  }

  reset(): void {
    this.cancel();
    this.currentState = null;
    this.lastRecord = null;
    log.debug("analysis.reset");
  }
}

export const aiService = new AIService();
