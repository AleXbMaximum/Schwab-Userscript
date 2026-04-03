import type{ AIProviderKind, OpenAIPricingTier, OpenAIServiceTier } from "shared/types/core";

export type BuiltinModelOption = {
  value: string;
  hint: string;
  /**
   * Known output token ceiling for this built-in model.
   * Omitted when unknown or intentionally unrestricted.
   */
  maxOutputTokens?: number;
  /**
   * Whether this built-in model supports custom temperature values.
   * Omitted = treat as supported.
   */
  supportsCustomTemperature?: boolean;
  /**
   * Supported OpenAI service tiers for this built-in model.
   * Omitted = all service tiers.
   */
  openAIServiceTiers?: OpenAIServiceTier[];
  /**
   * Supported OpenAI pricing tiers for this built-in model.
   * Omitted = all pricing tiers.
   */
  openAIPricingTiers?: OpenAIPricingTier[];
};

export const OPENAI_SERVICE_TIER_OPTIONS: OpenAIServiceTier[] = [
  "auto",
  "default",
  "flex",
  "priority",
];

const OPENAI_PRICING_TIER_OPTIONS: OpenAIPricingTier[] = [
  "standard",
  "flex",
  "batch",
];

export const BUILTIN_MODEL_OPTIONS: Record<
  AIProviderKind,
  BuiltinModelOption[]
> = {
  anthropic: [
    { value: "claude-sonnet-4-6", hint: "balanced" },
    { value: "claude-opus-4-6", hint: "max capability" },
    { value: "claude-haiku-4-5", hint: "budget + fast" },
  ],
  openai: [
    {
      value: "gpt-5.2-pro",
      hint: "latest max capability",
      maxOutputTokens: 128000,
      supportsCustomTemperature: false,
      openAIServiceTiers: ["auto", "default", "priority"],
      openAIPricingTiers: ["standard"],
    },
    {
      value: "gpt-5.2",
      hint: "latest flagship",
      maxOutputTokens: 128000,
      supportsCustomTemperature: false,
      openAIPricingTiers: ["standard", "flex", "batch"],
    },
    {
      value: "gpt-5-mini",
      hint: "balanced + low cost",
      maxOutputTokens: 128000,
      supportsCustomTemperature: false,
      openAIPricingTiers: ["standard", "flex", "batch"],
    },
    {
      value: "gpt-5-nano",
      hint: "cheapest",
      maxOutputTokens: 128000,
      supportsCustomTemperature: false,
      openAIPricingTiers: ["standard", "flex", "batch"],
    },
  ],
  google: [
    { value: "gemini-2.5-flash", hint: "balanced + fast" },
    { value: "gemini-2.5-pro", hint: "high capability (stable)" },
    { value: "gemini-3-pro-preview", hint: "latest preview" },
    { value: "gemini-2.5-flash-lite", hint: "cheapest" },
  ],
};

export function findBuiltinModelOption(
  provider: AIProviderKind,
  model: string,
): BuiltinModelOption | undefined {
  return BUILTIN_MODEL_OPTIONS[provider].find((m) => m.value === model);
}

export function supportsCustomTemperature(
  provider: AIProviderKind,
  model: string,
): boolean {
  const builtin = findBuiltinModelOption(provider, model);
  if (builtin?.supportsCustomTemperature === false) return false;
  return true;
}

export function getSupportedOpenAIServiceTiers(
  model: string,
  isCustomModel: boolean,
): OpenAIServiceTier[] {
  if (isCustomModel) return [...OPENAI_SERVICE_TIER_OPTIONS];
  const builtin = findBuiltinModelOption("openai", model);
  return [...(builtin?.openAIServiceTiers ?? OPENAI_SERVICE_TIER_OPTIONS)];
}

export function getSupportedOpenAIPricingTiers(
  model: string,
  isCustomModel: boolean,
): OpenAIPricingTier[] {
  if (isCustomModel) return [...OPENAI_PRICING_TIER_OPTIONS];
  const builtin = findBuiltinModelOption("openai", model);
  return [...(builtin?.openAIPricingTiers ?? OPENAI_PRICING_TIER_OPTIONS)];
}

export function resolveEffectiveOpenAIServiceTier(
  model: string,
  requested: OpenAIServiceTier,
  isCustomModel: boolean,
): OpenAIServiceTier {
  const supported = getSupportedOpenAIServiceTiers(model, isCustomModel);
  if (supported.includes(requested)) return requested;
  return supported[0] ?? "auto";
}

/**
 * Derives the OpenAI pricing tier from a service tier selection.
 * 'flex' service → 'flex' pricing; everything else → 'standard' pricing.
 */
export function derivePricingTierFromServiceTier(
  serviceTier: OpenAIServiceTier,
): OpenAIPricingTier {
  return serviceTier === "flex" ? "flex" : "standard";
}

/**
 * Resolve the display label for the currently selected main model.
 * Pure data logic — no UI dependency.
 */
export function resolveMainModelLabel(
  provider: AIProviderKind,
  selectedModelId: string,
  customModels: {
    id: string;
    provider: AIProviderKind;
    model: string;
    name: string;
  }[],
): string {
  const custom = customModels.find(
    (m) => m.id === selectedModelId && m.provider === provider,
  );
  if (custom) return `${custom.model} (${custom.name})`;
  const builtin = BUILTIN_MODEL_OPTIONS[provider].find(
    (m) => m.value === selectedModelId,
  );
  if (builtin) return builtin.value;
  return BUILTIN_MODEL_OPTIONS[provider][0]?.value ?? selectedModelId;
}

export function clampMaxTokensForModel(
  provider: AIProviderKind,
  model: string,
  requestedMaxTokens: number,
): number {
  const builtin = findBuiltinModelOption(provider, model);
  const cap = builtin?.maxOutputTokens;
  if (!Number.isFinite(requestedMaxTokens) || requestedMaxTokens <= 0)
    return requestedMaxTokens;
  if (!cap || !Number.isFinite(cap) || cap <= 0) return requestedMaxTokens;
  return Math.min(requestedMaxTokens, cap);
}
