import { ui_createElement } from "frontend/components/core/builders/createElement";
import { DS_COMPONENTS } from "frontend/components/core/styles/theme";
import {
  createSettingsSectionCard,
  createSettingsToggleButton,
  createSettingsNumericInput,
  createSettingsControlWithUnit,
  createSettingsActionButton,
  appendSettingsMatrixRow,
} from "frontend/components/core/settingsFramework";
import type { MonitorController } from "../monitor/MonitorController";
import {
  DEFAULT_MONITOR_SETTINGS,
  describeUniverseMode,
  type MonitorSettings,
  type MonitorUniverseMode,
} from "../monitor/monitorSettings";
import { showDatabaseInfoPopup, showPurgeWarning } from "./DatabaseInfoModal";
import { TickerGridManager, modeLabelText } from "./TickerGridManager";

export function optionFlowSettings_renderPage(
  ctx: any,
): HTMLElement & { cleanup?: () => void } {
  const mc = ctx?.monitorController as MonitorController | undefined;

  const wrapper = ui_createElement("div", {
    styleString: "display: flex; flex-direction: column; gap: 10px;",
  }) as HTMLElement & { cleanup?: () => void };

  const cleanups: (() => void)[] = [];

  // ── Monitor Control ──────────────────────────────────────────────────────────────────────
  const controlSection = createSettingsSectionCard("Monitor Control");

  const monitorToggle = createSettingsToggleButton(
    mc?.isEnabled() ?? false,
    (next) => {
      if (!mc) return;
      if (next) mc.start(true);
      else mc.stop();
      settingsToggle.setOn(next, { silent: true });
    },
  );

  const runNowBtn = createSettingsActionButton("Run Now");
  runNowBtn.addEventListener("click", () => {
    void mc?.runCycle("manual");
  });

  const controlLabelStyle =
    "font-size: 13px; font-weight: 600; color: var(--ios-text-primary);";

  const createControlActionRow = (
    label: string,
    cells: HTMLElement[],
    opts?: { expandableIndex?: number },
  ): HTMLElement => {
    const controlsHost = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; justify-content: flex-start;" +
        " gap: 6px; min-width: 0;",
    });
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      cell.style.minWidth = "0";
      if (opts?.expandableIndex === i) {
        cell.style.flex = "1 1 auto";
      }
      controlsHost.appendChild(cell);
    }
    return ui_createElement("div", {
      styleString:
        "display: grid; grid-template-columns: 96px minmax(0,1fr); align-items: center;" +
        " column-gap: 10px; min-height: 36px; padding: 4px 0;",
      children: [
        ui_createElement("span", {
          text: label,
          styleString: controlLabelStyle,
        }),
        controlsHost,
      ],
    });
  };

  const statusLabel = ui_createElement("span", {
    text: mc
      ? `${mc.getSymbols().length} tickers, ${mc.getSettings().intervalMinutes}m, ${describeUniverseMode(mc.getSettings().universeMode)}`
      : "No monitor controller.",
    styleString:
      "font-size: 12px; color: var(--ios-text-secondary); line-height: 1.3;" +
      " white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; max-width: 100%;",
  });

  const gridContainer = ui_createElement("div", {
    styleString:
      "display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;",
  });
  const tickerGrid = new TickerGridManager(mc, gridContainer);
  const refreshStatusGrid = () => tickerGrid.refreshStatusGrid();

  if (mc) {
    const unsubStatus = mc.subscribe((text, color) => {
      statusLabel.textContent = text;
      statusLabel.style.color = color ?? "var(--ios-text-secondary)";
      void refreshStatusGrid();
    });
    cleanups.push(unsubStatus);

    const unsubSymbol = mc.subscribeSymbolUpdates(() => {
      void refreshStatusGrid();
    });
    cleanups.push(unsubSymbol);
  }

  controlSection.body.appendChild(
    createControlActionRow(
      "Monitor",
      [monitorToggle.element, runNowBtn, statusLabel],
      { expandableIndex: 2 },
    ),
  );

  const infoBtn = createSettingsActionButton("Info");
  infoBtn.addEventListener("click", () => {
    showDatabaseInfoPopup(wrapper);
  });

  const compactHistoryBtn = createSettingsActionButton("Compact History", {
    width: 120,
  });
  compactHistoryBtn.addEventListener("click", () => {
    if (!mc) return;
    void mc.cleanData().then((result) => {
      statusLabel.textContent = `Compacted: ${result.before} → ${result.after} pts, ${result.touchedSymbols} symbols changed.`;
    });
  });

  const purgeAllBtn = createSettingsActionButton("Purge All Data", {
    variant: "danger",
    width: 120,
  });
  purgeAllBtn.addEventListener("click", () => {
    if (!mc) return;
    showPurgeWarning(wrapper, () => {
      void mc.purgeAllData().then((result) => {
        statusLabel.textContent = `Purge complete: ${result.purgedSymbols} symbols cleared.`;
        void refreshStatusGrid();
      });
    });
  });

  controlSection.body.appendChild(
    createControlActionRow("Database", [
      infoBtn,
      compactHistoryBtn,
      purgeAllBtn,
    ]),
  );

  wrapper.appendChild(controlSection.section);

  // ── Monitor Settings ─────────────────────────────────────────────────────────────────────
  const settingsSection = createSettingsSectionCard("Monitor Settings");

  const autoSave = (patch: Partial<MonitorSettings>): void => {
    if (!mc) return;
    mc.updateSettings(patch);
  };

  const intervalInput = createSettingsNumericInput({
    getResolved: () =>
      mc?.getSettings().intervalMinutes ??
      DEFAULT_MONITOR_SETTINGS.intervalMinutes,
    min: 1,
    step: 1,
    onCommit: (next) => {
      if (next >= 1 && next <= 60) autoSave({ intervalMinutes: next });
    },
  });

  const settingsToggle = createSettingsToggleButton(
    mc?.isEnabled() ?? false,
    (next) => {
      if (!mc) return;
      if (next) mc.start(true);
      else mc.stop();
      monitorToggle.setOn(next, { silent: true });
    },
  );

  appendSettingsMatrixRow({
    body: settingsSection.body,
    label: "Monitor",
    toggleEl: settingsToggle.element,
    paramLabel: "interval",
    controlEl: createSettingsControlWithUnit(intervalInput.element, "min"),
  });

  const concurrencyInput = createSettingsNumericInput({
    getResolved: () =>
      mc?.getSettings().concurrency ?? DEFAULT_MONITOR_SETTINGS.concurrency,
    min: 1,
    step: 1,
    onCommit: (next) => {
      if (next >= 1 && next <= 10) autoSave({ concurrency: next });
    },
  });

  appendSettingsMatrixRow({
    body: settingsSection.body,
    label: "Parallel",
    toggleEl: ui_createElement("div", { styleString: "width: 84px;" }),
    paramLabel: "threads",
    controlEl: concurrencyInput.element,
  });

  const modeSelect = ui_createElement("select", {
    styleString:
      DS_COMPONENTS.settingFieldInput +
      " width: 132px; box-sizing: border-box;",
  }) as HTMLSelectElement;
  const currentMode =
    mc?.getSettings().universeMode ?? DEFAULT_MONITOR_SETTINGS.universeMode;
  for (const mode of ["all", "top_n", "fixed_slots"] as MonitorUniverseMode[]) {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = modeLabelText(mode);
    option.selected = mode === currentMode;
    modeSelect.appendChild(option);
  }
  modeSelect.addEventListener("change", () => {
    const selectedMode =
      (modeSelect.value as MonitorUniverseMode) ||
      DEFAULT_MONITOR_SETTINGS.universeMode;
    autoSave({ universeMode: selectedMode });
    const shouldRunInitial =
      selectedMode === "top_n" || selectedMode === "fixed_slots";
    if (shouldRunInitial && mc) {
      statusLabel.textContent = `${modeLabelText(selectedMode)} applied. Running initial fetch...`;
      void mc.runCycle("manual").finally(() => {
        void refreshStatusGrid();
      });
      return;
    }
    void refreshStatusGrid();
  });

  appendSettingsMatrixRow({
    body: settingsSection.body,
    label: "Expiry",
    toggleEl: ui_createElement("div", { styleString: "width: 84px;" }),
    paramLabel: "method",
    controlEl: modeSelect,
  });

  wrapper.appendChild(settingsSection.section);

  // ── Ticker List ──────────────────────────────────────────────────────────────────────────
  const tickerSection = createSettingsSectionCard("Ticker List");

  const addInput = ui_createElement("input", {
    props: { type: "text", placeholder: "ADD TICKER" },
    styleString:
      DS_COMPONENTS.settingFieldInput +
      " width: 120px; text-transform: uppercase; box-sizing: border-box;",
  }) as HTMLInputElement;

  const doAdd = () => {
    if (!mc) return;
    const sym = addInput.value.trim().toUpperCase();
    if (!sym) return;
    const current = [...mc.getSymbols()];
    if (current.includes(sym)) {
      addInput.value = "";
      return;
    }
    current.push(sym);
    mc.updateSettings({ symbols: current });
    addInput.value = "";
    void refreshStatusGrid();
  };

  const addBtn = createSettingsActionButton("Add");
  addBtn.addEventListener("click", doAdd);
  addInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doAdd();
  });

  const resetBtn = createSettingsActionButton("Reset to Default", {
    width: 120,
  });
  resetBtn.style.opacity = "0.7";
  resetBtn.addEventListener("click", () => {
    if (!mc) return;
    mc.updateSettings({ symbols: [...DEFAULT_MONITOR_SETTINGS.symbols] });
    void refreshStatusGrid();
  });

  const tickerLabel = ui_createElement("span", {
    text: "Ticker",
    styleString:
      "font-size: 13px; font-weight: 600; color: var(--ios-text-primary);",
  });

  const addRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;",
    children: [tickerLabel, addInput, addBtn, resetBtn],
  });
  tickerSection.body.appendChild(addRow);

  tickerSection.body.appendChild(gridContainer);
  wrapper.appendChild(tickerSection.section);

  void refreshStatusGrid();

  wrapper.cleanup = () => {
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
  };

  return wrapper;
}
