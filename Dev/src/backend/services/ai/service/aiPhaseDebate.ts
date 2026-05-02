import type { LLMClient } from "../../../core/network/llm/LLMClient";
import type {
  AIAnalysisRecord,
  AIAnalysisState,
  AIFinalDecision,
  AIProgressCallback,
  AIStageResult,
  AIStreamCallback,
  MarketDataBundle,
} from "../types";
import type { AIDebateIntensity } from "shared/types/core";
import { PROMPTS } from "../prompts/prompts";
import { fmt } from "../pipeline/formatters";
import {
  parseContinueDebate,
  parseRiskManagerDecision,
  stripToolCallTag,
} from "../pipeline/parsers";
import type { AIPipelineBundle } from "../pipeline/prepareBundle";
import { runAgentWithTools } from "./aiAgentRunner";

function checkCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new Error("Cancelled");
}

/**
 * Phase 3 — bull/bear debate with dynamic continuation, then a final
 * Research Manager synthesis. Returns the full transcript + the final RM
 * stage result + the actual round count used.
 */
export async function runDebatePhase(args: {
  record: AIAnalysisRecord;
  state: AIAnalysisState;
  onProgress: AIProgressCallback;
  bundle: AIPipelineBundle;
  symbol: string;
  marketData: MarketDataBundle;
  analystSummary: string;
  focusBlock: string;
  maxDebateRounds: number; // already clamped
  debateIntensity: AIDebateIntensity;
  debateHeat?: number;
  enableToolCalling: boolean;
  maxToolIterations: number;
  client: LLMClient;
  streamCb: AIStreamCallback | undefined;
  signal: AbortSignal;
}): Promise<{
  debateHistory: string;
  rmResult: AIStageResult;
  actualDebateRounds: number;
}> {
  const {
    record,
    state,
    onProgress,
    bundle,
    symbol,
    marketData,
    analystSummary,
    focusBlock,
    maxDebateRounds,
    debateIntensity,
    debateHeat,
    enableToolCalling,
    maxToolIterations,
    client,
    streamCb,
    signal,
  } = args;
  const { memoryCtx, toolExecutor } = bundle;

  let debateHistory = "";
  let actualDebateRounds = maxDebateRounds;

  for (let round = 1; round <= maxDebateRounds; round++) {
    const debateUserContent =
      focusBlock +
      (memoryCtx ? `${memoryCtx}---\n` : "") +
      `ANALYST REPORTS:\n${analystSummary}\n\nSYMBOL: ${symbol}, CURRENT PRICE: ${marketData.currentPrice != null ? "$" + marketData.currentPrice.toFixed(2) : "N/A"}`;

    const [bull, bear] = await Promise.all([
      runAgentWithTools({
        record,
        state,
        onProgress,
        role: "bull_debater",
        labelOverride: `Bull Advocate (Round ${round})`,
        systemPrompt: PROMPTS.bull_debater(round, debateHistory, debateIntensity),
        initialUserContent: debateUserContent,
        targetProgress: 50 + Math.round(((round - 1) / maxDebateRounds) * 15),
        enableTools: enableToolCalling,
        toolExecutor,
        maxIter: maxToolIterations,
        client,
        temperatureOverride: debateHeat,
        onStream: streamCb,
        webSearch: false,
        signal,
      }),
      runAgentWithTools({
        record,
        state,
        onProgress,
        role: "bear_debater",
        labelOverride: `Bear Advocate (Round ${round})`,
        systemPrompt: PROMPTS.bear_debater(round, debateHistory, debateIntensity),
        initialUserContent: debateUserContent,
        targetProgress: 52 + Math.round(((round - 1) / maxDebateRounds) * 15),
        enableTools: enableToolCalling,
        toolExecutor,
        maxIter: maxToolIterations,
        client,
        temperatureOverride: debateHeat,
        onStream: streamCb,
        webSearch: false,
        signal,
      }),
    ]);

    record.stages.push(bull, bear);
    debateHistory += `\n### BULL (Round ${round}):\n${stripToolCallTag(bull.content)}\n\n### BEAR (Round ${round}):\n${stripToolCallTag(bear.content)}\n`;
    checkCancelled(signal);

    if (round < maxDebateRounds) {
      const interimRmContent = `ANALYST REPORTS:\n${analystSummary}\n\n---\n\nDEBATE HISTORY:\n${debateHistory}`;
      const interimRm = await runAgentWithTools({
        record,
        state,
        onProgress,
        role: "research_manager",
        labelOverride: `Research Manager (Round ${round} Assessment)`,
        systemPrompt: PROMPTS.research_manager(false),
        initialUserContent: interimRmContent,
        targetProgress: 55 + Math.round((round / maxDebateRounds) * 10),
        enableTools: false,
        toolExecutor,
        maxIter: 0,
        client,
        onStream: streamCb,
        webSearch: false,
        signal,
      });
      record.stages.push(interimRm);
      checkCancelled(signal);

      if (!parseContinueDebate(interimRm.content)) {
        actualDebateRounds = round;
        break;
      }
    }
  }

  const finalRmContent = `ANALYST REPORTS:\n${analystSummary}\n\n---\n\nFULL DEBATE (${actualDebateRounds} rounds):\n${debateHistory}`;
  const rmResult = await runAgentWithTools({
    record,
    state,
    onProgress,
    role: "research_manager",
    labelOverride: "Research Manager (Final Verdict)",
    systemPrompt: PROMPTS.research_manager(true),
    initialUserContent: finalRmContent,
    targetProgress: 68,
    enableTools: false,
    toolExecutor,
    maxIter: 0,
    client,
    onStream: streamCb,
    webSearch: false,
    signal,
  });
  record.stages.push(rmResult);
  checkCancelled(signal);

  return { debateHistory, rmResult, actualDebateRounds };
}

