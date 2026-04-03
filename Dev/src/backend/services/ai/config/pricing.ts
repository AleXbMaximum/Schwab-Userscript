/**
 * Model pricing data and cost estimation for AI analysis pipeline.
 * Prices are in USD per 1M tokens.
 */

import type{ OpenAIPricingTier } from "shared/types/core";

export type ModelPricing = { input: number; output: number };

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-opus-4-6-20260220": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-6-20260220": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  // OpenAI
  "gpt-5.2-pro": { input: 15, output: 120 },
  "gpt-5.2": { input: 1.75, output: 14 },
  "gpt-5.1": { input: 1.25, output: 10 },
  "gpt-5-pro": { input: 15, output: 120 },
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  o3: { input: 10, output: 40 },
  "o4-mini": { input: 1.1, output: 4.4 },
  // Google
  "gemini-3-pro-preview": { input: 2.0, output: 12.0 },
  "gemini-3.1-pro-preview": { input: 2.0, output: 12.0 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
};

type OpenAIModelPricingByTier = {
  standard: ModelPricing;
  flex?: ModelPricing;
  batch?: ModelPricing;
};

const OPENAI_MODEL_PRICING_BY_TIER: Record<string, OpenAIModelPricingByTier> = {
  "gpt-5.2-pro": {
    standard: { input: 15, output: 120 },
  },
  "gpt-5.2": {
    standard: { input: 1.75, output: 14 },
    flex: { input: 0.875, output: 7 },
    batch: { input: 0.4375, output: 3.5 },
  },
  "gpt-5.1": {
    standard: { input: 1.25, output: 10 },
    flex: { input: 0.625, output: 5 },
    batch: { input: 0.3125, output: 2.5 },
  },
  "gpt-5-pro": {
    standard: { input: 15, output: 120 },
  },
  "gpt-5": {
    standard: { input: 1.25, output: 10 },
    flex: { input: 0.625, output: 5 },
    batch: { input: 0.3125, output: 2.5 },
  },
  "gpt-5-mini": {
    standard: { input: 0.25, output: 2 },
    flex: { input: 0.125, output: 1 },
    batch: { input: 0.0625, output: 0.5 },
  },
  "gpt-5-nano": {
    standard: { input: 0.05, output: 0.4 },
    flex: { input: 0.025, output: 0.2 },
    batch: { input: 0.0125, output: 0.1 },
  },
};

// Approximate per-stage token usage
const STAGE_TOKENS = {
  analyst: { input: 5000, output: 1500 },
  debater: { input: 8000, output: 1500 },
  researchMgr: { input: 6000, output: 500 },
  trader: { input: 10000, output: 2000 },
  riskAnalyst: { input: 8000, output: 1500 },
  riskManager: { input: 10000, output: 2000 },
};

function resolvePricing(
  model: string,
  openAIPricingTier: OpenAIPricingTier = "standard",
): ModelPricing | undefined {
  const openai = OPENAI_MODEL_PRICING_BY_TIER[model];
  if (openai) {
    if (openAIPricingTier === "flex" && openai.flex) return openai.flex;
    if (openAIPricingTier === "batch" && openai.batch) return openai.batch;
    return openai.standard;
  }
  return MODEL_PRICING[model];
}

function costForTokens(
  model: string,
  inputTokens: number,
  outputTokens: number,
  openAIPricingTier: OpenAIPricingTier = "standard",
): number {
  const pricing = resolvePricing(model, openAIPricingTier);
  if (!pricing) return 0;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

export function estimateCost(params: {
  numAnalysts: number;
  debateRounds: number;
  riskRounds: number;
  analystModel: string;
  debateModel: string;
  traderModel: string;
  riskModel: string;
  analystOpenAIPricingTier?: OpenAIPricingTier;
  debateOpenAIPricingTier?: OpenAIPricingTier;
  traderOpenAIPricingTier?: OpenAIPricingTier;
  riskOpenAIPricingTier?: OpenAIPricingTier;
}): number {
  const {
    numAnalysts,
    debateRounds,
    riskRounds,
    analystModel,
    debateModel,
    traderModel,
    riskModel,
    analystOpenAIPricingTier = "standard",
    debateOpenAIPricingTier = "standard",
    traderOpenAIPricingTier = "standard",
    riskOpenAIPricingTier = "standard",
  } = params;

  let total = 0;

  // Phase 1: Analysts
  total +=
    numAnalysts *
    costForTokens(
      analystModel,
      STAGE_TOKENS.analyst.input,
      STAGE_TOKENS.analyst.output,
      analystOpenAIPricingTier,
    );

  // Phase 2: Debate rounds (2 debaters + 1 research manager per round)
  total +=
    debateRounds *
    (2 *
      costForTokens(
        debateModel,
        STAGE_TOKENS.debater.input,
        STAGE_TOKENS.debater.output,
        debateOpenAIPricingTier,
      ) +
      costForTokens(
        debateModel,
        STAGE_TOKENS.researchMgr.input,
        STAGE_TOKENS.researchMgr.output,
        debateOpenAIPricingTier,
      ));

  // Phase 3: Trader
  total += costForTokens(
    traderModel,
    STAGE_TOKENS.trader.input,
    STAGE_TOKENS.trader.output,
    traderOpenAIPricingTier,
  );

  // Phase 4: Risk (3 analysts per round + 1 risk manager at end)
  total +=
    riskRounds *
    3 *
    costForTokens(
      riskModel,
      STAGE_TOKENS.riskAnalyst.input,
      STAGE_TOKENS.riskAnalyst.output,
      riskOpenAIPricingTier,
    );
  total += costForTokens(
    riskModel,
    STAGE_TOKENS.riskManager.input,
    STAGE_TOKENS.riskManager.output,
    riskOpenAIPricingTier,
  );

  return total;
}

export function formatPrice(
  model: string,
  openAIPricingTier: OpenAIPricingTier = "standard",
): string {
  const p = resolvePricing(model, openAIPricingTier);
  if (!p) return "";
  const fmtNum = (n: number) => `$${n}`;
  return `${fmtNum(p.input)} / ${fmtNum(p.output)}`;
}
