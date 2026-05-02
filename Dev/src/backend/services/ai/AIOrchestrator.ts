import type { LLMClient } from "../../core/network/llm/LLMClient";
import type { DataFetcher } from "./pipeline/DataFetcher";
import type { AIAnalysisStore } from "../../core/db/ai/AIAnalysisStore";
import type { MemoryStore } from "../../core/db/ai/MemoryStore";
import type {
  AIAnalysisConfig,
  AIAnalysisPhase,
  AIAnalysisRecord,
  AIAnalysisState,
  AIProgressCallback,
  AIStreamCallback,
} from "./types";
import type { AIProviderKind } from "shared/types/core";
import { prepareBundle } from "./pipeline/prepareBundle";
import { runAnalystsPhase } from "./service/aiPhaseAnalysts";
import {
  runDebatePhase,
  runRiskPhase,
  runTraderPhase,
} from "./service/aiPhaseDebate";

// ── Per-phase LLM client map ─────────────────────────────────────────────────

export type PipelineClients = {
  analysts: LLMClient;
  debate: LLMClient;
  trader: LLMClient;
  risk: LLMClient;
};

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Thin coordinator. All phase logic lives in `service/aiPhase*.ts` and
 * `pipeline/prepareBundle.ts`; this class wires them together, owns the
 * AbortController, and drives the AIAnalysisRecord lifecycle.
 */
export class AIOrchestrator {
  private clients: PipelineClients;
  private fetcher: DataFetcher;
  private store: AIAnalysisStore;
  private memoryStore: MemoryStore | null;
  private cancelled = false;
  private abortController: AbortController | null = null;

  constructor(deps: {
    clients: PipelineClients;
    fetcher: DataFetcher;
    store: AIAnalysisStore;
    memoryStore?: MemoryStore;
  }) {
    this.clients = deps.clients;
    this.fetcher = deps.fetcher;
    this.store = deps.store;
    this.memoryStore = deps.memoryStore ?? null;
  }

  cancel(): void {
    this.cancelled = true;
    this.abortController?.abort();
  }

