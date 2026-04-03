import { ui_createElement } from "../../components/core/createElement";
import type { AIProviderKind } from "shared/types/core";
import type { AIConfigStore } from "../../../backend/services/ai/config/AIConfigStore";
import type { AIConfigSnapshot } from "../../../backend/services/ai/config/types";
import { BUILTIN_MODEL_OPTIONS } from "../../../backend/services/ai/config/modelCatalog";
import type { AISettingsPanelResult } from "../setting_panel/settingsPanel";
import { createAgentSelector } from "./agentSelector";
import { createDebateConfig } from "./debateConfig";

// ── Types ────────────────────────────────────────────────────────────────────

export type AnalystKey =
  | "market"
  | "fundamentals"
  | "sentiment_company"
  | "sentiment_macro"
  | "technicals"
  | "financial_quality"
  | "sellside"
  | "ownership";

export interface PipelineConfigState {
  getDebateRounds(): number;
  getRiskRounds(): number;
  getDebateIntensity(): import("shared/types/core").AIDebateIntensity;
  getDebateHeat(): number;
  getEnabledAnalysts(): string[];
  isMemoryEnabled(): boolean;
  isToolsEnabled(): boolean;
  isStreamingEnabled(): boolean;
  isWebSearchEnabled(): boolean;
  getPhaseModels(): Record<string, string>;
  depthBadge: HTMLElement;
  memoryBadge: HTMLElement;
  toolsBadge: HTMLElement;
}

