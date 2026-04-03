import type { LLMClient } from "../../core/network/llm/LLMClient";
import type { DataFetcher } from "./pipeline/DataFetcher";
import type { AIAnalysisStore } from "../../core/db/ai/AIAnalysisStore";
import type { MemoryStore } from "../../core/db/ai/MemoryStore";
import type {
  AIAgentRole,
  AIAnalysisConfig,
  AIAnalysisPhase,
  AIAnalysisRecord,
  AIAnalysisState,
  AIProgressCallback,
  AIStageResult,
  AIStreamCallback,
  AIToolName,
  Citation,
  LLMMessage,
} from "./types";
import { PROMPTS } from "./prompts/prompts";
import { computeOHLCVFeatures } from "./pipeline/technicals";
import {
  validateAndFlag,
  formatDataQualityBlock,
} from "./pipeline/dataPreprocessing";
import type { AIProviderKind } from "shared/types/core";

import {
  fmt,
  formatMemoryContext,
  formatOHLCVFeatures,
} from "./pipeline/formatters";
import { buildToolExecutor } from "./tools/toolExecutor";
import { buildAnalystsContext } from "./pipeline/contextBuilders";
import {
  evaluateDataCompleteness,
  parseContinueDebate,
  parseRiskManagerDecision,
  parseSummaryJSON,
  parseToolCall,
  stripSummaryJSON,
  stripToolCallTag,
} from "./pipeline/parsers";
import { summarizeAnalystsWithJSON } from "./pipeline/summarizers";

// ── Per-phase LLM client map ─────────────────────────────────────────────────

export type PipelineClients = {
  analysts: LLMClient;
  debate: LLMClient;
  trader: LLMClient;
  risk: LLMClient;
};