  async runPipeline(
    symbol: string,
    onProgress: AIProgressCallback,
    config: AIAnalysisConfig = {},
    onStream?: AIStreamCallback,
  ): Promise<AIAnalysisRecord> {
    this.cancelled = false;
    this.abortController = new AbortController();

    const {
      maxDebateRounds = 2,
      maxRiskRounds = 2,
      selectedAnalysts = [
        "market",
        "fundamentals",
        "sentiment_company",
        "sentiment_macro",
        "technicals",
        "financial_quality",
        "sellside",
        "ownership",
      ],
      enableMemory = true,
      enableToolCalling = true,
      maxToolIterations = 2,
      debateIntensity = "moderate",
      debateHeat,
      focusTopic,
      enableStreaming = false,
      enableWebSearch = false,
    } = config;

    const clampedDebateRounds = Math.max(2, Math.min(5, maxDebateRounds));
    const clampedRiskRounds = Math.max(1, Math.min(3, maxRiskRounds));

    const focusBlock = focusTopic
      ? `\n## INVESTOR FOCUS\nThe investor's specific interest: "${focusTopic}"\nWhile completing your standard analysis, pay special attention to how your findings relate to this specific interest. Address it directly in your output.\n\n`
      : "";

    const provider: AIProviderKind = this.clients.analysts.provider;
    const record: AIAnalysisRecord = {
      id: crypto.randomUUID(),
      symbol,
      ...(focusTopic ? { focusTopic } : {}),
      requestedAt: new Date().toISOString(),
      completedAt: null,
      status: "in_progress",
      provider,
      model: this.clients.analysts.model,
      marketData: null,
      stages: [],
      finalDecision: null,
      totalTokensUsed: 0,
      totalDurationMs: 0,
    };

    await this.store.save(record);

    const state: AIAnalysisState = {
      recordId: record.id,
      symbol,
      phase: "fetching_data",
      progress: 0,
      progressLabel: "Fetching market data...",
      stages: [],
      finalDecision: null,
      error: null,
      startedAt: Date.now(),
    };
    onProgress({ ...state });

    const streamCb = enableStreaming ? onStream : undefined;
    const signal = this.abortController.signal;

    try {
      // ── Phase 1: Fetch market data ────────────────────────────────────
      this.tick(state, "fetching_data", 5, "Fetching market data...", onProgress);
      const marketData = await this.fetcher.fetchMarketData(symbol);
      record.marketData = marketData;
      this.checkCancelled();

      // ── Bundle: memory + dq + features + tool executor ────────────────
      const bundle = await prepareBundle({
        symbol,
        marketData,
        fetcher: this.fetcher,
        memoryStore: this.memoryStore,
        enableMemory,
      });

      // ── Phase 2: Analysts (parallel) ──────────────────────────────────
      this.tick(
        state,
        "running_analysts",
        8,
        "Running analyst agents in parallel...",
        onProgress,
      );
      const { analystSummary } = await runAnalystsPhase({
        record,
        state,
        onProgress,
        bundle,
        focusBlock,
        selectedAnalysts,
        enableToolCalling,
        maxToolIterations,
        client: this.clients.analysts,
        streamCb,
        enableWebSearch,
        signal,
      });
      this.checkCancelled();

      // ── Phase 3: Bull/Bear debate + Research Manager ──────────────────
      this.tick(
        state,
        "running_debate",
        50,
        "Running bull/bear debate...",
        onProgress,
      );
      const { rmResult } = await runDebatePhase({
        record,
        state,
        onProgress,
        bundle,
        symbol,
        marketData,
        analystSummary,
        focusBlock,
        maxDebateRounds: clampedDebateRounds,
        debateIntensity,
        debateHeat,
        enableToolCalling,
        maxToolIterations,
        client: this.clients.debate,
        streamCb,
        signal,
      });

      // ── Phase 4: Trader ───────────────────────────────────────────────
      this.tick(
        state,
        "running_trader",
        68,
        "Trader synthesizing recommendation...",
        onProgress,
      );
      const traderResult = await runTraderPhase({
        record,
        state,
        onProgress,
        bundle,
        symbol,
        marketData,
        analystSummary,
        rmResult,
        focusBlock,
        client: this.clients.trader,
        streamCb,
        signal,
      });

      // ── Phase 5+6: Risk debate + Final decision ───────────────────────
      this.tick(
        state,
        "running_risk",
        75,
        "Running risk team debate...",
        onProgress,
      );
      const { finalDecision } = await runRiskPhase({
        record,
        state,
        onProgress,
        bundle,
        symbol,
        marketData,
        analystSummary,
        traderResult,
        focusBlock,
        maxRiskRounds: clampedRiskRounds,
        client: this.clients.risk,
        streamCb,
        signal,
      });
      this.tick(
        state,
        "finalizing",
        88,
        "Risk manager making final decision...",
        onProgress,
      );

      record.finalDecision = finalDecision;
      state.finalDecision = finalDecision;

      record.status = "completed";
      record.completedAt = new Date().toISOString();
      record.totalTokensUsed = record.stages.reduce(
        (s, r) => s + (r.tokensUsed ?? 0),
        0,
      );
      record.totalDurationMs = Date.now() - state.startedAt;
      await this.store.save(record);

      if (enableMemory && this.memoryStore) {
        try {
          await this.memoryStore.saveFromRecord(record);
        } catch {
          // non-critical
        }
      }

      this.tick(state, "complete", 100, "Analysis complete.", onProgress);
      return record;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      record.status = msg === "Cancelled" ? "cancelled" : "failed";
      record.errorMessage = msg;
      record.completedAt = new Date().toISOString();
      record.totalDurationMs = Date.now() - state.startedAt;
      try {
        await this.store.save(record);
      } catch {
        /* best effort */
      }
      state.phase = "error";
      state.error = msg;
      state.progress = 0;
      onProgress({ ...state });
      throw err;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private tick(
    state: AIAnalysisState,
    phase: AIAnalysisPhase,
    progress: number,
    label: string,
    onProgress: AIProgressCallback,
  ): void {
    state.phase = phase;
    state.progress = progress;
    state.progressLabel = label;
    onProgress({ ...state });
  }

  private checkCancelled(): void {
    if (this.cancelled) throw new Error("Cancelled");
  }
}
