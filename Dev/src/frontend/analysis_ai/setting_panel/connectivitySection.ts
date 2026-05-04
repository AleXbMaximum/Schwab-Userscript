import { ui_createElement } from "../../components/core/builders/createElement";
import { DS_COMPONENTS } from "../../components/core/styles/theme";
import {
  createSettingsSectionCard,
  createSettingsActionButton,
  appendSettingsMatrixRow,
} from "../../components/core/settingsFramework";
import type{ AIModelProfile, AIProviderKind } from "shared/types/core";
import {
  createLLMClient,
  type LLMClientConfig,
} from "../../../backend/core/network/llm/LLMClient";
import { BUILTIN_MODEL_OPTIONS } from "../../../backend/services/ai/config/modelCatalog";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConnectivitySectionResult {
  section: HTMLElement;
  refreshDropdown(): void;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createConnectivitySection(opts: {
  selectedProvider: () => AIProviderKind;
  getCustomModels: () => AIModelProfile[];
  resolveClientConfig: (profileId: string | undefined) => LLMClientConfig;
  getStoredKeyForProvider: (p: AIProviderKind) => string;
}): ConnectivitySectionResult {
  const {
    selectedProvider,
    getCustomModels,
    resolveClientConfig,
    getStoredKeyForProvider,
  } = opts;
  const { settingFieldInput: fieldInputStyle } = DS_COMPONENTS;
  const MODEL_OPTIONS = BUILTIN_MODEL_OPTIONS;

  const connectivitySection = createSettingsSectionCard("Connectivity");

  const testResultsEl = ui_createElement("div", {
    styleString:
      "display: none; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; padding: 0 16px 8px;",
  });

  const singleTestSelect = ui_createElement("select", {
    styleString: fieldInputStyle + " width: 100%; box-sizing: border-box;",
  }) as HTMLSelectElement;

  const renderTestModelDropdown = (): void => {
    const provider = selectedProvider();
    singleTestSelect.innerHTML = "";
    for (const opt of MODEL_OPTIONS[provider]) {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = `${opt.value} (${opt.hint})`;
      singleTestSelect.appendChild(el);
    }
    for (const profile of getCustomModels()) {
      if (profile.provider !== provider) continue;
      const el = document.createElement("option");
      el.value = profile.id;
      el.textContent = `${profile.model} (${profile.name})`;
      singleTestSelect.appendChild(el);
    }
  };

  const testAllBtn = createSettingsActionButton("Test All", { width: 84 });
  const testSingleBtn = createSettingsActionButton("Test", { width: 60 });

  appendSettingsMatrixRow({
    body: connectivitySection.body,
    label: "",
    toggleEl: testAllBtn,
    paramLabel: "test",
    controlEl: ui_createElement("div", {
      styleString: "display: flex; align-items: center; gap: 4px;",
      children: [singleTestSelect, testSingleBtn],
    }),
  });
  connectivitySection.section.appendChild(testResultsEl);

  const runModelTest = async (
    _label: string,
    testConfig: LLMClientConfig,
    statusSpan: HTMLElement,
    detailSpan: HTMLElement,
  ): Promise<void> => {
    if (!testConfig.apiKey) {
      statusSpan.textContent = "\u2717";
      statusSpan.style.color = "var(--ios-red)";
      detailSpan.textContent = "No API key";
      return;
    }
    try {
      const client = createLLMClient(testConfig);
      const start = Date.now();
      const resp = await client.complete({
        systemPrompt: "You are a test assistant.",
        messages: [{ role: "user", content: "Hello" }],
        maxTokens: 20,
        temperature: 0,
      });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      statusSpan.textContent = "\u2713";
      statusSpan.style.color = "var(--ios-green)";
      detailSpan.textContent = `OK \u00b7 ${elapsed}s \u00b7 ${resp.tokensUsed} tok`;
    } catch (err) {
      statusSpan.textContent = "\u2717";
      statusSpan.style.color = "var(--ios-red)";
      detailSpan.textContent =
        err instanceof Error ? err.message.slice(0, 60) : "Error";
    }
  };

  const createTestResultRow = (
    label: string,
  ): { row: HTMLElement; statusSpan: HTMLElement; detailSpan: HTMLElement } => {
    const row = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 6px; font-size: 11px;",
    });
    const statusSpan = ui_createElement("span", {
      text: "\u23f3",
      styleString: "flex-shrink: 0; width: 14px; text-align: center;",
    });
    row.appendChild(statusSpan);
    row.appendChild(
      ui_createElement("span", {
        text: label,
        styleString:
          "color: var(--ios-text-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
      }),
    );
    const detailSpan = ui_createElement("span", {
      text: "testing\u2026",
      styleString: "color: var(--ios-text-secondary); white-space: nowrap;",
    });
    row.appendChild(detailSpan);
    return { row, statusSpan, detailSpan };
  };

  testAllBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    testAllBtn.disabled = true;
    testAllBtn.textContent = "Testing\u2026";
    testResultsEl.innerHTML = "";
    testResultsEl.style.display = "flex";

    const provider = selectedProvider();
    const modelsToTest: { label: string; config: LLMClientConfig }[] = [];
    for (const opt of MODEL_OPTIONS[provider]) {
      modelsToTest.push({
        label: `${opt.value} (${opt.hint})`,
        config: {
          provider,
          apiKey: getStoredKeyForProvider(provider),
          model: opt.value,
          maxTokens: 20,
          openAIServiceTier: "auto",
        },
      });
    }
    for (const profile of getCustomModels()) {
      if (profile.provider !== provider) continue;
      modelsToTest.push({
        label: `${profile.model} (${profile.name})`,
        config: resolveClientConfig(profile.id),
      });
    }

    for (const entry of modelsToTest) {
      const { row, statusSpan, detailSpan } = createTestResultRow(entry.label);
      testResultsEl.appendChild(row);
      await runModelTest(entry.label, entry.config, statusSpan, detailSpan);
    }

    testAllBtn.disabled = false;
    testAllBtn.textContent = "Test All";
  });

  testSingleBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const profileId = singleTestSelect.value;
    if (!profileId) return;
    testSingleBtn.disabled = true;
    testSingleBtn.textContent = "\u2026";
    testResultsEl.innerHTML = "";
    testResultsEl.style.display = "flex";

    const testConfig = resolveClientConfig(profileId);
    const { row, statusSpan, detailSpan } = createTestResultRow(profileId);
    testResultsEl.appendChild(row);
    await runModelTest(profileId, testConfig, statusSpan, detailSpan);

    testSingleBtn.disabled = false;
    testSingleBtn.textContent = "Test";
  });

  // Initial render
  renderTestModelDropdown();

  return {
    section: connectivitySection.section,
    refreshDropdown: renderTestModelDropdown,
  };
}
