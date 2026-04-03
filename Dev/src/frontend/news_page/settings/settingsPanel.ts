import { ui_createElement } from "../../components/core/createElement";
import { DS_COMPONENTS } from "../../components/core/theme";
import {
  createSettingsPopoverScaffold,
  createSettingsPopoverController,
  createSettingsPanelTitle,
  createSettingsSectionCard,
  createSettingsToggleButton,
  createSettingsNumericInput,
  createSettingsControlWithUnit,
  appendSettingsMatrixRow,
  appendSettingsFormRow,
} from "../../components/core/settingsFramework";
import {
  BUILTIN_MODEL_OPTIONS,
  resolveMainModelLabel,
} from "../../../backend/services/ai/config/modelCatalog";
import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { KVStore } from "backend/core/db/core/KVStore";
import { AIConfigStore } from "../../../backend/services/ai/config/AIConfigStore";

type NewsRefreshSettingKey =
  | "newsYahooMacroRefreshInterval"
  | "newsYahooSymbolRefreshInterval"
  | "newsBarronsRefreshInterval"
  | "newsFinancialJuiceRefreshInterval";

type NewsEnableSettingKey =
  | "newsYahooMacroEnabled"
  | "newsYahooSymbolEnabled"
  | "newsBarronsEnabled"
  | "newsFinancialJuiceEnabled";

export interface NewsSettingsPanelResult {
  root: HTMLElement;
  cleanup: () => void;
}

