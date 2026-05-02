import type { LLMClient } from "../../../core/network/llm/LLMClient";
import type {
  AIAgentRole,
  AIAnalysisRecord,
  AIAnalysisState,
  AIProgressCallback,
  AIStageResult,
  AIStreamCallback,
} from "../types";
import { PROMPTS } from "../prompts/prompts";
import { parseSummaryJSON, stripSummaryJSON } from "../pipeline/parsers";
import { summarizeAnalystsWithJSON } from "../pipeline/summarizers";
import type { AIPipelineBundle } from "../pipeline/prepareBundle";
import { runAgentWithTools } from "./aiAgentRunner";

/**
 * Phase 2 — run the eight analyst agents in parallel, parse SUMMARY_JSON
 * trailers, and produce the cross-analyst summary used by the debate phase.
 *
 * Behavior preserved verbatim:
 *   - Same analyst → context mapping (dqBlock, featureCtx, dataWarningBlock prefixes).
 *   - Same per-analyst progress percentages (12, 16, 20, 24, 28, 32, 36, 40).
 *   - Fundamentals + financial_quality get extra tool iterations (max(maxIter, 3)).
 */
export async function runAnalystsPhase(args: {
  record: AIAnalysisRecord;
  state: AIAnalysisState;
  onProgress: AIProgressCallback;
  bundle: AIPipelineBundle;
  focusBlock: string;
  selectedAnalysts: string[];
  enableToolCalling: boolean;
  maxToolIterations: number;
  client: LLMClient;
  streamCb: AIStreamCallback | undefined;
  enableWebSearch: boolean;
  signal: AbortSignal;
}): Promise<{ analystResults: AIStageResult[]; analystSummary: string }> {
  const {
    record,
    state,
    onProgress,
    bundle,
    focusBlock,
    selectedAnalysts,
    enableToolCalling,
    maxToolIterations,
    client,
    streamCb,
    enableWebSearch,
    signal,
  } = args;
  const { ctx, memoryCtx, dqBlock, dataWarningBlock, featureCtx, toolExecutor } =
    bundle;

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
    ["sentiment_macro", "sentiment_macro", dqBlock + ctx.sentimentMacro, 32],
    ["sellside", "sellside_analyst", dqBlock + ctx.sellside, 36],
    ["ownership", "ownership_analyst", dqBlock + ctx.ownership, 40],
  ];

  const analystPromises = analystMap
    .filter(([key]) => selectedAnalysts.includes(key as any))
    .map(([key, role, ctxText, pct]) =>
      runAgentWithTools({
        record,
        state,
        onProgress,
        role: role as AIAgentRole,
        labelOverride: undefined,
        systemPrompt: PROMPTS[role as keyof typeof PROMPTS] as string,
        initialUserContent: focusBlock + memoryCtx + ctxText,
        targetProgress: pct,
        enableTools: enableToolCalling,
        toolExecutor,
        maxIter:
          key === "fundamentals" || key === "financial_quality"
            ? Math.max(maxToolIterations, 3)
            : maxToolIterations,
        client,
        onStream: streamCb,
        webSearch: enableWebSearch,
        signal,
      }),
    );

  const analystResults = await Promise.all(analystPromises);

  for (const result of analystResults) {
    if (result.status === "done" && result.content) {
      result.summaryJSON = parseSummaryJSON(result.content) ?? undefined;
      result.content = stripSummaryJSON(result.content);
    }
  }

  record.stages.push(...analystResults);

  const analystSummary = summarizeAnalystsWithJSON(record.stages);

  return { analystResults, analystSummary };
}