/**
 * Phase 4 — trader synthesizes a preliminary recommendation from the analyst
 * reports and the Research Manager verdict.
 */
export async function runTraderPhase(args: {
  record: AIAnalysisRecord;
  state: AIAnalysisState;
  onProgress: AIProgressCallback;
  bundle: AIPipelineBundle;
  symbol: string;
  marketData: MarketDataBundle;
  analystSummary: string;
  rmResult: AIStageResult;
  focusBlock: string;
  client: LLMClient;
  streamCb: AIStreamCallback | undefined;
  signal: AbortSignal;
}): Promise<AIStageResult> {
  const {
    record,
    state,
    onProgress,
    bundle,
    symbol,
    marketData,
    analystSummary,
    rmResult,
    focusBlock,
    client,
    streamCb,
    signal,
  } = args;

  const traderContent =
    focusBlock +
    (bundle.memoryCtx ? `${bundle.memoryCtx}---\n` : "") +
    `SYMBOL: ${symbol}\nCURRENT PRICE: ${marketData.currentPrice != null ? "$" + marketData.currentPrice.toFixed(2) : "N/A"}\n\n` +
    `ANALYST REPORTS:\n${analystSummary}\n\n---\n\n` +
    `RESEARCH MANAGER VERDICT:\n${stripToolCallTag(rmResult.content)}`;

  const traderResult = await runAgentWithTools({
    record,
    state,
    onProgress,
    role: "trader",
    labelOverride: undefined,
    systemPrompt: PROMPTS.trader,
    initialUserContent: traderContent,
    targetProgress: 75,
    enableTools: false,
    toolExecutor: bundle.toolExecutor,
    maxIter: 0,
    client,
    onStream: streamCb,
    webSearch: false,
    signal,
  });
  record.stages.push(traderResult);
  checkCancelled(signal);

  return traderResult;
}

/**
 * Phase 5+6 — risk debate rounds (with dynamic continuation) followed by the
 * final Risk Manager decision. Returns the parsed final decision.
 */
