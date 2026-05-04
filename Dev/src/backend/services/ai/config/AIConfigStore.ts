import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { KVStore } from "backend/core/db/core/KVStore";
import type{
  AIModelProfile,
  AIProviderKind,
  OpenAIPricingTier,
  OpenAIServiceTier,
} from "shared/types/core";
import type {
  AIConfigSnapshot,
  AIConfigKey,
  AIProvidersConfig,
  AIAgentModelsConfig,
  AIPipelineConfig,
  AIGeneralConfig,
} from "./types";

const PREFIX = "ai.config";

const KEYS = {
  providers: `${PREFIX}.providers`,
  models: `${PREFIX}.models`,
  agentModels: `${PREFIX}.agentModels`,
  pipeline: `${PREFIX}.pipeline`,
  general: `${PREFIX}.general`,
} as const;

// ── Defaults ─────────────────────────────────────────────────────────────────

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

// ── Tier-shape predicates (defend against corrupt KV payloads) ───────────────

const isProvider = (value: unknown): value is AIProviderKind =>
  value === "anthropic" || value === "openai" || value === "google";

const isServiceTier = (value: unknown): value is OpenAIServiceTier =>
  value === "auto" ||
  value === "default" ||
  value === "flex" ||
  value === "priority";

const isPricingTier = (value: unknown): value is OpenAIPricingTier =>
  value === "standard" || value === "flex" || value === "batch";

// ── Store ────────────────────────────────────────────────────────────────────

export class AIConfigStore {
  constructor(private kv: KVStore) {}

  async getProviders(): Promise<AIProvidersConfig> {
    const raw =
      (await this.kv.get<Partial<AIProvidersConfig>>(KEYS.providers)) ?? {};
    const selected = isProvider(raw.selected)
      ? raw.selected
      : DEFAULT_PROVIDERS.selected;
    const selectedModel =
      typeof raw.selectedModel === "string" &&
      raw.selectedModel.trim().length > 0
        ? raw.selectedModel.trim()
        : DEFAULT_PROVIDERS.selectedModel;
    const newsModel =
      typeof raw.newsModel === "string"
        ? raw.newsModel.trim()
        : DEFAULT_PROVIDERS.newsModel;

    return {
      selected,
      selectedModel,
      newsModel,
      anthropic: {
        apiKey: raw.anthropic?.apiKey ?? DEFAULT_PROVIDERS.anthropic.apiKey,
      },
      openai: {
        apiKey: raw.openai?.apiKey ?? DEFAULT_PROVIDERS.openai.apiKey,
        serviceTier: isServiceTier(raw.openai?.serviceTier)
          ? raw.openai.serviceTier
          : DEFAULT_PROVIDERS.openai.serviceTier,
        pricingTier: isPricingTier(raw.openai?.pricingTier)
          ? raw.openai.pricingTier
          : DEFAULT_PROVIDERS.openai.pricingTier,
      },
      google: {
        apiKey: raw.google?.apiKey ?? DEFAULT_PROVIDERS.google.apiKey,
      },
    };
  }

  async getModels(): Promise<AIModelProfile[]> {
    return (await this.kv.get<AIModelProfile[]>(KEYS.models)) ?? [];
  }

  async getAgentModels(): Promise<AIAgentModelsConfig> {
    const raw = await this.kv.get<AIAgentModelsConfig>(KEYS.agentModels);
    return { ...DEFAULT_AGENT_MODELS, ...raw };
  }

  async getPipeline(): Promise<AIPipelineConfig> {
    const raw = await this.kv.get<AIPipelineConfig>(KEYS.pipeline);
    return { ...DEFAULT_PIPELINE, ...raw };
  }

  async getGeneral(): Promise<AIGeneralConfig> {
    const raw = await this.kv.get<AIGeneralConfig>(KEYS.general);
    return { ...DEFAULT_GENERAL, ...raw };
  }

  async loadAll(): Promise<AIConfigSnapshot> {
    const [providers, models, agentModels, pipeline, general] =
      await Promise.all([
        this.getProviders(),
        this.getModels(),
        this.getAgentModels(),
        this.getPipeline(),
        this.getGeneral(),
      ]);
    return { providers, models, agentModels, pipeline, general };
  }

  async save<K extends AIConfigKey>(
    key: K,
    value: AIConfigSnapshot[K],
  ): Promise<void> {
    await this.kv.set(KEYS[key], value);
  }
}

/**
 * Convenience: load AI provider config in a single call. Eliminates the repeated
 * DB → KVStore → AIConfigStore → getProviders() boilerplate.
 */
export async function getAIProviders(): Promise<AIProvidersConfig> {
  const db = await openAlexQuantDB();
  const kv = new KVStore(db);
  return new AIConfigStore(kv).getProviders();
}
