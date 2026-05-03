import { ui_createElement } from "../components/core/builders/createElement";
import { DS_BUTTONS } from "../components/core/styles/theme";
import type { AIProviderKind, OpenAIPricingTier } from "shared/types/core";
import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { KVStore } from "backend/core/db/core/KVStore";
import type {
  AIAnalysisRecord,
  AIAnalysisState,
} from "../../backend/services/ai/types";
import { AIConfigStore } from "../../backend/services/ai/config/AIConfigStore";
import { AIAnalysisStore } from "../../backend/core/db/ai/AIAnalysisStore";
import { aiService } from "../../backend/services/ai/AIService";
import { estimateCost } from "../../backend/services/ai/config/pricing";
import { BUILTIN_MODEL_OPTIONS } from "../../backend/services/ai/config/modelCatalog";
import { createLiveResultsPanel } from "./components/LiveResultsPanel";
import { createAISettingsPanel } from "./setting_panel/settingsPanel";
import type { AISettingsPanelResult } from "./setting_panel/settingsPanel";
import { createPipelineConfigPanel } from "./pipeline/pipelineConfigPanel";
import { createPipelineFlow, buildPipelineNodes } from "./pipeline/pipelineFlow";
import { createReportList } from "./components/reportList";
import { logService } from "../../shared/log/core/LogService";
import {
  consumePendingSymbol,
  createSymbolInput,
} from "./orchestration/symbolInput";
import { runComparison } from "./orchestration/reportComparison";
import { runAnalysis } from "./orchestration/analysisRunner";

const log = logService.namespace("render");

// ── Page render ───────────────────────────────────────────────────────────────

export type AIAnalysisPageContainer = HTMLElement & { cleanup?: () => void };

export function aiAnalysis_renderPage(ctx: any): AIAnalysisPageContainer {
  const initialSymbol = consumePendingSymbol();
  log.info("ai.renderPage", { initialSymbol: initialSymbol || null });

  const container = ui_createElement("div", {
    className: "ai-analysis-container",
    styleString:
      "padding: 20px 24px; display: flex; flex-direction: column; gap: 16px;",
  }) as AIAnalysisPageContainer;

  void buildAIAnalysisPage(container, ctx, initialSymbol);

  return container;
}

