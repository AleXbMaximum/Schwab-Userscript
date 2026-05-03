import { ui_createElement } from "../../components/core/builders/createElement";
import { DS_COMPONENTS } from "../../components/core/styles/theme";
import { createSettingsSectionCard, appendSettingsMatrixRow } from "../../components/core/settingsFramework";
import type{ AIProviderKind } from "shared/types/core";
import type { AIConfigSnapshot } from "../../../backend/services/ai/config/types";
import type { AIConfigStore } from "../../../backend/services/ai/config/AIConfigStore";

// ── Constants ────────────────────────────────────────────────────────────────

export const PROVIDER_OPTIONS: { value: AIProviderKind; label: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (ChatGPT)" },
  { value: "google", label: "Google (Gemini)" },
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProviderSectionResult {
  section: HTMLElement;
  providerSelect: HTMLSelectElement;
  apiKeyInput: HTMLInputElement;
  getStoredKeyForProvider(p: AIProviderKind): string;
  wireEvents(opts: {
    onProviderChange: (p: AIProviderKind) => void;
    onApiKeyBlur: () => void;
  }): void;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createProviderSection(opts: {
  config: AIConfigSnapshot;
  configStore: AIConfigStore;
  selectedProvider: AIProviderKind;
}): ProviderSectionResult {
  const { config, configStore, selectedProvider } = opts;
  const { settingFieldInput: fieldInputStyle } = DS_COMPONENTS;

  const getStoredKeyForProvider = (p: AIProviderKind): string => {
    if (p === "anthropic") return config.providers.anthropic.apiKey;
    if (p === "openai") return config.providers.openai.apiKey;
    return config.providers.google.apiKey;
  };

  const providerSection = createSettingsSectionCard("Provider");

  const providerSelect = ui_createElement("select", {
    styleString: fieldInputStyle + " width: 100%; box-sizing: border-box;",
  }) as HTMLSelectElement;
  for (const p of PROVIDER_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = p.value;
    opt.textContent = p.label;
    if (p.value === selectedProvider) opt.selected = true;
    providerSelect.appendChild(opt);
  }

  const apiKeyInput = ui_createElement("input", {
    props: {
      type: "password",
      value: getStoredKeyForProvider(selectedProvider),
      placeholder: "Enter API key",
    },
    styleString: fieldInputStyle + " width: 100%; box-sizing: border-box;",
  }) as HTMLInputElement;

  appendSettingsMatrixRow({
    body: providerSection.body,
    label: "Provider",
    toggleEl: providerSelect,
    paramLabel: "API Key",
    controlEl: apiKeyInput,
  });

  const wireEvents = (evtOpts: {
    onProviderChange: (p: AIProviderKind) => void;
    onApiKeyBlur: () => void;
  }) => {
    providerSelect.addEventListener("change", () => {
      evtOpts.onProviderChange(providerSelect.value as AIProviderKind);
    });

    apiKeyInput.addEventListener("blur", () => {
      const trimmedKey = apiKeyInput.value.trim();
      const prov = providerSelect.value as AIProviderKind;
      if (prov === "anthropic") config.providers.anthropic.apiKey = trimmedKey;
      else if (prov === "openai") config.providers.openai.apiKey = trimmedKey;
      else config.providers.google.apiKey = trimmedKey;
      void configStore.save("providers", { ...config.providers });
      evtOpts.onApiKeyBlur();
    });
  };

  return {
    section: providerSection.section,
    providerSelect,
    apiKeyInput,
    getStoredKeyForProvider,
    wireEvents,
  };
}
