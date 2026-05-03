import { ui_createElement } from "../../components/core/builders/createElement";
import {
  createSettingsPopoverScaffold,
  createSettingsPopoverController,
  createSettingsPanelTitle,
  createSettingsSectionCard,
  createSettingsToggleButton,
  appendSettingsMatrixRow,
} from "../../components/core/settingsFramework";
import type{
  AIModelProfile,
  AIProviderKind,
  OpenAIPricingTier,
  OpenAIServiceTier,
} from "shared/types/core";
import type { AIConfigSnapshot } from "../../../backend/services/ai/config/types";
import type { AIConfigStore } from "../../../backend/services/ai/config/AIConfigStore";
import type { LLMClientConfig } from "../../../backend/core/network/llm/LLMClient";
import { BUILTIN_MODEL_OPTIONS } from "../../../backend/services/ai/config/modelCatalog";
import { buildLLMClientConfig } from "../../../backend/services/ai/config/clientConfigFactory";
import { createCustomModelSection } from "./customModelSection";
import { createConnectivitySection } from "./connectivitySection";
import { createProviderSection } from "./providerSection";
import { createModelSection } from "./modelSection";

// ── Constants ────────────────────────────────────────────────────────────────

const MODEL_OPTIONS = BUILTIN_MODEL_OPTIONS;

// ── Exported interface ───────────────────────────────────────────────────────