async function buildAIAnalysisPage(
  container: AIAnalysisPageContainer,
  _ctx: any,
  initialSymbol: string,
): Promise<void> {
  // ── Load AI config from independent store ─────────────────────────────────
  const db = await openAlexQuantDB();
  const kvStore = new KVStore(db);
  const configStore = new AIConfigStore(kvStore);
  const config = await configStore.loadAll();

  // ── Page header ───────────────────────────────────────────────────────────
  const pageHeader = ui_createElement("div", {
    styleString:
      "display: flex; align-items: flex-start; gap: 12px; justify-content: space-between;",
  });

  const headerText = ui_createElement("div", {
    styleString:
      "display: flex; flex-direction: column; gap: 4px; min-width: 0;",
  });
  headerText.appendChild(
    ui_createElement("span", {
      text: "AI Analysis",
      styleString:
        "font-size: 20px; font-weight: 700; color: var(--ios-text-primary);",
    }),
  );
  headerText.appendChild(
    ui_createElement("span", {
      text: "Multi-agent trading analysis pipeline",
      styleString: "font-size: 12px; color: var(--ios-text-secondary);",
    }),
  );
  pageHeader.appendChild(headerText);

  // ── Settings panel ───────────────────────────────────────────────────────
  const settingsPanel: AISettingsPanelResult = createAISettingsPanel({
    config,
    configStore,
    onSettingsChange: () => updateCostEstimate(),
  });
  pageHeader.appendChild(settingsPanel.root);
  container.appendChild(pageHeader);

  const resolveClientConfig = settingsPanel.resolveClientConfig;
  const getEffectivePricingForOpenAIModel =
    settingsPanel.getEffectivePricingForOpenAIModel;

  const MODEL_OPTIONS = BUILTIN_MODEL_OPTIONS;
  const ALL_BUILTIN_MODELS: { value: string; provider: AIProviderKind }[] = [];
  for (const [prov, models] of Object.entries(MODEL_OPTIONS) as [
    AIProviderKind,
    typeof MODEL_OPTIONS.anthropic,
  ][]) {
    for (const m of models)
      ALL_BUILTIN_MODELS.push({ value: m.value, provider: prov });
  }

  // ── Symbol row ────────────────────────────────────────────────────────────
  const { symbolRow, symbolInput } = createSymbolInput(initialSymbol);

  // ── Pipeline config panel ────────────────────────────────────────────────
  const pipelineConfig = createPipelineConfigPanel({
    config,
    configStore,
    settingsPanel,
    onCostUpdate: () => updateCostEstimate(),
    onFlowUpdate: () => updatePipelineFlow(),
  });

  symbolRow.appendChild(ui_createElement("span", { styleString: "flex: 1;" }));
  symbolRow.appendChild(pipelineConfig.state.depthBadge);
  symbolRow.appendChild(pipelineConfig.state.memoryBadge);
  symbolRow.appendChild(pipelineConfig.state.toolsBadge);
  container.appendChild(symbolRow);

  // ── Focus topic row ──────────────────────────────────────────────────────
  const focusRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px;" +
      " padding: 8px 16px; border: 1px solid var(--ax-border); border-radius: var(--ax-radius-2xl);" +
      " background: var(--ax-glass-2-bg);",
  });
  focusRow.appendChild(
    ui_createElement("span", {
      text: "Focus",
      styleString:
        "font-size: 12px; font-weight: 600; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;",
    }),
  );
  const focusInput = ui_createElement("input", {
    props: {
      type: "text",
      placeholder: 'e.g. "Buy 180 call", "Sell covered puts at 160"',
    },
    styleString:
      "flex: 1; padding: 5px 10px; font-size: var(--ax-fs-lg); border: 1px solid var(--ax-border);" +
      " border-radius: var(--ax-radius-md); outline: none; font-family: var(--ax-font-body);" +
      " background: var(--ax-bg-input); color: var(--ax-fg);",
  }) as HTMLInputElement;
  focusRow.appendChild(focusInput);
  container.appendChild(focusRow);

  // ── Pipeline config element ──────────────────────────────────────────────
  container.appendChild(pipelineConfig.element);

  // ── Ticker panel (shown after symbol entered) ─────────────────────────────
  const tickerPanel = ui_createElement("div", {
    styleString: "display: none; flex-direction: column; gap: 10px;",
  });
  container.appendChild(tickerPanel);

  // Action bar
  const actionBar = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 10px; flex-wrap: wrap;",
  });

  const newReportBtn = ui_createElement("button", {
    text: "\u25b6 New Report",
    styleString:
      DS_BUTTONS.primary +
      " padding: 8px 16px; font-size: 13px; border-radius: 10px;",
  }) as HTMLButtonElement;

  const compareBtn = ui_createElement("button", {
    text: "\u21c4 Compare Reports",
    styleString:
      DS_BUTTONS.secondary +
      " padding: 8px 16px; font-size: 13px; border-radius: 10px;",
  }) as HTMLButtonElement;
  compareBtn.disabled = true;
  compareBtn.style.opacity = "0.45";

  const cancelBtn = ui_createElement("button", {
    text: "\u25fc Cancel",
    styleString:
      "padding: 8px 16px; font-size: 13px; border-radius: 10px; cursor: pointer; display: none;" +
      " background: rgba(215,49,38,0.12); border: 1px solid rgba(215,49,38,0.25); color: var(--ios-red);",
  }) as HTMLButtonElement;

  const statusLabel = ui_createElement("span", {
    text: "",
    styleString:
      "font-size: 12px; color: var(--ios-text-secondary); flex: 1; min-width: 0;",
  });

  const costBadge = ui_createElement("span", {
    text: "",
    styleString:
      "font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 8px;" +
      " background: rgba(215,129,0,0.10); color: var(--ios-orange); white-space: nowrap;",
  });

  // ── Cost estimation ───────────────────────────────────────────────────────

  const resolveModelForPhase = (phase: string): string => {
    const phaseModels = pipelineConfig.state.getPhaseModels();
    const profileId = phaseModels[phase];
    if (!profileId) return resolveClientConfig(undefined).model;
    const profile = settingsPanel
      .getCustomModels()
      .find((m) => m.id === profileId);
    if (profile) return profile.model;
    return profileId;
  };

  const resolveOpenAIPricingTierForPhase = (
    phase: string,
  ): OpenAIPricingTier => {
    const phaseModels = pipelineConfig.state.getPhaseModels();
    const profileId = phaseModels[phase];
    if (!profileId) {
      const cfg = resolveClientConfig(undefined);
      return cfg.provider === "openai"
        ? getEffectivePricingForOpenAIModel(cfg.model, false)
        : "standard";
    }
    const profile = settingsPanel
      .getCustomModels()
      .find((m) => m.id === profileId);
    if (profile) {
      return profile.provider === "openai"
        ? getEffectivePricingForOpenAIModel(
            profile.model,
            true,
            profile.openAIServiceTier,
          )
        : "standard";
    }
    const builtin = ALL_BUILTIN_MODELS.find((m) => m.value === profileId);
    return builtin?.provider === "openai"
      ? getEffectivePricingForOpenAIModel(builtin.value, false)
      : "standard";
  };

  const updateCostEstimate = () => {
    const numAnalysts = pipelineConfig.state.getEnabledAnalysts().length;
    const debateRounds = pipelineConfig.state.getDebateRounds();
    const riskRounds = pipelineConfig.state.getRiskRounds();
    const cost = estimateCost({
      numAnalysts,
      debateRounds,
      riskRounds,
      analystModel: resolveModelForPhase("analysts"),
      debateModel: resolveModelForPhase("debate"),
      traderModel: resolveModelForPhase("trader"),
      riskModel: resolveModelForPhase("risk"),
      analystOpenAIPricingTier: resolveOpenAIPricingTierForPhase("analysts"),
      debateOpenAIPricingTier: resolveOpenAIPricingTierForPhase("debate"),
      traderOpenAIPricingTier: resolveOpenAIPricingTierForPhase("trader"),
      riskOpenAIPricingTier: resolveOpenAIPricingTierForPhase("risk"),
    });
    costBadge.textContent = cost > 0 ? `Est. ~$${cost.toFixed(2)}` : "Est. N/A";
  };
  updateCostEstimate();

  actionBar.appendChild(newReportBtn);
  actionBar.appendChild(costBadge);
  actionBar.appendChild(compareBtn);
  actionBar.appendChild(cancelBtn);
  actionBar.appendChild(statusLabel);
  tickerPanel.appendChild(actionBar);

  // ── Report list ──────────────────────────────────────────────────────────
  const reportList = createReportList({
    onSelectReport: showResults,
    onDeleteReport: async (symbol, recordId) => {
      const rdb = await openAlexQuantDB();
      const store = new AIAnalysisStore(rdb);
      await store.deleteAnalysis(symbol, recordId);
      resultsSection.style.display = "none";
      resultsSection.innerHTML = "";
      await loadReports(symbol);
    },
    statusLabel,
    compareBtn,
  });
  tickerPanel.appendChild(reportList.element);

  // ── Pipeline flow ────────────────────────────────────────────────────────
  const pipelineFlow = createPipelineFlow();

  const updatePipelineFlow = (state?: AIAnalysisState | null) => {
    const numAnalysts = pipelineConfig.state.getEnabledAnalysts().length;
    const nodes = buildPipelineNodes(
      numAnalysts,
      pipelineConfig.state.getDebateRounds(),
      pipelineConfig.state.getRiskRounds(),
    );
    pipelineFlow.update(state ?? pipelineFlow.getState(), nodes);
  };

  updatePipelineFlow(null);
  container.appendChild(pipelineFlow.element);

  // ── Results section ───────────────────────────────────────────────────────
  const resultsSection = ui_createElement("div", {
    styleString: "display: none; flex-direction: column; gap: 12px;",
  });
  container.appendChild(resultsSection);

  // ── State ─────────────────────────────────────────────────────────────────
  let unsubscribe: (() => void) | null = null;
  let unsubscribeStream: (() => void) | null = null;
  let isRunning = false;
  let currentSymbol = initialSymbol;

  // ── Streaming stage card management ────────────────────────────────────
  const liveResults = createLiveResultsPanel({ resultsSection });

  // ── Show a full report in the results section ─────────────────────────────
  function showResults(record: AIAnalysisRecord): void {
    const completedState: AIAnalysisState = {
      recordId: record.id,
      symbol: record.symbol,
      phase: record.status === "completed" ? "complete" : "error",
      progress: 100,
      progressLabel: "",
      stages: record.stages,
      finalDecision: record.finalDecision ?? null,
      error: null,
      startedAt: new Date(record.requestedAt).getTime(),
    };
    updatePipelineFlow(completedState);
    liveResults.showRecord(record);
  }

  // ── Load all reports for a symbol ─────────────────────────────────────────
  const loadReports = async (sym: string): Promise<void> => {
    try {
      const rdb = await openAlexQuantDB();
      const store = new AIAnalysisStore(rdb);
      const records = await store.getAllForSymbol(sym);
      reportList.render(records);
    } catch {
      /* ignore */
    }
  };

  const showTickerPanel = (sym: string) => {
    currentSymbol = sym;
    tickerPanel.style.display = "flex";
    statusLabel.textContent = "";
    void loadReports(sym);
  };

  // ── Progress renderer ─────────────────────────────────────────────────────
  const renderProgress = (state: AIAnalysisState) => {
    statusLabel.textContent = state.progressLabel;
    updatePipelineFlow(state);
    liveResults.finalizeFromState(state);
  };

  // ── Subscribe to AIService (survives page navigation) ─────────────────────
  unsubscribe = aiService.subscribe(renderProgress);
  unsubscribeStream = aiService.subscribeStream(liveResults.handleStream);

  if (aiService.isRunning()) {
    const runningState = aiService.getState();
    if (runningState) {
      isRunning = true;
      currentSymbol = runningState.symbol;
      symbolInput.value = runningState.symbol;
      tickerPanel.style.display = "flex";
      newReportBtn.style.display = "none";
      compareBtn.style.display = "none";
      cancelBtn.style.display = "";
      void loadReports(runningState.symbol);
    }
  }

  // ── Button wiring ─────────────────────────────────────────────────────────
  newReportBtn.addEventListener("click", () => {
    void handleNewReport();
  });
  compareBtn.addEventListener("click", () => {
    void handleCompare();
  });
  cancelBtn.addEventListener("click", () => {
    aiService.cancel();
  });

  const handleCompare = async (): Promise<void> => {
    const allReports = reportList.getAllReports();
    const completed = allReports.filter((r) => r.status === "completed");
    await runComparison({
      symbol: currentSymbol,
      completedReports: completed,
      resolveClientConfig,
      statusLabel,
      resultsSection,
      onButtonStateChange: (disabled) => {
        compareBtn.disabled = disabled;
        newReportBtn.disabled = disabled;
        if (!disabled) {
          const doneCompleted = reportList
            .getAllReports()
            .filter((r) => r.status === "completed");
          compareBtn.disabled = doneCompleted.length < 2;
          compareBtn.style.opacity = doneCompleted.length < 2 ? "0.45" : "1";
        }
      },
    });
  };

  const handleNewReport = async (): Promise<void> => {
    const symbol = symbolInput.value.trim().toUpperCase();
    if (!symbol) {
      window.alert("Please enter a ticker symbol.");
      return;
    }
    if (isRunning) return;

    symbolInput.value = symbol;
    currentSymbol = symbol;
    isRunning = true;
    newReportBtn.style.display = "none";
    costBadge.style.display = "none";
    compareBtn.style.display = "none";
    cancelBtn.style.display = "";
    resultsSection.style.display = "none";
    resultsSection.innerHTML = "";
    pipelineFlow.collapse();
    updatePipelineFlow(null);
    statusLabel.textContent = "Starting analysis\u2026";

    // Clear streaming state from previous run
    liveResults.reset();

    try {
      const result = await runAnalysis({
        symbol,
        focusTopic: focusInput.value.trim(),
        resolveClientConfig,
        pipelineState: pipelineConfig.state,
        alphaVantageKey: config.general.alphaVantageApiKey,
        enableStreaming: pipelineConfig.state.isStreamingEnabled(),
        enableWebSearch: pipelineConfig.state.isWebSearchEnabled(),
      });
      showResults(result.record);
      statusLabel.textContent = result.statusText;
      await loadReports(symbol);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "NO_API_KEY") {
        window.alert(
          "Please configure your AI API key from the AI Analysis settings menu (top-right gear).",
        );
        statusLabel.textContent = "";
      } else {
        statusLabel.textContent =
          msg !== "Cancelled" ? `Error: ${msg}` : "Cancelled.";
      }
    } finally {
      isRunning = false;
      newReportBtn.style.display = "";
      costBadge.style.display = "";
      compareBtn.style.display = "";
      cancelBtn.style.display = "none";
    }
  };

  // ── Symbol input wiring ───────────────────────────────────────────────────
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const commitSymbol = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    const sym = symbolInput.value.trim().toUpperCase();
    symbolInput.value = sym;
    if (!sym || isRunning) return;
    resultsSection.style.display = "none";
    resultsSection.innerHTML = "";
    showTickerPanel(sym);
  };

  symbolInput.addEventListener("input", () => {
    const raw = symbolInput.value.trim().toUpperCase();
    if (!raw) {
      tickerPanel.style.display = "none";
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      symbolInput.value = raw;
      if (!isRunning) showTickerPanel(raw);
    }, 600);
  });

  symbolInput.addEventListener("blur", commitSymbol);
  symbolInput.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") symbolInput.blur();
  });

  // ── Initial load ──────────────────────────────────────────────────────────
  if (initialSymbol) {
    showTickerPanel(initialSymbol);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  container.cleanup = () => {
    settingsPanel.cleanup();
    if (debounceTimer) clearTimeout(debounceTimer);
    unsubscribe?.();
    unsubscribe = null;
    unsubscribeStream?.();
    unsubscribeStream = null;
    liveResults.reset();
  };
}