export interface PipelineConfigResult {
  element: HTMLElement;
  state: PipelineConfigState;
  updateCostEstimate(): void;
  resolveModelForPhase(phase: string): string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_PILLS: { value: AIProviderKind; label: string }[] = [
  { value: "anthropic", label: "Claude" },
  { value: "openai", label: "ChatGPT" },
  { value: "google", label: "Gemini" },
];

const MODEL_OPTIONS = BUILTIN_MODEL_OPTIONS;

// ── Factory ──────────────────────────────────────────────────────────────────

export function createPipelineConfigPanel(opts: {
  config: AIConfigSnapshot;
  configStore: AIConfigStore;
  settingsPanel: AISettingsPanelResult;
  onCostUpdate: () => void;
  onFlowUpdate: () => void;
}): PipelineConfigResult {
  const { config, configStore, settingsPanel, onCostUpdate, onFlowUpdate } =
    opts;
  const resolveClientConfig = settingsPanel.resolveClientConfig;
  const getModelPriceLabel = settingsPanel.getModelPriceLabel;
  const phaseModels = { ...config.agentModels };

  // ── Persist helper ─────────────────────────────────────────────────────
  const persistPipeline = () =>
    void configStore.save("pipeline", {
      selectedAnalysts: agentSel.getEnabledAnalysts(),
      debateRounds: debateCfg.getDebateRounds(),
      riskRounds: debateCfg.getRiskRounds(),
      debateIntensity: debateCfg.getDebateIntensity(),
      debateHeat: debateCfg.getDebateHeat(),
      enableMemory: agentSel.isMemoryEnabled(),
      enableToolCalling: agentSel.isToolsEnabled(),
    });

  // ── Badges (exposed for symbol row) ────────────────────────────────────
  const badgeStyle =
    "font-size: 10px; padding: 2px 7px; border-radius: 6px; background: rgba(0,122,255,0.10);" +
    " color: var(--ios-blue); font-weight: 600; white-space: nowrap;";
  const depthBadge = ui_createElement("span", {
    text: `${config.pipeline.debateRounds}D \u00b7 ${config.pipeline.riskRounds}R`,
    styleString: badgeStyle,
  });
  const memoryBadge = ui_createElement("span", {
    text: "memory",
    styleString: badgeStyle,
  });
  const toolsBadge = ui_createElement("span", {
    text: "tools",
    styleString: badgeStyle,
  });

  // ── Agent selector ─────────────────────────────────────────────────────
  const agentSel = createAgentSelector({
    savedAnalysts: config.pipeline.selectedAnalysts as AnalystKey[],
    memoryEnabled: config.pipeline.enableMemory,
    toolsEnabled: config.pipeline.enableToolCalling,
    onAnalystChange: () => {
      onCostUpdate();
      onFlowUpdate();
      persistPipeline();
    },
    onMemoryChange: () => persistPipeline(),
    onToolsChange: () => persistPipeline(),
  });

  // ── Debate & risk config ───────────────────────────────────────────────
  const debateCfg = createDebateConfig({
    initialDebateRounds: config.pipeline.debateRounds,
    initialRiskRounds: config.pipeline.riskRounds,
    initialIntensity: config.pipeline.debateIntensity,
    initialHeat: config.pipeline.debateHeat,
    depthBadge,
    onCostUpdate,
    onFlowUpdate,
    onPersist: persistPipeline,
  });

  // ── Container ──────────────────────────────────────────────────────────
  const pipelineConfig = ui_createElement("div", {
    styleString:
      "display: flex; flex-direction: column; gap: 8px;" +
      " padding: 16px; background: rgba(255,255,255,0.7); -webkit-backdrop-filter: blur(12px);" +
      " backdrop-filter: blur(12px); border: 1px solid rgba(0,0,0,0.06); border-radius: 12px;",
  });

  // ── Streaming & web search toggles ────────────────────────────────────
  let streamingEnabled = false;
  let webSearchEnabled = false;

  const toggleStyle =
    "display: inline-flex; align-items: center; gap: 5px; font-size: 11px;" +
    " color: var(--ios-text-secondary); cursor: pointer; user-select: none;";
  const checkboxStyle =
    "width: 14px; height: 14px; cursor: pointer; accent-color: var(--ios-blue);";

  const streamingToggle = ui_createElement("label", {
    styleString: toggleStyle,
  });
  const streamingCb = ui_createElement("input", {
    props: { type: "checkbox", checked: false },
    styleString: checkboxStyle,
  }) as HTMLInputElement;
  streamingCb.addEventListener("change", () => {
    streamingEnabled = streamingCb.checked;
  });
  streamingToggle.appendChild(streamingCb);
  streamingToggle.appendChild(
    ui_createElement("span", { text: "Streaming" }),
  );

  const webSearchToggle = ui_createElement("label", {
    styleString: toggleStyle,
  });
  const webSearchCb = ui_createElement("input", {
    props: { type: "checkbox", checked: false },
    styleString: checkboxStyle,
  }) as HTMLInputElement;
  webSearchCb.addEventListener("change", () => {
    webSearchEnabled = webSearchCb.checked;
  });
  webSearchToggle.appendChild(webSearchCb);
  webSearchToggle.appendChild(
    ui_createElement("span", { text: "Web Search" }),
  );

  const streamingRow = ui_createElement("div", {
    styleString: "display: flex; align-items: center; gap: 16px;",
    children: [streamingToggle, webSearchToggle],
  });

  pipelineConfig.appendChild(agentSel.headerEl);
  pipelineConfig.appendChild(agentSel.gridEl);
  pipelineConfig.appendChild(agentSel.behaviorRow);
  pipelineConfig.appendChild(streamingRow);
  pipelineConfig.appendChild(debateCfg.debateRow);
  pipelineConfig.appendChild(debateCfg.riskRow);

  // ── Per-phase model dropdowns ──────────────────────────────────────────
  const phaseModelRow = ui_createElement("div", {
    styleString:
      "display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 6px;",
  });

  const buildPhaseDropdown = (
    label: string,
    phase: keyof typeof phaseModels,
  ): HTMLSelectElement => {
    const wrapper = ui_createElement("div", {
      styleString: "display: flex; flex-direction: column; gap: 2px;",
    });
    wrapper.appendChild(
      ui_createElement("span", {
        text: label,
        styleString: "font-size: 12px; color: var(--ios-text-secondary);",
      }),
    );
    const sel = ui_createElement("select", {
      styleString:
        "padding: 4px 6px; font-size: 12px; border: 1px solid var(--ios-border); border-radius: 6px;" +
        " font-family: var(--ios-font); background: rgba(255,255,255,0.8); outline: none; cursor: pointer;",
    }) as HTMLSelectElement;

    const defOpt = document.createElement("option");
    defOpt.value = "";
    defOpt.textContent = `Default (${resolveClientConfig(undefined).model})`;
    sel.appendChild(defOpt);

    for (const [prov, models] of Object.entries(MODEL_OPTIONS) as [
      AIProviderKind,
      typeof MODEL_OPTIONS.anthropic,
    ][]) {
      const grp = document.createElement("optgroup");
      grp.label = PROVIDER_PILLS.find((p) => p.value === prov)?.label ?? prov;
      for (const m of models) {
        const opt = document.createElement("option");
        opt.value = m.value;
        const price = getModelPriceLabel(prov, m.value);
        opt.textContent = `${m.value} (${m.hint}${price ? " \u00b7 " + price : ""})`;
        grp.appendChild(opt);
      }
      sel.appendChild(grp);
    }

    if (settingsPanel.getCustomModels().length > 0) {
      const customGrp = document.createElement("optgroup");
      customGrp.label = "Custom Models";
      for (const profile of settingsPanel.getCustomModels()) {
        const opt = document.createElement("option");
        opt.value = profile.id;
        const price = getModelPriceLabel(
          profile.provider,
          profile.model,
          profile,
        );
        opt.textContent = `${profile.name} (${profile.model}${price ? " \u00b7 " + price : ""})`;
        customGrp.appendChild(opt);
      }
      sel.appendChild(customGrp);
    }

    sel.addEventListener("change", () => {
      phaseModels[phase] = sel.value;
      onCostUpdate();
      void configStore.save("agentModels", { ...phaseModels });
    });

    wrapper.appendChild(sel);
    phaseModelRow.appendChild(wrapper);
    return sel;
  };

  buildPhaseDropdown("Analysts", "analysts");
  buildPhaseDropdown("Debate", "debate");
  buildPhaseDropdown("Trader", "trader");
  buildPhaseDropdown("Risk", "risk");
  pipelineConfig.appendChild(phaseModelRow);

  // ── Cost estimate helper ───────────────────────────────────────────────
  const resolveModelForPhase = (phase: keyof typeof phaseModels): string => {
    const profileId = phaseModels[phase];
    if (!profileId) return resolveClientConfig(undefined).model;
    const profile = settingsPanel
      .getCustomModels()
      .find((m) => m.id === profileId);
    if (profile) return profile.model;
    return profileId;
  };

  // ── Public interface ───────────────────────────────────────────────────
  return {
    element: pipelineConfig,
    state: {
      getDebateRounds: debateCfg.getDebateRounds,
      getRiskRounds: debateCfg.getRiskRounds,
      getDebateIntensity: debateCfg.getDebateIntensity,
      getDebateHeat: debateCfg.getDebateHeat,
      getEnabledAnalysts: agentSel.getEnabledAnalysts,
      isMemoryEnabled: agentSel.isMemoryEnabled,
      isToolsEnabled: agentSel.isToolsEnabled,
      isStreamingEnabled: () => streamingEnabled,
      isWebSearchEnabled: () => webSearchEnabled,
      getPhaseModels: () => ({ ...phaseModels }),
      depthBadge,
      memoryBadge,
      toolsBadge,
    },
    updateCostEstimate: () => {
      /* delegated to page — see resolveModelForPhase */
    },
    resolveModelForPhase,
  };
}