export interface AISettingsPanelResult {
  root: HTMLElement;
  cleanup: () => void;
  getSelectedProvider: () => AIProviderKind;
  getSelectedModelProfileId: () => string;
  getCustomModels: () => AIModelProfile[];
  resolveClientConfig: (profileId: string | undefined) => LLMClientConfig;
  getStoredKeyForProvider: (p: AIProviderKind) => string;
  getEffectivePricingForOpenAIModel: (
    model: string,
    isCustom: boolean,
    profileServiceTier?: OpenAIServiceTier,
  ) => OpenAIPricingTier;
  getModelPriceLabel: (
    provider: AIProviderKind,
    model: string,
    profile?: AIModelProfile,
  ) => string;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createAISettingsPanel(opts: {
  config: AIConfigSnapshot;
  configStore: AIConfigStore;
  onSettingsChange?: () => void;
}): AISettingsPanelResult {
  const { config, configStore, onSettingsChange } = opts;

  const { wrap, button, panel } = createSettingsPopoverScaffold({
    title: "AI Agent Settings",
    ariaLabel: "AI Agent Settings",
  });
  panel.appendChild(createSettingsPanelTitle("AI Agent Settings"));

  // ── Shared mutable state ─────────────────────────────────────────────────
  let selectedProvider: AIProviderKind = config.providers.selected;

  const ALL_BUILTIN_MODELS: { value: string; provider: AIProviderKind }[] = [];
  for (const [prov, models] of Object.entries(MODEL_OPTIONS) as [
    AIProviderKind,
    typeof MODEL_OPTIONS.anthropic,
  ][]) {
    for (const m of models)
      ALL_BUILTIN_MODELS.push({ value: m.value, provider: prov });
  }

  // ── Provider section ─────────────────────────────────────────────────────
  const providerSec = createProviderSection({
    config,
    configStore,
    selectedProvider,
  });
  panel.appendChild(providerSec.section);

  const getStoredKeyForProvider = providerSec.getStoredKeyForProvider;

  // ── Custom model section ─────────────────────────────────────────────────
  const customModelSection = createCustomModelSection({
    config,
    configStore,
    selectedProvider: () => selectedProvider,
    getModelPriceLabel: (...args) => modelSec.getModelPriceLabel(...args),
    onModelsChanged: () => {
      selectedModelProfileId = resolveProviderModelChoice(
        selectedProvider,
        selectedModelProfileId,
      );
      persistSelectedModel();
      modelSec.renderModelDropdown(selectedProvider, selectedModelProfileId);
      modelSec.syncServiceTierDropdown();
      modelSec.syncTemperatureField();
    },
  });

  const customModels = customModelSection.getCustomModels;

  // ── Model section ────────────────────────────────────────────────────────
  const modelSec = createModelSection({
    config,
    configStore,
    selectedProvider: () => selectedProvider,
    getCustomModels: customModels,
    allBuiltinModels: ALL_BUILTIN_MODELS,
  });

  // ── Model resolution ─────────────────────────────────────────────────────
  const resolveProviderModelChoice = (
    provider: AIProviderKind,
    candidate: string | undefined,
  ): string => {
    if (candidate) {
      if (MODEL_OPTIONS[provider].some((m) => m.value === candidate))
        return candidate;
      const custom = customModels().find(
        (m) => m.id === candidate && m.provider === provider,
      );
      if (custom) return custom.id;
    }
    return MODEL_OPTIONS[provider][0].value;
  };

  const initialSelectedModel = config.providers.selectedModel;
  let selectedModelProfileId = resolveProviderModelChoice(
    selectedProvider,
    initialSelectedModel,
  );
  config.providers.selectedModel = selectedModelProfileId;
  if (initialSelectedModel !== selectedModelProfileId) {
    void configStore.save("providers", { ...config.providers });
  }

  const resolveClientConfig = (
    profileId: string | undefined,
  ): LLMClientConfig => {
    const targetId =
      profileId && profileId.trim().length > 0
        ? profileId
        : selectedModelProfileId;

    if (targetId) {
      const profile = customModels().find((m) => m.id === targetId);
      if (profile) {
        return buildLLMClientConfig({
          provider: profile.provider,
          apiKey: getStoredKeyForProvider(profile.provider),
          model: profile.model,
          isCustomModel: true,
          maxTokens: profile.maxTokens ?? config.general.maxTokens,
          temperature: profile.temperature ?? config.general.temperature,
          serviceTier:
            profile.openAIServiceTier ?? config.providers.openai.serviceTier,
        });
      }
      const builtin = ALL_BUILTIN_MODELS.find((m) => m.value === targetId);
      if (builtin) {
        return buildLLMClientConfig({
          provider: builtin.provider,
          apiKey: getStoredKeyForProvider(builtin.provider),
          model: builtin.value,
          isCustomModel: false,
          maxTokens: config.general.maxTokens,
          temperature: config.general.temperature,
          serviceTier: config.providers.openai.serviceTier,
        });
      }
    }

    const fallback = MODEL_OPTIONS[selectedProvider][0].value;
    return buildLLMClientConfig({
      provider: selectedProvider,
      apiKey: getStoredKeyForProvider(selectedProvider),
      model: fallback,
      isCustomModel: false,
      maxTokens: config.general.maxTokens,
      temperature: config.general.temperature,
      serviceTier: config.providers.openai.serviceTier,
    });
  };

  const persistSelectedModel = (): void => {
    config.providers.selectedModel = selectedModelProfileId;
    void configStore.save("providers", { ...config.providers });
    onSettingsChange?.();
  };

  const notifyChange = (): void => {
    onSettingsChange?.();
  };

  // ── Assemble model section into panel ─────────────────────────────────────
  const modelSectionEl = customModelSection.section;
  const modelSectionBody =
    (modelSectionEl.querySelector("[data-settings-body]") as HTMLElement) ??
    (modelSectionEl.children[1] as HTMLElement);

  if (modelSectionBody.firstChild) {
    modelSectionBody.insertBefore(
      modelSec.controlsWrapper,
      modelSectionBody.firstChild,
    );
  } else {
    modelSectionBody.appendChild(modelSec.controlsWrapper);
  }

  panel.appendChild(modelSectionEl);

  // ── Data Sources section ─────────────────────────────────────────────────
  const dataSection = createSettingsSectionCard("Additional Data Sources");
  panel.appendChild(dataSection.section);

  const alphaVantageInput = ui_createElement("input", {
    props: {
      type: "password",
      value: config.general.alphaVantageApiKey,
      placeholder: "Enter API key",
    },
    styleString:
      "padding: 5px 8px; font-size: var(--ax-fs-md); border: 1px solid var(--ax-border); border-radius: 6px; outline: none; font-family: var(--ax-font-body); background: var(--ax-bg-input);" +
      " width: 100%; box-sizing: border-box;",
  }) as HTMLInputElement;

  const alphaVantageToggle = createSettingsToggleButton(
    config.general.autoFetchData,
    (next) => {
      config.general.autoFetchData = next;
      void configStore.save("general", { ...config.general });
      alphaVantageInput.disabled = !next;
      alphaVantageInput.style.opacity = next ? "1" : "0.55";
    },
  );

  appendSettingsMatrixRow({
    body: dataSection.body,
    label: "AlphaVantage",
    toggleEl: alphaVantageToggle.element,
    paramLabel: "API Key",
    controlEl: alphaVantageInput,
  });

  alphaVantageInput.addEventListener("blur", () => {
    config.general.alphaVantageApiKey = alphaVantageInput.value.trim();
    void configStore.save("general", { ...config.general });
  });

  // ── Connectivity section ─────────────────────────────────────────────────
  const connectivity = createConnectivitySection({
    selectedProvider: () => selectedProvider,
    getCustomModels: customModels,
    resolveClientConfig,
    getStoredKeyForProvider,
  });
  panel.appendChild(connectivity.section);

  // ── Wire cross-section events ─────────────────────────────────────────────

  const switchProvider = (p: AIProviderKind): void => {
    selectedProvider = p;
    config.providers.selected = p;
    selectedModelProfileId = resolveProviderModelChoice(
      p,
      config.providers.selectedModel,
    );
    config.providers.selectedModel = selectedModelProfileId;
    void configStore.save("providers", { ...config.providers });
    providerSec.apiKeyInput.value = getStoredKeyForProvider(p);
    modelSec.renderModelDropdown(p, selectedModelProfileId);
    modelSec.syncServiceTierDropdown();
    modelSec.syncTemperatureField();
    connectivity.refreshDropdown();
    notifyChange();
  };

  providerSec.wireEvents({
    onProviderChange: switchProvider,
    onApiKeyBlur: () => {},
  });

  modelSec.wireEvents({
    getSelectedModelProfileId: () => selectedModelProfileId,
    setSelectedModelProfileId: (id) => {
      selectedModelProfileId = id;
    },
    persistSelectedModel,
    getSelectedProvider: () => selectedProvider,
    notifyChange,
    refreshCustomModels: () => customModelSection.refreshAfterChange(),
  });

  // ── Initial sync ─────────────────────────────────────────────────────────
  modelSec.renderModelDropdown(selectedProvider, selectedModelProfileId);
  modelSec.syncServiceTierDropdown();
  modelSec.syncTemperatureField();

  // ── Popover controller ───────────────────────────────────────────────────
  const popover = createSettingsPopoverController({
    button,
    panel,
    extraInsideTargets: [customModelSection.formEl],
  });

  return {
    root: wrap,
    cleanup: () => {
      popover.cleanup();
    },
    getSelectedProvider: () => selectedProvider,
    getSelectedModelProfileId: () => selectedModelProfileId,
    getCustomModels: customModels,
    resolveClientConfig,
    getStoredKeyForProvider,
    getEffectivePricingForOpenAIModel:
      modelSec.getEffectivePricingForOpenAIModel,
    getModelPriceLabel: modelSec.getModelPriceLabel,
  };
}
