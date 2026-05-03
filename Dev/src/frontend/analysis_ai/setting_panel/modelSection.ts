import { ui_createElement } from "../../components/core/builders/createElement";
import { DS_COMPONENTS } from "../../components/core/styles/theme";
import { appendSettingsFormRow, appendSettingsMatrixRow } from "../../components/core/settingsFramework";
import type{
  AIModelProfile,
  AIProviderKind,
  OpenAIPricingTier,
  OpenAIServiceTier,
} from "shared/types/core";
import type { AIConfigSnapshot } from "../../../backend/services/ai/config/types";
import type { AIConfigStore } from "../../../backend/services/ai/config/AIConfigStore";
import {
  BUILTIN_MODEL_OPTIONS,
  OPENAI_SERVICE_TIER_OPTIONS,
  clampMaxTokensForModel,
  derivePricingTierFromServiceTier,
  getSupportedOpenAIServiceTiers,
  resolveEffectiveOpenAIServiceTier,
  supportsCustomTemperature,
} from "../../../backend/services/ai/config/modelCatalog";
import { formatPrice } from "../../../backend/services/ai/config/pricing";

// ── Constants ────────────────────────────────────────────────────────────────

const MODEL_OPTIONS = BUILTIN_MODEL_OPTIONS;

const SERVICE_TIER_LABELS: Record<OpenAIServiceTier, string> = {
  auto: "Auto",
  default: "Default",
  flex: "Flex (cheaper, slower)",
  priority: "Priority (faster)",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const parseIntBounded = (
  raw: string,
  fallback: number,
  min: number,
  max: number,
): number => {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
};

const parseFloatBounded = (
  raw: string,
  fallback: number,
  min: number,
  max: number,
): number => {
  const n = parseFloat(raw);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface ResolvedModel {
  provider: AIProviderKind;
  model: string;
  isCustom: boolean;
  profile?: AIModelProfile;
}

export interface ModelSectionResult {
  controlsWrapper: HTMLElement;
  modelSelect: HTMLSelectElement;
  renderModelDropdown(provider: AIProviderKind, currentProfileId: string): void;
  syncServiceTierDropdown(): void;
  syncTemperatureField(): void;
  resolveCurrentSelectedModel(): ResolvedModel;
  getEffectivePricingForOpenAIModel(
    model: string,
    isCustom: boolean,
    profileServiceTier?: OpenAIServiceTier,
  ): OpenAIPricingTier;
  getModelPriceLabel(
    provider: AIProviderKind,
    model: string,
    profile?: AIModelProfile,
  ): string;
  wireEvents(opts: {
    getSelectedModelProfileId: () => string;
    setSelectedModelProfileId: (id: string) => void;
    persistSelectedModel: () => void;
    getSelectedProvider: () => AIProviderKind;
    notifyChange: () => void;
    refreshCustomModels: () => void;
  }): void;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createModelSection(opts: {
  config: AIConfigSnapshot;
  configStore: AIConfigStore;
  selectedProvider: () => AIProviderKind;
  getCustomModels: () => AIModelProfile[];
  allBuiltinModels: { value: string; provider: AIProviderKind }[];
}): ModelSectionResult {
  const { config, configStore, selectedProvider, getCustomModels, allBuiltinModels } = opts;
  const { settingFieldInput: fieldInputStyle } = DS_COMPONENTS;

  // ── Pricing helpers ─────────────────────────────────────────────────────

  const getEffectivePricingForOpenAIModel = (
    model: string,
    isCustom: boolean,
    profileServiceTier?: OpenAIServiceTier,
  ): OpenAIPricingTier => {
    const preferred = profileServiceTier ?? config.providers.openai.serviceTier;
    const effective = resolveEffectiveOpenAIServiceTier(
      model,
      preferred,
      isCustom,
    );
    return derivePricingTierFromServiceTier(effective);
  };

  const getModelPriceLabel = (
    provider: AIProviderKind,
    model: string,
    profile?: AIModelProfile,
  ): string => {
    if (provider !== "openai") return formatPrice(model);
    const pricingTier = getEffectivePricingForOpenAIModel(
      model,
      Boolean(profile),
      profile?.openAIServiceTier,
    );
    return formatPrice(model, pricingTier);
  };

  // ── Resolve current model ────────────────────────────────────────────────

  let _getSelectedModelProfileId: () => string = () => "";

  const resolveCurrentSelectedModel = (): ResolvedModel => {
    const selectedModelProfileId = _getSelectedModelProfileId();
    const profile = getCustomModels().find(
      (m) => m.id === selectedModelProfileId,
    );
    if (profile)
      return {
        provider: profile.provider,
        model: profile.model,
        isCustom: true,
        profile,
      };
    const builtin = allBuiltinModels.find(
      (m) => m.value === selectedModelProfileId,
    );
    if (builtin)
      return {
        provider: builtin.provider,
        model: builtin.value,
        isCustom: false,
      };
    return {
      provider: selectedProvider(),
      model: MODEL_OPTIONS[selectedProvider()][0].value,
      isCustom: false,
    };
  };

  // ── Model dropdown ─────────────────────────────────────────────────────

  const modelSelect = ui_createElement("select", {
    styleString: fieldInputStyle + " width: 100%; box-sizing: border-box;",
  }) as HTMLSelectElement;

  const modelDescriptionEl = ui_createElement("div", {
    text: "",
    styleString:
      "font-size: 11px; color: var(--ios-text-secondary); padding: 2px 0 4px 0; grid-column: 1 / -1;",
  });

  const updateModelDescription = (): void => {
    const selected = resolveCurrentSelectedModel();
    const details: string[] = [];
    const builtin = MODEL_OPTIONS[selected.provider].find(
      (m) => m.value === selected.model,
    );
    if (builtin) {
      details.push(builtin.hint);
      if (builtin.maxOutputTokens)
        details.push(`${builtin.maxOutputTokens / 1000}K max output`);
      details.push(
        builtin.supportsCustomTemperature === false
          ? "Fixed temp"
          : "Custom temp",
      );
    } else if (selected.profile) {
      details.push(selected.profile.name);
    }
    const price = getModelPriceLabel(
      selected.provider,
      selected.model,
      selected.profile,
    );
    if (price) details.push(price);
    modelDescriptionEl.textContent = details.join(" \u00b7 ");
  };

  const renderModelDropdown = (
    provider: AIProviderKind,
    currentProfileId: string,
  ): void => {
    modelSelect.innerHTML = "";
    for (const opt of MODEL_OPTIONS[provider]) {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.value;
      if (opt.value === currentProfileId) el.selected = true;
      modelSelect.appendChild(el);
    }
    for (const profile of getCustomModels()) {
      if (profile.provider !== provider) continue;
      const el = document.createElement("option");
      el.value = profile.id;
      el.textContent = `${profile.model} (${profile.name})`;
      if (profile.id === currentProfileId) el.selected = true;
      modelSelect.appendChild(el);
    }
    updateModelDescription();
  };

  // ── Controls wrapper ───────────────────────────────────────────────────

  const controlsWrapper = ui_createElement("div", {
    styleString: "display: contents;",
  });

  // Model row
  const tempFormRow = ui_createElement("div", {
    styleString: "display: contents;",
  });
  appendSettingsFormRow({
    body: tempFormRow,
    label: "Model",
    controlEl: modelSelect,
  });
  controlsWrapper.appendChild(tempFormRow);
  controlsWrapper.appendChild(modelDescriptionEl);

  // Service Tier + Max Tokens row
  const serviceTierSelect = ui_createElement("select", {
    styleString: fieldInputStyle + " width: 100%; box-sizing: border-box;",
  }) as HTMLSelectElement;

  const maxTokensInput = ui_createElement("input", {
    props: {
      type: "number",
      value: config.general.maxTokens.toString(),
      min: 100,
    },
    styleString: fieldInputStyle + " width: 10ch;",
  }) as HTMLInputElement;

  const serviceTierContainer = ui_createElement("div", {
    styleString: "display: flex; align-items: center; gap: 4px;",
    children: [serviceTierSelect],
  });

  const maxTokensContainer = ui_createElement("div", {
    styleString: "display: inline-flex; align-items: center; gap: 4px;",
    children: [
      maxTokensInput,
      ui_createElement("span", {
        text: "tokens",
        styleString: "font-size: 12px; color: var(--ios-text-secondary);",
      }),
    ],
  });

  const tempMatrixRow = ui_createElement("div", {
    styleString: "display: contents;",
  });
  appendSettingsMatrixRow({
    body: tempMatrixRow,
    label: "Service tier",
    toggleEl: serviceTierContainer,
    paramLabel: "Max tokens",
    controlEl: maxTokensContainer,
  });
  controlsWrapper.appendChild(tempMatrixRow);

  const syncServiceTierDropdown = (): void => {
    const isOpenAI = selectedProvider() === "openai";
    serviceTierSelect.disabled = !isOpenAI;
    serviceTierSelect.style.opacity = isOpenAI ? "1" : "0.45";
    if (!isOpenAI) {
      serviceTierSelect.innerHTML = "";
      const na = document.createElement("option");
      na.textContent = "N/A";
      serviceTierSelect.appendChild(na);
      return;
    }
    const selected = resolveCurrentSelectedModel();
    const model =
      selected.provider === "openai"
        ? selected.model
        : MODEL_OPTIONS.openai[0].value;
    const isCustom =
      selected.provider === "openai" ? selected.isCustom : false;
    const tiers = getSupportedOpenAIServiceTiers(model, isCustom);
    const effective = resolveEffectiveOpenAIServiceTier(
      model,
      config.providers.openai.serviceTier,
      isCustom,
    );
    serviceTierSelect.innerHTML = "";
    for (const tier of tiers) {
      const opt = document.createElement("option");
      opt.value = tier;
      opt.textContent = SERVICE_TIER_LABELS[tier];
      if (tier === effective) opt.selected = true;
      serviceTierSelect.appendChild(opt);
    }
  };

  // Temperature row
  const temperatureInput = ui_createElement("input", {
    props: {
      type: "number",
      value: config.general.temperature.toString(),
      min: 0,
      max: 1,
      step: 0.1,
    },
    styleString: fieldInputStyle + " width: 10ch;",
  }) as HTMLInputElement;

  const temperatureContainer = ui_createElement("div", {
    styleString: "display: inline-flex; align-items: center; gap: 4px;",
    children: [
      temperatureInput,
      ui_createElement("span", {
        text: "0\u20131",
        styleString: "font-size: 12px; color: var(--ios-text-secondary);",
      }),
    ],
  });

  const tempTempRow = ui_createElement("div", {
    styleString: "display: contents;",
  });
  appendSettingsFormRow({
    body: tempTempRow,
    label: "Temperature",
    controlEl: temperatureContainer,
  });
  controlsWrapper.appendChild(tempTempRow);

  const syncTemperatureField = (): void => {
    const selected = resolveCurrentSelectedModel();
    const canCustomize = supportsCustomTemperature(
      selected.provider,
      selected.model,
    );
    temperatureInput.disabled = !canCustomize;
    temperatureInput.style.opacity = canCustomize ? "1" : "0.55";
  };

  // ── Wire events ────────────────────────────────────────────────────────

  const wireEvents = (evtOpts: {
    getSelectedModelProfileId: () => string;
    setSelectedModelProfileId: (id: string) => void;
    persistSelectedModel: () => void;
    getSelectedProvider: () => AIProviderKind;
    notifyChange: () => void;
    refreshCustomModels: () => void;
  }) => {
    _getSelectedModelProfileId = evtOpts.getSelectedModelProfileId;

    modelSelect.addEventListener("change", () => {
      evtOpts.setSelectedModelProfileId(modelSelect.value);
      evtOpts.persistSelectedModel();
      updateModelDescription();
      syncServiceTierDropdown();
      syncTemperatureField();
    });

    maxTokensInput.addEventListener("blur", () => {
      const selected = resolveCurrentSelectedModel();
      const requested = parseIntBounded(
        maxTokensInput.value,
        config.general.maxTokens,
        100,
        64000,
      );
      const capped = clampMaxTokensForModel(
        selected.provider,
        selected.model,
        requested,
      );
      config.general.maxTokens = capped;
      maxTokensInput.value = String(capped);
      void configStore.save("general", { ...config.general });
    });

    temperatureInput.addEventListener("blur", () => {
      if (temperatureInput.disabled) return;
      config.general.temperature = parseFloatBounded(
        temperatureInput.value,
        config.general.temperature,
        0,
        1,
      );
      void configStore.save("general", { ...config.general });
    });

    serviceTierSelect.addEventListener("change", () => {
      const tier = OPENAI_SERVICE_TIER_OPTIONS.includes(
        serviceTierSelect.value as OpenAIServiceTier,
      )
        ? (serviceTierSelect.value as OpenAIServiceTier)
        : "auto";
      config.providers.openai.serviceTier = tier;
      config.providers.openai.pricingTier =
        derivePricingTierFromServiceTier(tier);
      syncServiceTierDropdown();
      renderModelDropdown(
        evtOpts.getSelectedProvider(),
        evtOpts.getSelectedModelProfileId(),
      );
      evtOpts.refreshCustomModels();
      evtOpts.notifyChange();
      void configStore.save("providers", { ...config.providers });
    });
  };

  return {
    controlsWrapper,
    modelSelect,
    renderModelDropdown,
    syncServiceTierDropdown,
    syncTemperatureField,
    resolveCurrentSelectedModel,
    getEffectivePricingForOpenAIModel,
    getModelPriceLabel,
    wireEvents,
  };
}
