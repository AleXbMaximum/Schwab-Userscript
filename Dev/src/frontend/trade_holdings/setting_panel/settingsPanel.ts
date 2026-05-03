import type { HoldingsViewCtx, SchedulerOverride } from "shared/types/core";
import type { OrchestratorPhase } from "shared/utils/time";
import type { PhaseSourceKey } from "backend/pipeline/orchestration/PhaseManager";
import { getPhaseSourceDefault } from "backend/pipeline/orchestration/PhaseManager";
import { ui_createElement } from "../../components/core/builders/createElement";
import {
  createSettingsPopoverScaffold,
  createSettingsPopoverController,
  createSettingsPanelTitle,
  createSettingsSectionCard,
  createSettingsToggleButton,
  createSettingsNumericInput,
  createSettingsControlWithUnit,
  createSettingsAutoValue,
  appendSettingsMatrixRow,
  appendSettingsFormRow,
  appendPhaseMatrixRow,
  createPhaseStrip,
  createStatusDot,
  updateStatusDot,
  createPhaseBadge,
  createSettingsSectionCardWithBadge,
  createSettingsActionButton,
  createSettingsJsonEditorModal,
  resolveInterval,
  resolveNonNegativeInterval,
  type PhaseStripController,
} from "../../components/core/settingsFramework";
import { ui_copyTextToClipboard } from "../../components/core/behaviors/clipboard";
import { exportAllHistory, importAllHistory } from "backend/pipeline/snapshot/historyPersistence";

type SparklineStoreLike = {
  setRefreshInterval: (nextMs: number) => void;
};

export interface HoldingsSettingsPanelResult {
  root: HTMLElement;
  cleanup: () => void;
}

export interface PhaseMatrixApi {
  getCurrentPhase: () => OrchestratorPhase;
  getSchedulerStatus: (key: string) => {
    isFetching: boolean;
    error: unknown | null;
    isPaused: boolean;
  };
  setSourceOverride: (key: PhaseSourceKey, state: SchedulerOverride) => void;
  getSourceOverride: (key: PhaseSourceKey) => SchedulerOverride;
  subscribeToPhaseChange: (
    cb: (phase: OrchestratorPhase) => void,
  ) => () => void;
}

