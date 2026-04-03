import type{
  AIDebateIntensity,
  AIModelProfile,
  AIProviderKind,
  OpenAIPricingTier,
  OpenAIServiceTier,
} from "shared/types/core";

// ── KV key: ai.config.providers ──────────────────────────────────────────────

export type AIProvidersConfig = {
  selected: AIProviderKind;
  /** Default model selection for the selected provider (built-in model value or custom profile ID). */
  selectedModel: string;
  /** Model used for news summarization. Empty string = use selectedModel. */
  newsModel: string;
  anthropic: { apiKey: string };
  openai: {
    apiKey: string;
    serviceTier: OpenAIServiceTier;
    pricingTier: OpenAIPricingTier;
  };
  google: { apiKey: string };
};

// ── KV key: ai.config.models → AIModelProfile[] ─────────────────────────────
// (reuses existing AIModelProfile from shared/types)

// ── KV key: ai.config.agentModels ────────────────────────────────────────────

export type AIAgentModelsConfig = {
  analysts: string; // model ID or profile ID; '' = provider default model
  debate: string;
  trader: string;
  risk: string;
};

// ── KV key: ai.config.pipeline ───────────────────────────────────────────────

export type AIPipelineConfig = {
  selectedAnalysts: string[];
  debateRounds: number;
  riskRounds: number;
  debateIntensity: AIDebateIntensity;
  debateHeat: number;
  enableMemory: boolean;
  enableToolCalling: boolean;
};

// ── KV key: ai.config.general ────────────────────────────────────────────────

export type AIGeneralConfig = {
  maxTokens: number;
  temperature: number;
  alphaVantageApiKey: string;
  autoFetchData: boolean;
};

// ── Combined snapshot ────────────────────────────────────────────────────────

export type AIConfigSnapshot = {
  providers: AIProvidersConfig;
  models: AIModelProfile[];
  agentModels: AIAgentModelsConfig;
  pipeline: AIPipelineConfig;
  general: AIGeneralConfig;
};

export type AIConfigKey = keyof AIConfigSnapshot;

/** Extract the active API key from provider config. */
export function getProviderApiKey(config: AIProvidersConfig): string {
  switch (config.selected) {
    case "anthropic":
      return config.anthropic.apiKey;
    case "openai":
      return config.openai.apiKey;
    case "google":
      return config.google.apiKey;
    default:
      return "";
  }
}
