import type {
  AIProvidersConfig,
  AIAgentModelsConfig,
  AIPipelineConfig,
  AIGeneralConfig,
} from "./types";

export const DEFAULT_PROVIDERS: AIProvidersConfig = {
  selected: "anthropic",
  selectedModel: "claude-sonnet-4-6",
  newsModel: "",
  anthropic: { apiKey: "" },
  openai: { apiKey: "", serviceTier: "auto", pricingTier: "standard" },
  google: { apiKey: "" },
};

export const DEFAULT_AGENT_MODELS: AIAgentModelsConfig = {
  analysts: "",
  debate: "",
  trader: "",
  risk: "",
};

export const DEFAULT_PIPELINE: AIPipelineConfig = {
  selectedAnalysts: [
    "market",
    "fundamentals",
    "sentiment_company",
    "sentiment_macro",
    "technicals",
    "financial_quality",
    "sellside",
    "ownership",
  ],
  debateRounds: 2,
  riskRounds: 2,
  debateIntensity: "moderate",
  debateHeat: 0.3,
  enableMemory: true,
  enableToolCalling: true,
};

export const DEFAULT_GENERAL: AIGeneralConfig = {
  maxTokens: 4096,
  temperature: 0.3,
  alphaVantageApiKey: "",
  autoFetchData: true,
};
