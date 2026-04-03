import { ui_createElement } from "../../components/core/createElement";
import { DS_COMPONENTS, DS_BUTTONS, DS_TYPOGRAPHY } from "../../components/core/theme";
import {
  createSettingsSectionCard,
  createSettingsActionButton,
  appendSettingsFormRow,
} from "../../components/core/settingsFramework";
import type{
  AIModelProfile,
  AIProviderKind,
  OpenAIPricingTier,
  OpenAIServiceTier,
} from "shared/types/core";
import { generateUUID } from "shared/utils/uuid";
import type { AIConfigSnapshot } from "../../../backend/services/ai/config/types";
import type { AIConfigStore } from "../../../backend/services/ai/config/AIConfigStore";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CustomModelSectionResult {
  section: HTMLElement;
  formEl: HTMLElement;
  getCustomModels(): AIModelProfile[];
  refreshAfterChange(): void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_OPTIONS: { value: AIProviderKind; label: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (ChatGPT)" },
  { value: "google", label: "Google (Gemini)" },
];

// ── Factory ──────────────────────────────────────────────────────────────────

export function createCustomModelSection(opts: {
  config: AIConfigSnapshot;
  configStore: AIConfigStore;
  selectedProvider: () => AIProviderKind;
  getModelPriceLabel: (
    provider: AIProviderKind,
    model: string,
    profile?: AIModelProfile,
  ) => string;
  onModelsChanged: () => void;
}): CustomModelSectionResult {
  const {
    config,
    configStore,
    selectedProvider,
    getModelPriceLabel,
    onModelsChanged,
  } = opts;
  const { settingFieldInput: fieldInputStyle } = DS_COMPONENTS;

  const customModels: AIModelProfile[] = [...config.models];

  // ── Section ──────────────────────────────────────────────────────────────
  const modelSection = createSettingsSectionCard("Model Configuration");

  // Custom Models row
  const addCustomModelBtn = createSettingsActionButton("+ Add Model", {
    width: 100,
  });
  appendSettingsFormRow({
    body: modelSection.body,
    label: "Custom models",
    controlEl: addCustomModelBtn,
  });

  // Custom model list
  const customModelListEl = ui_createElement("div", {
    styleString:
      "display: flex; flex-direction: column; gap: 4px; padding: 0 16px 8px;",
  });
  modelSection.section.appendChild(customModelListEl);

  // Custom model form (hidden by default)
  const customModelFormEl = ui_createElement("div", {
    styleString:
      "display: none; flex-direction: column; gap: 6px; padding: 8px 16px; margin: 0 16px 8px;" +
      " border: 1px solid var(--ios-border); border-radius: 8px; background: rgba(0,122,255,0.03);",
  });
  customModelFormEl.addEventListener("mousedown", (e) => e.stopPropagation());
  customModelFormEl.addEventListener("click", (e) => e.stopPropagation());
  modelSection.section.appendChild(customModelFormEl);

  let editingProfileId: string | null = null;

  const createFormField = (
    label: string,
    inputEl: HTMLElement,
  ): HTMLElement => {
    const field = ui_createElement("div", {
      styleString: "display: flex; flex-direction: column; gap: 4px;",
    });
    field.appendChild(
      ui_createElement("span", {
        text: label,
        styleString: DS_COMPONENTS.settingFieldLabel,
      }),
    );
    field.appendChild(inputEl);
    return field;
  };

  const cmNameInput = ui_createElement("input", {
    props: { type: "text", placeholder: "Profile name (e.g. Opus Fast)" },
    styleString: fieldInputStyle + " width: 100%; box-sizing: border-box;",
  }) as HTMLInputElement;

  const cmProviderSelect = ui_createElement("select", {
    styleString: fieldInputStyle,
  }) as HTMLSelectElement;
  for (const p of PROVIDER_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = p.value;
    opt.textContent = p.label;
    cmProviderSelect.appendChild(opt);
  }

  const cmModelInput = ui_createElement("input", {
    props: { type: "text", placeholder: "Model ID (e.g. claude-sonnet-4-6)" },
    styleString:
      fieldInputStyle +
      " width: 100%; box-sizing: border-box;" +
      DS_TYPOGRAPHY.mono,
  }) as HTMLInputElement;

  const cmMaxTokensInput = ui_createElement("input", {
    props: { type: "number", placeholder: "4096", min: 100 },
    styleString: fieldInputStyle + " width: 100%; box-sizing: border-box;",
  }) as HTMLInputElement;

  const cmTempInput = ui_createElement("input", {
    props: { type: "number", placeholder: "0.3", min: 0, max: 1, step: 0.1 },
    styleString: fieldInputStyle + " width: 100%; box-sizing: border-box;",
  }) as HTMLInputElement;

  const cmTierSelect = ui_createElement("select", {
    styleString: fieldInputStyle,
  }) as HTMLSelectElement;
  for (const t of [
    { v: "auto", l: "Auto" },
    { v: "default", l: "Default" },
    { v: "flex", l: "Flex" },
    { v: "priority", l: "Priority" },
  ]) {
    const opt = document.createElement("option");
    opt.value = t.v;
    opt.textContent = t.l;
    cmTierSelect.appendChild(opt);
  }
  const cmTierField = createFormField("OpenAI Service Tier", cmTierSelect);

  const cmPricingTierSelect = ui_createElement("select", {
    styleString: fieldInputStyle,
  }) as HTMLSelectElement;
  for (const t of [
    { v: "standard", l: "Standard Pricing" },
    { v: "flex", l: "Flex Pricing" },
    { v: "batch", l: "Batch Pricing" },
  ]) {
    const opt = document.createElement("option");
    opt.value = t.v;
    opt.textContent = t.l;
    cmPricingTierSelect.appendChild(opt);
  }
  const cmPricingTierField = createFormField(
    "OpenAI Pricing Tier",
    cmPricingTierSelect,
  );

  customModelFormEl.appendChild(createFormField("Name", cmNameInput));
  customModelFormEl.appendChild(createFormField("Provider", cmProviderSelect));
  customModelFormEl.appendChild(createFormField("Model ID", cmModelInput));
  customModelFormEl.appendChild(
    createFormField("Max Tokens (optional)", cmMaxTokensInput),
  );
  customModelFormEl.appendChild(
    createFormField("Temperature (optional)", cmTempInput),
  );
  customModelFormEl.appendChild(cmTierField);
  customModelFormEl.appendChild(cmPricingTierField);

  cmProviderSelect.addEventListener("change", () => {
    const isOpenAI = cmProviderSelect.value === "openai";
    cmTierField.style.display = isOpenAI ? "" : "none";
    cmPricingTierField.style.display = isOpenAI ? "" : "none";
  });
  cmTierField.style.display = "none";
  cmPricingTierField.style.display = "none";

  const cmFormActions = ui_createElement("div", {
    styleString: "display: flex; gap: 6px; justify-content: flex-end;",
  });
  const cmCancelBtn = ui_createElement("button", {
    text: "Cancel",
    styleString:
      DS_BUTTONS.secondary +
      " padding: 4px 10px; font-size: 11px; border-radius: 8px;",
  }) as HTMLButtonElement;
  const cmSaveBtn = ui_createElement("button", {
    text: "Save",
    styleString:
      DS_BUTTONS.primary +
      " padding: 4px 10px; font-size: 11px; border-radius: 8px;",
  }) as HTMLButtonElement;
  cmFormActions.appendChild(cmCancelBtn);
  cmFormActions.appendChild(cmSaveBtn);
  customModelFormEl.appendChild(cmFormActions);

  const closeCustomModelForm = (): void => {
    customModelFormEl.style.display = "none";
    editingProfileId = null;
    cmNameInput.value = "";
    cmModelInput.value = "";
    cmMaxTokensInput.value = "";
    cmTempInput.value = "";
    cmProviderSelect.value = "anthropic";
    cmTierSelect.value = "auto";
    cmPricingTierSelect.value = "standard";
    cmTierField.style.display = "none";
    cmPricingTierField.style.display = "none";
  };

  const openCustomModelFormForCreate = (provider: AIProviderKind): void => {
    closeCustomModelForm();
    cmProviderSelect.value = provider;
    const isOpenAI = provider === "openai";
    cmTierField.style.display = isOpenAI ? "" : "none";
    cmPricingTierField.style.display = isOpenAI ? "" : "none";
    if (isOpenAI)
      cmPricingTierSelect.value = config.providers.openai.pricingTier;
    customModelFormEl.style.display = "flex";
  };

  cmCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeCustomModelForm();
  });
  addCustomModelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openCustomModelFormForCreate(selectedProvider());
  });

  const renderCustomModelList = (): void => {
    customModelListEl.innerHTML = "";
    for (const profile of customModels) {
      const row = ui_createElement("div", {
        styleString:
          "display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 8px;" +
          " border: 1px solid var(--ios-border); background: rgba(255,255,255,0.5);",
      });
      const provLabel =
        PROVIDER_OPTIONS.find((p) => p.value === profile.provider)?.label ??
        profile.provider;
      const price = getModelPriceLabel(
        profile.provider,
        profile.model,
        profile,
      );
      row.appendChild(
        ui_createElement("span", {
          text: profile.name,
          styleString:
            "font-size: 11px; font-weight: 600; color: var(--ios-text-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
        }),
      );
      row.appendChild(
        ui_createElement("span", {
          text: `${provLabel} \u00b7 ${profile.model}${price ? " \u00b7 " + price : ""}`,
          styleString:
            "font-size: 10px; color: var(--ios-text-secondary); white-space: nowrap;",
        }),
      );
      const editBtn = ui_createElement("button", {
        text: "\u270e",
        styleString:
          "background: none; border: none; cursor: pointer; font-size: 12px; color: var(--ios-blue); padding: 0 2px;",
      }) as HTMLButtonElement;
      editBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        editingProfileId = profile.id;
        cmNameInput.value = profile.name;
        cmProviderSelect.value = profile.provider;
        cmModelInput.value = profile.model;
        cmMaxTokensInput.value = profile.maxTokens?.toString() ?? "";
        cmTempInput.value = profile.temperature?.toString() ?? "";
        cmTierSelect.value = profile.openAIServiceTier ?? "auto";
        cmPricingTierSelect.value =
          profile.openAIPricingTier ?? config.providers.openai.pricingTier;
        cmTierField.style.display = profile.provider === "openai" ? "" : "none";
        cmPricingTierField.style.display =
          profile.provider === "openai" ? "" : "none";
        customModelFormEl.style.display = "flex";
      });
      const delBtn = ui_createElement("button", {
        text: "\u00d7",
        styleString:
          "background: none; border: none; cursor: pointer; font-size: 13px; color: var(--ios-red); padding: 0 2px;",
      }) as HTMLButtonElement;
      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = customModels.findIndex((m) => m.id === profile.id);
        if (idx >= 0) customModels.splice(idx, 1);
        refreshAfterChange();
        void configStore.save("models", [...customModels]);
      });
      row.appendChild(editBtn);
      row.appendChild(delBtn);
      customModelListEl.appendChild(row);
    }
    if (customModels.length === 0) {
      customModelListEl.appendChild(
        ui_createElement("span", {
          text: "No custom models yet.",
          styleString: "font-size: 10px; color: var(--ios-text-secondary);",
        }),
      );
    }
  };

  const refreshAfterChange = (): void => {
    renderCustomModelList();
    onModelsChanged();
  };

  cmSaveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const name = cmNameInput.value.trim();
    const model = cmModelInput.value.trim();
    if (!name || !model) return;
    const profile: AIModelProfile = {
      id: editingProfileId ?? generateUUID(),
      name,
      provider: cmProviderSelect.value as AIProviderKind,
      model,
      ...(cmMaxTokensInput.value
        ? { maxTokens: parseInt(cmMaxTokensInput.value, 10) }
        : {}),
      ...(cmTempInput.value
        ? { temperature: parseFloat(cmTempInput.value) }
        : {}),
      ...(cmProviderSelect.value === "openai"
        ? {
            openAIServiceTier: cmTierSelect.value as OpenAIServiceTier,
            openAIPricingTier: cmPricingTierSelect.value as OpenAIPricingTier,
          }
        : {}),
    };
    if (editingProfileId) {
      const idx = customModels.findIndex((m) => m.id === editingProfileId);
      if (idx >= 0) customModels[idx] = profile;
    } else {
      customModels.push(profile);
    }
    closeCustomModelForm();
    refreshAfterChange();
    void configStore.save("models", [...customModels]);
  });

  // Initial render
  renderCustomModelList();

  return {
    section: modelSection.section,
    formEl: customModelFormEl,
    getCustomModels: () => customModels,
    refreshAfterChange,
  };
}