// ── Orchestrator ──────────────────────────────────────────────────────────────

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

    // Build focus block — injected into every agent's user context when present
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

    // Resolve streaming params for agent runner
    const streamCb = enableStreaming ? onStream : undefined;
    const signal = this.abortController.signal;

    try {
      // ── Phase 1: Fetch market data ────────────────────────────────────
      this.tick(
        state,
        "fetching_data",
        5,
        "Fetching market data...",
        onProgress,
      );
      const marketData = await this.fetcher.fetchMarketData(symbol);
      record.marketData = marketData;
      this.checkCancelled();

      // ── Load memory context ───────────────────────────────────────────
      let memoryCtx = "";
      if (enableMemory && this.memoryStore) {
        try {
          const memories = await this.memoryStore.getRecentForSymbol(symbol, 3);
          if (memories.length > 0) memoryCtx = formatMemoryContext(memories);
        } catch {
          // non-critical
        }
      }

      const ctx = buildAnalystsContext(symbol, marketData);

      // ── Data quality gate ─────────────────────────────────────────────
      const dataQuality = validateAndFlag(marketData);
      const dqBlock = formatDataQualityBlock(dataQuality);

      // Data integrity gate for missing fundamentals/statement inputs
      const dataCompleteness = evaluateDataCompleteness(marketData);
      const dataWarningBlock = dataCompleteness.criticalMissing
        ? `\n## DATA_INTEGRITY_WARNING\nCritical fundamentals missing: ${dataCompleteness.missingFields.join(", ")}. No financial statements available. Output only a DATA_GAP block — do not write narrative.\n\n`
        : dataCompleteness.missingFields.length > 0
          ? `\n## DATA_NOTE\nPartially missing fields: ${dataCompleteness.missingFields.join(", ")}. Note gaps inline and continue analysis.\n\n`
          : "";

      // ── OHLCV feature builder (suggestion 3) ────────────────────────
      const ohlcvFeatures = computeOHLCVFeatures(marketData.ohlcv90d);
      const featureCtx = formatOHLCVFeatures(
        ohlcvFeatures,
        marketData.currentPrice,
      );

      // Build tool executor that uses pre-fetched bundle data first
      const toolExecutor = buildToolExecutor(symbol, marketData, this.fetcher);

      // ── Phase 2: Run selected analysts in parallel (8 agents) ───────
      this.tick(
        state,
        "running_analysts",
        8,
        "Running analyst agents in parallel...",
        onProgress,
      );

      const analystMap: Array<[string, AIAgentRole, string, number]> = [
        ["market", "market_analyst", dqBlock + ctx.market, 12],
        [
          "technicals",
          "technicals_analyst",
          dqBlock + featureCtx + "\n\n" + ctx.technicals,
          16,
        ],
        [
          "fundamentals",
          "fundamentals_analyst",
          dqBlock + dataWarningBlock + ctx.fundamentals,
          20,
        ],
        [
          "financial_quality",
          "financial_quality_analyst",
          dqBlock + dataWarningBlock + ctx.financialQuality,
          24,
        ],
        [
          "sentiment_company",
          "sentiment_company",
          dqBlock + ctx.sentimentCompany,
          28,
        ],
        [
          "sentiment_macro",
          "sentiment_macro",
          dqBlock + ctx.sentimentMacro,
          32,
        ],
        ["sellside", "sellside_analyst", dqBlock + ctx.sellside, 36],
        ["ownership", "ownership_analyst", dqBlock + ctx.ownership, 40],
      ];

      const analystPromises = analystMap
        .filter(([key]) => selectedAnalysts.includes(key as any))
        .map(([key, role, ctxText, pct]) =>
          this.runAgentWithTools(
            record,
            state,
            onProgress,
            role as AIAgentRole,
            undefined,
            PROMPTS[role as keyof typeof PROMPTS] as string,
            focusBlock + memoryCtx + ctxText,
            pct,
            enableToolCalling,
            toolExecutor,
            // Fundamentals and financial quality get extra tool iterations
            key === "fundamentals" || key === "financial_quality"
              ? Math.max(maxToolIterations, 3)
              : maxToolIterations,
            this.clients.analysts,
            undefined,
            streamCb,
            enableWebSearch,
            signal,
          ),
        );

      const analystResults = await Promise.all(analystPromises);

      // Suggestion 8: parse and strip summaryJSON from each analyst result
      for (const result of analystResults) {
        if (result.status === "done" && result.content) {
          result.summaryJSON = parseSummaryJSON(result.content) ?? undefined;
          result.content = stripSummaryJSON(result.content);
        }
      }

      record.stages.push(...analystResults);
      this.checkCancelled();

      // Suggestion 8: use JSON-enriched summary so debaters can reference structured fields
      const analystSummary = summarizeAnalystsWithJSON(record.stages);

      // ── Phase 3: Bull/Bear debate with dynamic continuation ───────────
      this.tick(
        state,
        "running_debate",
        50,
        "Running bull/bear debate...",
        onProgress,
      );
      let debateHistory = "";
      let actualDebateRounds = clampedDebateRounds;

      for (let round = 1; round <= clampedDebateRounds; round++) {
        const debateUserContent =
          focusBlock +
          (memoryCtx ? `${memoryCtx}---\n` : "") +
          `ANALYST REPORTS:\n${analystSummary}\n\nSYMBOL: ${symbol}, CURRENT PRICE: ${marketData.currentPrice != null ? "$" + marketData.currentPrice.toFixed(2) : "N/A"}`;

        const [bull, bear] = await Promise.all([
          this.runAgentWithTools(
            record,
            state,
            onProgress,
            "bull_debater",
            `Bull Advocate (Round ${round})`,
            PROMPTS.bull_debater(round, debateHistory, debateIntensity),
            debateUserContent,
            50 + Math.round(((round - 1) / clampedDebateRounds) * 15),
            enableToolCalling,
            toolExecutor,
            maxToolIterations,
            this.clients.debate,
            debateHeat,
            streamCb,
            false,
            signal,
          ),
          this.runAgentWithTools(
            record,
            state,
            onProgress,
            "bear_debater",
            `Bear Advocate (Round ${round})`,
            PROMPTS.bear_debater(round, debateHistory, debateIntensity),
            debateUserContent,
            52 + Math.round(((round - 1) / clampedDebateRounds) * 15),
            enableToolCalling,
            toolExecutor,
            maxToolIterations,
            this.clients.debate,
            debateHeat,
            streamCb,
            false,
            signal,
          ),
        ]);

        record.stages.push(bull, bear);
        debateHistory += `\n### BULL (Round ${round}):\n${stripToolCallTag(bull.content)}\n\n### BEAR (Round ${round}):\n${stripToolCallTag(bear.content)}\n`;
        this.checkCancelled();

        // Check continuation only if there are more potential rounds
        if (round < clampedDebateRounds) {
          const interimRmContent = `ANALYST REPORTS:\n${analystSummary}\n\n---\n\nDEBATE HISTORY:\n${debateHistory}`;
          const interimRm = await this.runAgentWithTools(
            record,
            state,
            onProgress,
            "research_manager",
            `Research Manager (Round ${round} Assessment)`,
            PROMPTS.research_manager(false),
            interimRmContent,
            55 + Math.round((round / clampedDebateRounds) * 10),
            false,
            toolExecutor,
            0,
            this.clients.debate,
            undefined,
            streamCb,
            false,
            signal,
          );
          record.stages.push(interimRm);
          this.checkCancelled();

          if (!parseContinueDebate(interimRm.content)) {
            actualDebateRounds = round;
            break; // Research manager says enough debate
          }
        }
      }

      // Final research manager synthesis
      const finalRmContent = `ANALYST REPORTS:\n${analystSummary}\n\n---\n\nFULL DEBATE (${actualDebateRounds} rounds):\n${debateHistory}`;
      const rmResult = await this.runAgentWithTools(
        record,
        state,
        onProgress,
        "research_manager",
        "Research Manager (Final Verdict)",
        PROMPTS.research_manager(true),
        finalRmContent,
        68,
        false,
        toolExecutor,
        0,
        this.clients.debate,
        undefined,
        streamCb,
        false,
        signal,
      );
      record.stages.push(rmResult);
      this.checkCancelled();

      // ── Phase 4: Trader ───────────────────────────────────────────────
      this.tick(
        state,
        "running_trader",
        68,
        "Trader synthesizing recommendation...",
        onProgress,
      );
      const traderContent =
        focusBlock +
        (memoryCtx ? `${memoryCtx}---\n` : "") +
        `SYMBOL: ${symbol}\nCURRENT PRICE: ${marketData.currentPrice != null ? "$" + marketData.currentPrice.toFixed(2) : "N/A"}\n\n` +
        `ANALYST REPORTS:\n${analystSummary}\n\n---\n\n` +
        `RESEARCH MANAGER VERDICT:\n${stripToolCallTag(rmResult.content)}`;

      const traderResult = await this.runAgentWithTools(
        record,
        state,
        onProgress,
        "trader",
        undefined,
        PROMPTS.trader,
        traderContent,
        75,
        false,
        toolExecutor,
        0,
        this.clients.trader,
        undefined,
        streamCb,
        false,
        signal,
      );
      record.stages.push(traderResult);
      this.checkCancelled();

      // ── Phase 5: Risk debate rounds ───────────────────────────────────
      this.tick(
        state,
        "running_risk",
        75,
        "Running risk team debate...",
        onProgress,
      );
      const baseRiskCtx =
        focusBlock +
        `SYMBOL: ${symbol}\nCURRENT PRICE: ${marketData.currentPrice != null ? "$" + marketData.currentPrice.toFixed(2) : "N/A"}\n` +
        `ATR(14): ${fmt(marketData.technicals.atr14)} | Beta: ${fmt(marketData.fundamentals.beta)}\n\n` +
        `ANALYST SUMMARY (excerpt):\n${analystSummary.slice(0, 2000)}\n\n---\n\n` +
        `TRADER RECOMMENDATION:\n${traderResult.content}`;

      let riskHistory = "";
      let actualRiskRounds = clampedRiskRounds;

      for (let round = 1; round <= clampedRiskRounds; round++) {
        const riskCtxWithHistory = riskHistory
          ? `${baseRiskCtx}\n\n---\n\nPREVIOUS RISK ROUND(S):\n${riskHistory}`
          : baseRiskCtx;
        const roundPct = 75 + Math.round((round / clampedRiskRounds) * 12);

        const [riskAgg, riskCons, riskNeut] = await Promise.all([
          this.runAgentWithTools(
            record,
            state,
            onProgress,
            "risk_analyst_aggressive",
            clampedRiskRounds > 1
              ? `Risk Analyst - Aggressive (Round ${round})`
              : undefined,
            PROMPTS.risk_analyst_aggressive,
            riskCtxWithHistory,
            roundPct,
            false,
            toolExecutor,
            0,
            this.clients.risk,
            undefined,
            streamCb,
            false,
            signal,
          ),
          this.runAgentWithTools(
            record,
            state,
            onProgress,
            "risk_analyst_conservative",
            clampedRiskRounds > 1
              ? `Risk Analyst - Conservative (Round ${round})`
              : undefined,
            PROMPTS.risk_analyst_conservative,
            riskCtxWithHistory,
            roundPct + 2,
            false,
            toolExecutor,
            0,
            this.clients.risk,
            undefined,
            streamCb,
            false,
            signal,
          ),
          this.runAgentWithTools(
            record,
            state,
            onProgress,
            "risk_analyst_neutral",
            clampedRiskRounds > 1
              ? `Risk Analyst - Neutral (Round ${round})`
              : undefined,
            PROMPTS.risk_analyst_neutral,
            riskCtxWithHistory,
            roundPct + 4,
            false,
            toolExecutor,
            0,
            this.clients.risk,
            undefined,
            streamCb,
            false,
            signal,
          ),
        ]);

        record.stages.push(riskAgg, riskCons, riskNeut);
        riskHistory +=
          `\n### AGGRESSIVE (Round ${round}):\n${riskAgg.content}\n\n` +
          `### CONSERVATIVE (Round ${round}):\n${riskCons.content}\n\n` +
          `### NEUTRAL (Round ${round}):\n${riskNeut.content}\n`;
        this.checkCancelled();

        // Check continuation for non-final rounds
        if (round < clampedRiskRounds) {
          const interimRiskMgrContent =
            `${baseRiskCtx}\n\n---\n\nRISK DEBATE (Round ${round}):\n` +
            `AGGRESSIVE:\n${riskAgg.content}\n\nCONSERVATIVE:\n${riskCons.content}\n\nNEUTRAL:\n${riskNeut.content}`;

          const interimRiskMgr = await this.runAgentWithTools(
            record,
            state,
            onProgress,
            "risk_manager",
            `Risk Manager (Round ${round} Assessment)`,
            PROMPTS.risk_manager(false),
            interimRiskMgrContent,
            roundPct + 6,
            false,
            toolExecutor,
            0,
            this.clients.risk,
            undefined,
            streamCb,
            false,
            signal,
          );
          record.stages.push(interimRiskMgr);
          this.checkCancelled();

          if (!parseContinueDebate(interimRiskMgr.content)) {
            actualRiskRounds = round;
            break;
          }
        }
      }

      // ── Phase 6: Final risk manager decision ──────────────────────────
      this.tick(
        state,
        "finalizing",
        88,
        "Risk manager making final decision...",
        onProgress,
      );
      const finalRiskContent =
        focusBlock +
        `SYMBOL: ${symbol}\nCURRENT PRICE: ${marketData.currentPrice != null ? "$" + marketData.currentPrice.toFixed(2) : "N/A"}\n\n` +
        dqBlock +
        `TRADER RECOMMENDATION:\n${traderResult.content}\n\n---\n\n` +
        `RISK DEBATE (${actualRiskRounds} rounds):\n${riskHistory}`;

      const riskManagerResult = await this.runAgentWithTools(
        record,
        state,
        onProgress,
        "risk_manager",
        "Risk Manager (Final Decision)",
        PROMPTS.risk_manager(true),
        finalRiskContent,
        95,
        false,
        toolExecutor,
        0,
        this.clients.risk,
        undefined,
        streamCb,
        false,
        signal,
      );
      record.stages.push(riskManagerResult);

      const finalDecision = parseRiskManagerDecision(riskManagerResult.content);
      record.finalDecision = finalDecision;
      state.finalDecision = finalDecision;

      // ── Save memory (reflection) ──────────────────────────────────────
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

  // ── Agent runner with tool-calling ReAct loop ────────────────────────────

  private async runAgentWithTools(
    record: AIAnalysisRecord,
    state: AIAnalysisState,
    onProgress: AIProgressCallback,
    role: AIAgentRole,
    labelOverride: string | undefined,
    systemPrompt: string,
    initialUserContent: string,
    targetProgress: number,
    enableTools: boolean,
    toolExecutor: Record<AIToolName, () => Promise<string>>,
    maxIter: number,
    client?: LLMClient,
    temperatureOverride?: number,
    onStream?: AIStreamCallback,
    webSearch?: boolean,
    signal?: AbortSignal,
  ): Promise<AIStageResult> {
    const result: AIStageResult = {
      role,
      label: labelOverride,
      status: "running",
      content: "",
      toolCallsMade: 0,
    };
    const startMs = Date.now();

    // Mark as running in UI
    state.stages = [
      ...state.stages.filter(
        (s) => !(s.role === role && s.label === labelOverride),
      ),
      result,
    ];
    onProgress({ ...state });

    try {
      const messages: LLMMessage[] = [
        { role: "user", content: initialUserContent },
      ];
      let lastContent = "";
      let totalTokens = 0;
      let toolCallsMade = 0;
      let thinkingContent = "";
      const citations: Citation[] = [];

      const iterLimit = enableTools ? Math.max(1, maxIter) : 1;
      const activeClient = client ?? this.clients.analysts;

      for (let iter = 0; iter < iterLimit; iter++) {
        const isLastIteration = !enableTools || iter >= iterLimit - 1;
        const shouldStream = isLastIteration && onStream != null;

        if (shouldStream) {
          // ── Streaming path (final iteration only) ──────────────────
          let accumulated = "";
          let thinkingAccumulated = "";

          for await (const chunk of activeClient.completeStream({
            messages,
            systemPrompt,
            ...(temperatureOverride != null
              ? { temperature: temperatureOverride }
              : {}),
            webSearch,
            signal,
          })) {
            if (chunk.type === "text") {
              accumulated += chunk.delta ?? "";
              onStream({
                type: "stage_text",
                role,
                label: labelOverride,
                delta: chunk.delta ?? "",
                accumulated,
              });
            } else if (chunk.type === "thinking") {
              thinkingAccumulated += chunk.delta ?? "";
              onStream({
                type: "stage_thinking",
                role,
                label: labelOverride,
                delta: chunk.delta ?? "",
                accumulated: thinkingAccumulated,
              });
            } else if (
              chunk.type === "annotation" &&
              chunk.annotation
            ) {
              citations.push(chunk.annotation);
              onStream({
                type: "stage_annotation",
                role,
                label: labelOverride,
                annotation: chunk.annotation,
              });
            } else if (chunk.type === "done") {
              totalTokens += chunk.tokensUsed ?? 0;
            } else if (chunk.type === "error") {
              throw new Error(chunk.error ?? "Stream error");
            }
          }

          lastContent = accumulated;
          thinkingContent = thinkingAccumulated;
          onStream({
            type: "stage_done",
            role,
            label: labelOverride,
          });
          break;
        } else {
          // ── Non-streaming path (tool-calling iterations) ───────────
          const response = await activeClient.complete({
            messages,
            systemPrompt,
            ...(temperatureOverride != null
              ? { temperature: temperatureOverride }
              : {}),
          });
          lastContent = response.content;
          totalTokens += response.tokensUsed;

          if (!enableTools || iter >= iterLimit - 1) break;

          const toolCall = parseToolCall(response.content);
          if (!toolCall) break;

          // Execute tool and continue conversation
          const executor = toolExecutor[toolCall.name];
          if (!executor) break;

          let toolResult: string;
          try {
            toolResult = await executor();
          } catch (toolErr) {
            toolResult = `Error fetching ${toolCall.name}: ${String(toolErr)}`;
          }
          toolCallsMade++;

          messages.push({ role: "assistant", content: response.content });
          messages.push({
            role: "user",
            content: `Tool result for ${toolCall.name}:\n\n${toolResult}\n\nPlease complete your analysis incorporating this additional data.`,
          });
        }
      }

      result.content = stripToolCallTag(lastContent);
      result.tokensUsed = totalTokens;
      result.toolCallsMade = toolCallsMade;
      result.status = "done";
      result.systemPrompt = systemPrompt;
      result.inputMessages = [...messages];
      if (thinkingContent) result.thinkingContent = thinkingContent;
      if (citations.length > 0) result.citations = citations;
    } catch (err) {
      result.status = "error";
      result.errorMessage = err instanceof Error ? err.message : String(err);
      // Don't rethrow — let pipeline continue
    }

    result.durationMs = Date.now() - startMs;
    record.totalTokensUsed =
      (record.totalTokensUsed ?? 0) + (result.tokensUsed ?? 0);

    state.stages = [
      ...state.stages.filter(
        (s) => !(s.role === role && s.label === labelOverride),
      ),
      result,
    ];
    state.progress = targetProgress;
    onProgress({ ...state });

    return result;
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