export function createNewsSettingsPanel(opts: {
  settings: Record<string, unknown>;
  onUpdateSettings: ((newSettings: Record<string, unknown>) => void) | null;
  autoRefreshLabel: HTMLElement;
  getAutoRefreshLabel: () => string;
}): NewsSettingsPanelResult {
  const { settings, onUpdateSettings, autoRefreshLabel, getAutoRefreshLabel } =
    opts;
  const resolveInterval = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.round(parsed);
  };
  const resolveIntervalSeconds = (
    value: unknown,
    fallbackMs: number,
  ): number => {
    const ms = resolveInterval(value, fallbackMs);
    return Math.max(1, Math.round(ms / 1000));
  };

  const { wrap, button, panel } = createSettingsPopoverScaffold({
    title: "News Settings",
    ariaLabel: "News Settings",
  });
  panel.appendChild(createSettingsPanelTitle("News Settings"));

  const setBooleanSetting = (key: string, next: boolean): void => {
    if (!onUpdateSettings) return;
    onUpdateSettings({ [key]: next });
    settings[key] = next;
    autoRefreshLabel.textContent = getAutoRefreshLabel();
  };

  const createNewsIntervalInput = (
    key: NewsRefreshSettingKey,
    fallback: number,
  ) => {
    return createSettingsNumericInput({
      getResolved: () => resolveIntervalSeconds(settings[key], fallback),
      min: 1,
      step: 1,
      onCommit: (nextSeconds) => {
        const nextMs = Math.max(1_000, Math.round(nextSeconds * 1000));
        if (!onUpdateSettings) return;
        onUpdateSettings({ [key]: nextMs });
        settings[key] = nextMs;
        autoRefreshLabel.textContent = getAutoRefreshLabel();
      },
    });
  };

  const createNewsSourceRow = (
    body: HTMLElement,
    label: string,
    enableKey: NewsEnableSettingKey,
    intervalKey: NewsRefreshSettingKey,
    fallbackMs: number,
  ): void => {
    const intervalInput = createNewsIntervalInput(intervalKey, fallbackMs);
    const toggle = createSettingsToggleButton(
      (settings as any)[enableKey] !== false,
      (next) => {
        setBooleanSetting(enableKey, next);
        intervalInput.setDisabled(!next);
      },
    );
    appendSettingsMatrixRow({
      body,
      label,
      toggleEl: toggle.element,
      paramLabel: "interval",
      controlEl: createSettingsControlWithUnit(intervalInput.element, "sec"),
    });
    intervalInput.setDisabled(!toggle.isOn());
  };

  // -- Data Refresh --------------------------------------------------------
  const newsRefreshSection = createSettingsSectionCard("Data Refresh");
  createNewsSourceRow(
    newsRefreshSection.body,
    "Yahoo Macro",
    "newsYahooMacroEnabled",
    "newsYahooMacroRefreshInterval",
    120_000,
  );
  createNewsSourceRow(
    newsRefreshSection.body,
    "Yahoo Symbol",
    "newsYahooSymbolEnabled",
    "newsYahooSymbolRefreshInterval",
    120_000,
  );
  createNewsSourceRow(
    newsRefreshSection.body,
    "Barron's",
    "newsBarronsEnabled",
    "newsBarronsRefreshInterval",
    180_000,
  );
  createNewsSourceRow(
    newsRefreshSection.body,
    "FinancialJuice",
    "newsFinancialJuiceEnabled",
    "newsFinancialJuiceRefreshInterval",
    45_000,
  );
  panel.appendChild(newsRefreshSection.section);

  if (!onUpdateSettings) {
    panel.appendChild(
      ui_createElement("span", {
        text: "Source interval settings are unavailable in this context.",
        styleString: "font-size: 11px; color: var(--ios-text-secondary);",
      }),
    );
  }

  // -- News AI Model -------------------------------------------------------
  const newsAISection = createSettingsSectionCard("News AI Model");

  const newsModelSelect = ui_createElement("select", {
    styleString:
      DS_COMPONENTS.settingFieldInput +
      " width: 220px; box-sizing: border-box;",
  }) as HTMLSelectElement;
  newsModelSelect.disabled = true;
  const loadingOption = document.createElement("option");
  loadingOption.value = "";
  loadingOption.textContent = "Loading models...";
  newsModelSelect.appendChild(loadingOption);

  appendSettingsFormRow({
    body: newsAISection.body,
    label: "Model",
    controlEl: newsModelSelect,
  });

  panel.appendChild(newsAISection.section);

  let unbindModelChange: (() => void) | null = null;
  const loadNewsModelSettings = async (): Promise<void> => {
    try {
      const db = await openAlexQuantDB();
      const kv = new KVStore(db);
      const configStore = new AIConfigStore(kv);
      const [providers, allModels] = await Promise.all([
        configStore.getProviders(),
        configStore.getModels(),
      ]);

      const selectedProvider = providers.selected;
      const customModels = allModels.filter(
        (model) => model.provider === selectedProvider,
      );
      const mainModelLabel = resolveMainModelLabel(
        selectedProvider,
        providers.selectedModel,
        customModels,
      );

      newsModelSelect.innerHTML = "";
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = `(Use main model - ${mainModelLabel})`;
      newsModelSelect.appendChild(defaultOption);

      for (const model of BUILTIN_MODEL_OPTIONS[selectedProvider]) {
        const option = document.createElement("option");
        option.value = model.value;
        option.textContent = `${model.value} (${model.hint})`;
        newsModelSelect.appendChild(option);
      }

      for (const model of customModels) {
        const option = document.createElement("option");
        option.value = model.id;
        option.textContent = `${model.name} - ${model.model}`;
        newsModelSelect.appendChild(option);
      }

      const validValues = Array.from(newsModelSelect.options).map(
        (opt) => opt.value,
      );
      if (!validValues.includes(providers.newsModel)) {
        providers.newsModel = "";
        void configStore.save("providers", { ...providers });
      }

      newsModelSelect.value = providers.newsModel;
      newsModelSelect.disabled = false;

      const handleNewsModelChange = (): void => {
        providers.newsModel = newsModelSelect.value;
        void configStore.save("providers", { ...providers });
      };
      newsModelSelect.addEventListener("change", handleNewsModelChange);
      unbindModelChange = () =>
        newsModelSelect.removeEventListener("change", handleNewsModelChange);
    } catch {
      newsModelSelect.disabled = true;
      newsModelSelect.innerHTML = "";
      const fallbackOption = document.createElement("option");
      fallbackOption.value = "";
      fallbackOption.textContent = "Unable to load models";
      newsModelSelect.appendChild(fallbackOption);
    }
  };
  void loadNewsModelSettings();

  const popover = createSettingsPopoverController({ button, panel });
  return {
    root: wrap,
    cleanup: () => {
      unbindModelChange?.();
      popover.cleanup();
    },
  };
}
