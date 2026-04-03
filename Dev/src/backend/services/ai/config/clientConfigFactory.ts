import type{ AIModelProfile, AIProviderKind, OpenAIServiceTier } from "shared/types/core";
import type { LLMClientConfig } from "backend/core/network/llm/LLMClient";
import type { AIConfigSnapshot } from "./types";
import {
  BUILTIN_MODEL_OPTIONS,
  clampMaxTokensForModel,
  resolveEffectiveOpenAIServiceTier,
  supportsCustomTemperature,
} from "./modelCatalog";

/**
 * Build a fully-resolved LLMClientConfig from raw parameters.
 * Pure function — no side effects, no DOM, no closures.
 */
export function buildLLMClientConfig(opts: {
  provider: AIProviderKind;
  apiKey: string;
  model: string;
  isCustomModel: boolean;
  maxTokens: number;
  temperature: number | undefined;
  serviceTier: OpenAIServiceTier;
}): LLMClientConfig {
  const maxTokens = clampMaxTokensForModel(
    opts.provider,
    opts.model,
    opts.maxTokens,
  );
  const allowTemp = supportsCustomTemperature(opts.provider, opts.model);
  const temperature = allowTemp ? opts.temperature : undefined;
  const openAIServiceTier =
    opts.provider === "openai"
      ? resolveEffectiveOpenAIServiceTier(
          opts.model,
          opts.serviceTier,
          opts.isCustomModel,
        )
      : ("auto" as OpenAIServiceTier);
  return {
    provider: opts.provider,
    apiKey: opts.apiKey,
    model: opts.model,
    maxTokens,
    ...(temperature != null ? { temperature } : {}),
    openAIServiceTier,
  };
}

/**
 * Resolve a profile ID to a fully-built LLMClientConfig.
 * Looks up custom models first, then builtins, then falls back to the default.
 */
export function resolveClientConfigFromSnapshot(
  profileId: string | undefined,
  config: AIConfigSnapshot,
  customModels: AIModelProfile[],
): LLMClientConfig {
  const provider = config.providers.selected;

  const getApiKey = (p: AIProviderKind): string => {
    if (p === "anthropic") return config.providers.anthropic.apiKey;
    if (p === "openai") return config.providers.openai.apiKey;
    return config.providers.google.apiKey;
  };

  if (profileId) {
    const profile = customModels.find((m) => m.id === profileId);
    if (profile) {
      return buildLLMClientConfig({
        provider: profile.provider,
        apiKey: getApiKey(profile.provider),
        model: profile.model,
        isCustomModel: true,
        maxTokens: profile.maxTokens ?? config.general.maxTokens,
        temperature: profile.temperature ?? config.general.temperature,
        serviceTier:
          profile.openAIServiceTier ?? config.providers.openai.serviceTier,
      });
    }

    for (const [prov, models] of Object.entries(BUILTIN_MODEL_OPTIONS) as [
      AIProviderKind,
      { value: string }[],
    ][]) {
      const builtin = models.find((m) => m.value === profileId);
      if (builtin) {
        return buildLLMClientConfig({
          provider: prov,
          apiKey: getApiKey(prov),
          model: builtin.value,
          isCustomModel: false,
          maxTokens: config.general.maxTokens,
          temperature: config.general.temperature,
          serviceTier: config.providers.openai.serviceTier,
        });
      }
    }
  }

  const fallbackModel = BUILTIN_MODEL_OPTIONS[provider][0].value;
  return buildLLMClientConfig({
    provider,
    apiKey: getApiKey(provider),
    model: fallbackModel,
    isCustomModel: false,
    maxTokens: config.general.maxTokens,
    temperature: config.general.temperature,
    serviceTier: config.providers.openai.serviceTier,
  });
}