export async function runRiskPhase(args: {
  record: AIAnalysisRecord;
  state: AIAnalysisState;
  onProgress: AIProgressCallback;
  bundle: AIPipelineBundle;
  symbol: string;
  marketData: MarketDataBundle;
  analystSummary: string;
  traderResult: AIStageResult;
  focusBlock: string;
  maxRiskRounds: number; // already clamped
  client: LLMClient;
  streamCb: AIStreamCallback | undefined;
  signal: AbortSignal;
}): Promise<{
  riskManagerResult: AIStageResult;
  finalDecision: AIFinalDecision | null;
  actualRiskRounds: number;
}> {
  const {
    record,
    state,
    onProgress,
    bundle,
    symbol,
    marketData,
    analystSummary,
    traderResult,
    focusBlock,
    maxRiskRounds,
    client,
    streamCb,
    signal,
  } = args;
  const { dqBlock, toolExecutor } = bundle;

  const baseRiskCtx =
    focusBlock +
    `SYMBOL: ${symbol}\nCURRENT PRICE: ${marketData.currentPrice != null ? "$" + marketData.currentPrice.toFixed(2) : "N/A"}\n` +
    `ATR(14): ${fmt(marketData.technicals.atr14)} | Beta: ${fmt(marketData.fundamentals.beta)}\n\n` +
    `ANALYST SUMMARY (excerpt):\n${analystSummary.slice(0, 2000)}\n\n---\n\n` +
    `TRADER RECOMMENDATION:\n${traderResult.content}`;

  let riskHistory = "";
  let actualRiskRounds = maxRiskRounds;

  for (let round = 1; round <= maxRiskRounds; round++) {
    const riskCtxWithHistory = riskHistory
      ? `${baseRiskCtx}\n\n---\n\nPREVIOUS RISK ROUND(S):\n${riskHistory}`
      : baseRiskCtx;
    const roundPct = 75 + Math.round((round / maxRiskRounds) * 12);

    const [riskAgg, riskCons, riskNeut] = await Promise.all([
      runAgentWithTools({
        record,
        state,
        onProgress,
        role: "risk_analyst_aggressive",
        labelOverride:
          maxRiskRounds > 1
            ? `Risk Analyst - Aggressive (Round ${round})`
            : undefined,
        systemPrompt: PROMPTS.risk_analyst_aggressive,
        initialUserContent: riskCtxWithHistory,
        targetProgress: roundPct,
        enableTools: false,
        toolExecutor,
        maxIter: 0,
        client,
        onStream: streamCb,
        webSearch: false,
        signal,
      }),
      runAgentWithTools({
        record,
        state,
        onProgress,
        role: "risk_analyst_conservative",
        labelOverride:
          maxRiskRounds > 1
            ? `Risk Analyst - Conservative (Round ${round})`
            : undefined,
        systemPrompt: PROMPTS.risk_analyst_conservative,
        initialUserContent: riskCtxWithHistory,
        targetProgress: roundPct + 2,
        enableTools: false,
        toolExecutor,
        maxIter: 0,
        client,
        onStream: streamCb,
        webSearch: false,
        signal,
      }),
      runAgentWithTools({
        record,
        state,
        onProgress,
        role: "risk_analyst_neutral",
        labelOverride:
          maxRiskRounds > 1
            ? `Risk Analyst - Neutral (Round ${round})`
            : undefined,
        systemPrompt: PROMPTS.risk_analyst_neutral,
        initialUserContent: riskCtxWithHistory,
        targetProgress: roundPct + 4,
        enableTools: false,
        toolExecutor,
        maxIter: 0,
        client,
        onStream: streamCb,
        webSearch: false,
        signal,
      }),
    ]);

    record.stages.push(riskAgg, riskCons, riskNeut);
    riskHistory +=
      `\n### AGGRESSIVE (Round ${round}):\n${riskAgg.content}\n\n` +
      `### CONSERVATIVE (Round ${round}):\n${riskCons.content}\n\n` +
      `### NEUTRAL (Round ${round}):\n${riskNeut.content}\n`;
    checkCancelled(signal);

    if (round < maxRiskRounds) {
      const interimRiskMgrContent =
        `${baseRiskCtx}\n\n---\n\nRISK DEBATE (Round ${round}):\n` +
        `AGGRESSIVE:\n${riskAgg.content}\n\nCONSERVATIVE:\n${riskCons.content}\n\nNEUTRAL:\n${riskNeut.content}`;

      const interimRiskMgr = await runAgentWithTools({
        record,
        state,
        onProgress,
        role: "risk_manager",
        labelOverride: `Risk Manager (Round ${round} Assessment)`,
        systemPrompt: PROMPTS.risk_manager(false),
        initialUserContent: interimRiskMgrContent,
        targetProgress: roundPct + 6,
        enableTools: false,
        toolExecutor,
        maxIter: 0,
        client,
        onStream: streamCb,
        webSearch: false,
        signal,
      });
      record.stages.push(interimRiskMgr);
      checkCancelled(signal);

      if (!parseContinueDebate(interimRiskMgr.content)) {
        actualRiskRounds = round;
        break;
      }
    }
  }

  const finalRiskContent =
    focusBlock +
    `SYMBOL: ${symbol}\nCURRENT PRICE: ${marketData.currentPrice != null ? "$" + marketData.currentPrice.toFixed(2) : "N/A"}\n\n` +
    dqBlock +
    `TRADER RECOMMENDATION:\n${traderResult.content}\n\n---\n\n` +
    `RISK DEBATE (${actualRiskRounds} rounds):\n${riskHistory}`;

  const riskManagerResult = await runAgentWithTools({
    record,
    state,
    onProgress,
    role: "risk_manager",
    labelOverride: "Risk Manager (Final Decision)",
    systemPrompt: PROMPTS.risk_manager(true),
    initialUserContent: finalRiskContent,
    targetProgress: 95,
    enableTools: false,
    toolExecutor,
    maxIter: 0,
    client,
    onStream: streamCb,
    webSearch: false,
    signal,
  });
  record.stages.push(riskManagerResult);

  const finalDecision = parseRiskManagerDecision(riskManagerResult.content);
  return { riskManagerResult, finalDecision, actualRiskRounds };
}
