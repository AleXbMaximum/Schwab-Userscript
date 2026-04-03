import type { LLMClientConfig } from "../../../backend/core/network/llm/LLMClient";
import { LLMClient } from "../../../backend/core/network/llm/LLMClient";
import type {
  AIAnalysisConfig,
  AIAnalysisRecord,
} from "../../../backend/services/ai/types";
import type { PipelineClients } from "../../../backend/services/ai/AIOrchestrator";
import { DataFetcher } from "../../../backend/services/ai/pipeline/DataFetcher";
import { chartDataService } from "../../../backend/core/network/chart/ChartDataService";
import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { AIAnalysisStore } from "../../../backend/core/db/ai/AIAnalysisStore";
import { MemoryStore } from "../../../backend/core/db/ai/MemoryStore";
import { aiService } from "../../../backend/services/ai/AIService";
import type { PipelineConfigState } from "../pipeline/pipelineConfigPanel";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisRunnerDeps {
  symbol: string;
  focusTopic: string;
  resolveClientConfig: (profileId: string | undefined) => LLMClientConfig;
  pipelineState: PipelineConfigState;
  alphaVantageKey: string;
  enableStreaming?: boolean;
  enableWebSearch?: boolean;
}

export interface AnalysisRunResult {
  record: AIAnalysisRecord;
  statusText: string;
}

// ── Runner ───────────────────────────────────────────────────────────────────

export async function runAnalysis(
  deps: AnalysisRunnerDeps,
): Promise<AnalysisRunResult> {
  const { symbol, focusTopic, resolveClientConfig, pipelineState, alphaVantageKey, enableStreaming, enableWebSearch } = deps;

  const defaultConfig = resolveClientConfig(undefined);
  if (!defaultConfig.apiKey) {
    throw new Error("NO_API_KEY");
  }

  const rdb = await openAlexQuantDB();
  const store = new AIAnalysisStore(rdb);
  const memStore = new MemoryStore(rdb);

  const phaseModels = pipelineState.getPhaseModels();
  const makeClient = (phase: string): LLMClient =>
    new LLMClient(resolveClientConfig(phaseModels[phase] || undefined));

  const clients: PipelineClients = {
    analysts: makeClient("analysts"),
    debate: makeClient("debate"),
    trader: makeClient("trader"),
    risk: makeClient("risk"),
  };

  const fetcher = new DataFetcher({
    chartDataService,
    alphaVantageKey: alphaVantageKey || undefined,
  });

  const enabledAnalysts =
    pipelineState.getEnabledAnalysts() as AIAnalysisConfig["selectedAnalysts"];
  const analysisConfig: AIAnalysisConfig = {
    maxDebateRounds: pipelineState.getDebateRounds(),
    maxRiskRounds: pipelineState.getRiskRounds(),
    enableMemory: pipelineState.isMemoryEnabled(),
    enableToolCalling: pipelineState.isToolsEnabled(),
    maxToolIterations: 2,
    selectedAnalysts: enabledAnalysts,
    debateIntensity: pipelineState.getDebateIntensity(),
    debateHeat: pipelineState.getDebateHeat(),
    ...(focusTopic ? { focusTopic } : {}),
    enableStreaming: enableStreaming ?? false,
    enableWebSearch: enableWebSearch ?? false,
  };

  const record = await aiService.run(symbol, analysisConfig, {
    clients,
    fetcher,
    store,
    memoryStore: memStore,
  });

  const statusText = `Complete \u00b7 ${(record.totalDurationMs / 1000).toFixed(0)}s \u00b7 ${(record.totalTokensUsed / 1000).toFixed(1)}K tokens`;
  return { record, statusText };
}