export function createHoldingsSettingsPanel(opts: {
  ctx: HoldingsViewCtx;
  settings: Record<string, unknown>;
  sparklineStores: SparklineStoreLike[];
  phaseApi: PhaseMatrixApi;
}): HoldingsSettingsPanelResult {
  const { ctx, settings, sparklineStores, phaseApi } = opts;

  const { wrap, button, panel } = createSettingsPopoverScaffold({
    title: "Holdings Settings",
    ariaLabel: "Holdings Settings",
  });
  panel.appendChild(createSettingsPanelTitle("Holdings Settings"));

  const DEFAULT_SPARKLINE_INTERVAL = 300_000; // 5 min
  const DEFAULT_ARCHIVE_THRESHOLD = 200_000;

  const setNumericSetting = (key: string, next: number): void => {
    ctx.onUpdateSettings({ [key]: next } as any);
    settings[key] = next;
  };

  const createNumericInput = (inputOpts: {
    key: string;
    fallback: number;
    min: number;
    step: number;
    allowZero?: boolean;
    onCommit?: (next: number) => void;
  }) =>
    createSettingsNumericInput({
      getResolved: () =>
        inputOpts.allowZero
          ? resolveNonNegativeInterval(
              settings[inputOpts.key],
              inputOpts.fallback,
            )
          : resolveInterval(settings[inputOpts.key], inputOpts.fallback),
      min: inputOpts.min,
      step: inputOpts.step,
      allowZero: inputOpts.allowZero,
      onCommit: (next) => {
        setNumericSetting(inputOpts.key, next);
        inputOpts.onCommit?.(next);
      },
    });

  const buildHoldingsTablePatch = (parsed: any): any => {
    if (!parsed || typeof parsed !== "object") {
      throw new Error("root must be an object");
    }
    const patch: any = {};
    if ("holdingsTableViewModes" in parsed)
      patch.holdingsTableViewModes = parsed.holdingsTableViewModes;
    if ("holdingsTableActiveViewModeId" in parsed) {
      patch.holdingsTableActiveViewModeId =
        parsed.holdingsTableActiveViewModeId;
    }
    return patch;
  };

  const getCurrentTableConfig = (): {
    holdingsTableActiveViewModeId: unknown;
    holdingsTableViewModes: unknown;
  } => ({
    holdingsTableActiveViewModeId: settings.holdingsTableActiveViewModeId,
    holdingsTableViewModes: settings.holdingsTableViewModes,
  });

  const applyHoldingsTablePatch = (patch: Record<string, unknown>): void => {
    ctx.onUpdateSettings(patch as any);
    Object.assign(settings, patch);
  };

  const parseHoldingsTablePatch = (raw: string): Record<string, unknown> =>
    buildHoldingsTablePatch(JSON.parse(raw || "{}"));

  // ── Per-source override state (keyed by source+phase, in-memory only) ──
  // The backend override map is per-source (for the CURRENT phase).
  // The UI needs per-source-per-phase overrides for the full 5×6 matrix.
  // We store the UI-level overrides locally and sync the current-phase
  // overrides to the backend.
  const uiOverrides = new Map<string, SchedulerOverride>();

  const overrideKey = (source: string, phase: OrchestratorPhase): string =>
    `${source}:${phase}`;

  const getUiOverride = (
    source: string,
    phase: OrchestratorPhase,
  ): SchedulerOverride =>
    uiOverrides.get(overrideKey(source, phase)) ?? "auto";

  const setUiOverride = (
    source: string,
    phase: OrchestratorPhase,
    state: SchedulerOverride,
  ): void => {
    if (state === "auto") {
      uiOverrides.delete(overrideKey(source, phase));
    } else {
      uiOverrides.set(overrideKey(source, phase), state);
    }
    // If this is the current phase, push to backend
    if (phase === phaseApi.getCurrentPhase()) {
      phaseApi.setSourceOverride(source as PhaseSourceKey, state);
    }
  };

  // ── Data Refresh ────────────────────────────────────────────────────────
  const currentPhase = phaseApi.getCurrentPhase();
  const phaseBadge = createPhaseBadge(currentPhase);
  const dataRefresh = createSettingsSectionCardWithBadge(
    "Data Refresh",
    phaseBadge.element,
  );
  panel.appendChild(dataRefresh.section);

  // Track all phase strips and dots for periodic updates
  const phaseStrips: { key: PhaseSourceKey; strip: PhaseStripController }[] =
    [];
  const statusDots: { key: string; dot: HTMLElement }[] = [];

  // Helper to build a phase-matrix row for a scheduler source
  const addPhaseRow = (
    sourceKey: PhaseSourceKey,
    label: string,
    controlEl: HTMLElement,
  ): void => {
    const dot = createStatusDot();
    statusDots.push({ key: sourceKey, dot });

    const strip = createPhaseStrip({
      onOverrideChange: (phase, next) => {
        setUiOverride(sourceKey, phase, next);
        refreshAllStrips();
      },
      getOverride: (phase) => getUiOverride(sourceKey, phase),
      getDefault: (phase) => getPhaseSourceDefault(phase, sourceKey),
      currentPhase: phaseApi.getCurrentPhase(),
    });
    phaseStrips.push({ key: sourceKey, strip });

    appendPhaseMatrixRow({
      body: dataRefresh.body,
      label,
      dot,
      phaseStrip: strip.strip,
      controlEl,
    });
  };

  const refreshAllStrips = (): void => {
    const cp = phaseApi.getCurrentPhase();
    for (const { key, strip } of phaseStrips) {
      strip.updateAll(
        cp,
        (phase) => getUiOverride(key, phase),
        (phase) => getPhaseSourceDefault(phase, key),
      );
    }
  };

  // ── Holdings ──
  const holdingsInterval = createNumericInput({
    key: "holdingsRefreshInterval",
    fallback: 10_000,
    min: 100,
    step: 100,
  });
  addPhaseRow(
    "holdings",
    "Holdings",
    createSettingsControlWithUnit(holdingsInterval.element, "ms"),
  );

  // ── Indices / Quotes ──
  const quotesInterval = createNumericInput({
    key: "quotesRefreshInterval",
    fallback: 15_000,
    min: 100,
    step: 100,
  });
  addPhaseRow(
    "quotes",
    "Indices",
    createSettingsControlWithUnit(quotesInterval.element, "ms"),
  );

  // ── Balances ──
  const balancesInterval = createNumericInput({
    key: "balancesRefreshInterval",
    fallback: 1_000,
    min: 100,
    step: 100,
  });
  addPhaseRow(
    "balances",
    "Balances",
    createSettingsControlWithUnit(balancesInterval.element, "ms"),
  );

  // ── Streamer ──
  addPhaseRow("streamer", "Streamer", createSettingsAutoValue());

  // ── Overnight ──
  addPhaseRow("overnight", "Overnight", createSettingsAutoValue());

  // ── Sparkline ──
  const sparklineInterval = createNumericInput({
    key: "sparklineRefreshInterval",
    fallback: DEFAULT_SPARKLINE_INTERVAL,
    min: 0,
    step: 60_000,
    allowZero: true,
    onCommit: (next) => {
      for (const s of sparklineStores) s.setRefreshInterval(next);
    },
  });
  addPhaseRow(
    "sparkline",
    "Sparkline",
    createSettingsControlWithUnit(sparklineInterval.element, "ms"),
  );

  // ── Status polling (only while popover is open) ──
  let statusTimer: ReturnType<typeof setInterval> | null = null;

  const pollStatus = (): void => {
    // Update dots
    for (const { key, dot } of statusDots) {
      // For non-scheduler sources, derive status from overrides + phase defaults
      if (key === "streamer" || key === "overnight" || key === "sparkline") {
        const cp = phaseApi.getCurrentPhase();
        const override = getUiOverride(key, cp);
        const defaultOn = getPhaseSourceDefault(cp, key);
        const effectiveOn =
          override === "auto" ? defaultOn : override === "forceOn";
        updateStatusDot(dot, {
          isFetching: false,
          error: null,
          isPaused: !effectiveOn,
        });
      } else {
        updateStatusDot(dot, phaseApi.getSchedulerStatus(key));
      }
    }
  };

  const startPolling = (): void => {
    if (statusTimer !== null) return;
    pollStatus(); // immediate
    statusTimer = setInterval(pollStatus, 1000);
  };

  const stopPolling = (): void => {
    if (statusTimer !== null) {
      clearInterval(statusTimer);
      statusTimer = null;
    }
  };

  // ── Phase change subscription ──
  const unsubPhase = phaseApi.subscribeToPhaseChange((newPhase) => {
    phaseBadge.update(newPhase);
    // Sync overrides for the new current phase to the backend
    for (const { key } of phaseStrips) {
      const override = getUiOverride(key, newPhase);
      phaseApi.setSourceOverride(key, override);
    }
    refreshAllStrips();
    pollStatus();
  });

  // ── Storage ─────────────────────────────────────────────────────────────
  const storage = createSettingsSectionCard("Storage");
  panel.appendChild(storage.section);

  const captureInterval = createNumericInput({
    key: "accountSnapshotIntervalMs",
    fallback: 10_000,
    min: 1_000,
    step: 1_000,
  });
  appendSettingsFormRow({
    body: storage.body,
    label: "Capture interval",
    controlEl: createSettingsControlWithUnit(captureInterval.element, "ms"),
  });
  appendSettingsFormRow({
    body: storage.body,
    label: "Snapshot record on 7PM-3AM CT",
    controlEl: createSettingsToggleButton(
      (settings as any).accountSnapshotRecordNight === true,
      (next) => {
        ctx.onUpdateSettings({ accountSnapshotRecordNight: next } as any);
        settings.accountSnapshotRecordNight = next;
      },
    ).element,
  });

  const archiveThreshold = createNumericInput({
    key: "accountSnapshotArchiveThreshold",
    fallback: DEFAULT_ARCHIVE_THRESHOLD,
    min: 10_000,
    step: 10_000,
  });
  const autoArchive = createSettingsToggleButton(
    (settings as any).accountSnapshotAutoArchive !== false,
    (next) => {
      ctx.onUpdateSettings({ accountSnapshotAutoArchive: next } as any);
      settings.accountSnapshotAutoArchive = next;
      archiveThreshold.setDisabled(!next);
    },
  );
  appendSettingsMatrixRow({
    body: storage.body,
    label: "Auto-archive",
    toggleEl: autoArchive.element,
    paramLabel: "threshold",
    controlEl: createSettingsControlWithUnit(archiveThreshold.element, "rows"),
  });
  archiveThreshold.setDisabled(!autoArchive.isOn());

  // ── Snapshot History Import / Export ──
  const historyFileInput = ui_createElement("input", {
    props: { type: "file", accept: ".json,application/json" },
    styleString: "display:none;",
  }) as HTMLInputElement;
  storage.section.appendChild(historyFileInput);

  historyFileInput.addEventListener("change", async () => {
    const file = historyFileInput.files?.[0];
    historyFileInput.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid format");
      const result = await importAllHistory(parsed);
      window.alert(
        `Imported ${result.historyCount} history + ${result.archiveCount} archive points.`,
      );
    } catch (e) {
      window.alert(`Import failed: ${(e as any)?.message ?? String(e)}`);
    }
  });

  const historyExportBtn = createSettingsActionButton("Export");
  historyExportBtn.addEventListener("click", async () => {
    try {
      const data = await exportAllHistory();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alexquant-history-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(`Export failed: ${(e as any)?.message ?? String(e)}`);
    }
  });

  const historyImportBtn = createSettingsActionButton("Import");
  historyImportBtn.addEventListener("click", () => historyFileInput.click());

  appendSettingsFormRow({
    body: storage.body,
    label: "Snapshot History",
    controlEl: ui_createElement("div", {
      styleString: "display:flex; justify-self:end; gap:8px;",
      children: [historyExportBtn, historyImportBtn],
    }),
  });

  // ── Holdings Table Control ──────────────────────────────────────────────
  const tableControl = createSettingsSectionCard("Holdings Table Control");
  panel.appendChild(tableControl.section);

  const holdingsTableModal = createSettingsJsonEditorModal({
    title: "Holdings Table JSON",
    description:
      'Edit `holdingsTableViewModes` and `holdingsTableActiveViewModeId` directly when bulk-adjusting saved table layouts.',
    getValue: () => JSON.stringify(getCurrentTableConfig(), null, 2),
    validate: (raw) => {
      try {
        parseHoldingsTablePatch(raw);
        return null;
      } catch (e) {
        return `Invalid JSON: ${(e as any)?.message ?? String(e)}`;
      }
    },
    onApply: (raw) => {
      applyHoldingsTablePatch(parseHoldingsTablePatch(raw));
    },
  });
  wrap.appendChild(holdingsTableModal.backdrop);
  document.addEventListener("keydown", holdingsTableModal.onEscapeHandler);

  const tableFileInput = ui_createElement("input", {
    props: { type: "file", accept: ".json,application/json" },
    styleString: "display:none;",
  }) as HTMLInputElement;
  tableControl.section.appendChild(tableFileInput);

  tableFileInput.addEventListener("change", async () => {
    const file = tableFileInput.files?.[0];
    tableFileInput.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      applyHoldingsTablePatch(parseHoldingsTablePatch(text));
      holdingsTableModal.refreshValue();
    } catch (e) {
      window.alert(`Invalid JSON: ${(e as any)?.message ?? String(e)}`);
    }
  });

  const viewBtn = createSettingsActionButton("View");
  viewBtn.addEventListener("click", () => holdingsTableModal.setOpen(true));
  const importBtn = createSettingsActionButton("Import");
  importBtn.addEventListener("click", () => tableFileInput.click());
  const exportBtn = createSettingsActionButton("Export");
  exportBtn.addEventListener("click", async () => {
    await ui_copyTextToClipboard(
      JSON.stringify(getCurrentTableConfig(), null, 2),
    );
  });

  appendSettingsFormRow({
    body: tableControl.body,
    label: "Holdings Table JSON",
    controlEl: ui_createElement("div", {
      styleString: "display:flex; justify-self:end; gap:8px;",
      children: [viewBtn, importBtn, exportBtn],
    }),
  });

  const popover = createSettingsPopoverController({
    button,
    panel,
    onOpen: () => startPolling(),
    onClose: () => {
      stopPolling();
      holdingsTableModal.setOpen(false);
    },
    extraInsideTargets: [holdingsTableModal.backdrop],
  });

  return {
    root: wrap,
    cleanup: () => {
      stopPolling();
      unsubPhase();
      document.removeEventListener(
        "keydown",
        holdingsTableModal.onEscapeHandler,
      );
      popover.cleanup();
      holdingsTableModal.setOpen(false);
    },
  };
}
