import type { KVStore } from "backend/core/db/core/KVStore";
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
import {
  DEFAULT_PROVIDERS,
  DEFAULT_AGENT_MODELS,
  DEFAULT_PIPELINE,
  DEFAULT_GENERAL,
} from "./defaults";

const PREFIX = "ai.config";

const KEYS = {
  providers: `${PREFIX}.providers`,
  models: `${PREFIX}.models`,
  agentModels: `${PREFIX}.agentModels`,
  pipeline: `${PREFIX}.pipeline`,
  general: `${PREFIX}.general`,
} as const;

const isProvider = (value: unknown): value is AIProviderKind =>
  value === "anthropic" || value === "openai" || value === "google";

const isServiceTier = (value: unknown): value is OpenAIServiceTier =>
  value === "auto" ||
  value === "default" ||
  value === "flex" ||
  value === "priority";

const isPricingTier = (value: unknown): value is OpenAIPricingTier =>
  value === "standard" || value === "flex" || value === "batch";

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
