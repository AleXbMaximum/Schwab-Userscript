import { ui_createElement } from "./createElement";
import { DS_BUTTONS, DS_COMPONENTS } from "./theme";
import type { OrchestratorPhase } from "../../../shared/utils/time";
import type { SchedulerOverride } from "../../../shared/types/core";

const SETTINGS_GEAR_ICON_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="3"></circle>' +
  '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' +
  "</svg>";

const SETTINGS_BUTTON_STYLE =
  "width: 32px; height: 32px; border-radius: 10px; cursor: pointer;" +
  " border: 1px solid var(--ios-border); color: var(--ios-text-secondary);" +
  " background: rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center;" +
  " transition: all 0.15s;";

const SETTINGS_PANEL_STYLE =
  "position: absolute; top: 38px; right: 0; z-index: var(--z-page-popover, 210);" +
  " width: min(640px, calc(100vw - 28px)); max-height: min(86vh, 900px); overflow-y: auto;" +
  " padding: 14px; border: 1px solid var(--ios-border); border-radius: 14px;" +
  " background: rgba(248,248,250,0.97); box-shadow: var(--ios-shadow);" +
  " display: none; flex-direction: column; gap: 10px;";

const SECTION_HEADER_STYLE =
  "padding: 12px 16px; border-bottom: 1px solid rgba(60,60,67,0.10);" +
  " background: rgba(250,250,252,0.92);";

const SECTION_BODY_STYLE =
  DS_COMPONENTS.settingGroupBody + " padding: 4px 16px 8px;";

const MATRIX_ROW_STYLE =
  "display: grid; grid-template-columns: minmax(160px, 1fr) 96px 72px 132px;" +
  " align-items: center; column-gap: 4px; min-height: 44px; padding: 6px 0;" +
  " border-bottom: 1px solid rgba(60,60,67,0.10);";

const FORM_ROW_STYLE =
  "display: grid; grid-template-columns: minmax(160px, 1fr) 220px;" +
  " align-items: center; column-gap: 4px; min-height: 44px; padding: 6px 0;" +
  " border-bottom: 1px solid rgba(60,60,67,0.10);";

const ROW_LABEL_STYLE =
  "font-size: 13px; font-weight: 600; color: var(--ios-text-primary);";
const ROW_META_STYLE =
  "font-size: 12px; color: var(--ios-text-secondary); line-height: 1.2;";
const ROW_TOGGLE_CELL_STYLE = "justify-self: center;";
const ROW_PARAM_LABEL_STYLE =
  ROW_META_STYLE + " justify-self: end; padding-right: 2px;";
const ROW_CONTROL_CELL_STYLE =
  "justify-self: end; display:flex; justify-content:flex-end; align-items:center;";
const ROW_CONTROL_GROUP_STYLE =
  "display:inline-flex; align-items:center; justify-content:flex-end; gap:4px;";

const TOGGLE_BUTTON_STYLE =
  "width: 84px; height: 28px; border-radius: 8px; border: 1px solid var(--ios-border);" +
  " font-size: 12px; font-weight: 600; cursor: pointer; background: rgba(120,120,128,0.12);" +
  " color: var(--ios-text-secondary); transition: all 0.15s;";

const NUMBER_INPUT_STYLE =
  "width: 10ch; padding: 4px 6px; text-align: right; font-size: 12px; border: 1px solid var(--ios-border);" +
  " border-radius: 8px; background: rgba(255,255,255,0.95); color: var(--ios-text-primary); outline: none;";

const AUTO_VALUE_STYLE =
  "display:inline-flex; align-items:center; justify-content:center; height:24px; padding:0 10px;" +
  " border:1px solid var(--ios-border); border-radius:999px; background:rgba(120,120,128,0.10);" +
  " font-size:12px; color:var(--ios-text-secondary); font-weight:500; text-transform:capitalize;";

export interface SettingsPopoverScaffold {
  wrap: HTMLElement;
  button: HTMLButtonElement;
  panel: HTMLDivElement;
}

export function createSettingsPopoverScaffold(opts: {
  title: string;
  ariaLabel: string;
  panelWidthStyle?: string;
}): SettingsPopoverScaffold {
  const wrap = ui_createElement("div", {
    styleString: "position: relative; flex-shrink: 0;",
  });
  const button = ui_createElement("button", {
    props: {
      type: "button",
      title: opts.title,
      "aria-label": opts.ariaLabel,
      "aria-expanded": "false",
      innerHTML: SETTINGS_GEAR_ICON_SVG,
    },
    styleString: SETTINGS_BUTTON_STYLE,
  }) as HTMLButtonElement;
  const panel = ui_createElement("div", {
    styleString: opts.panelWidthStyle ?? SETTINGS_PANEL_STYLE,
  }) as HTMLDivElement;
  wrap.appendChild(button);
  wrap.appendChild(panel);
  return { wrap, button, panel };
}

function applyGearButtonState(button: HTMLButtonElement, open: boolean): void {
  button.setAttribute("aria-expanded", open ? "true" : "false");
  button.style.background = open
    ? "rgba(0,122,255,0.12)"
    : "rgba(255,255,255,0.75)";
  button.style.borderColor = open ? "rgba(0,122,255,0.4)" : "var(--ios-border)";
  button.style.color = open ? "var(--ios-blue)" : "var(--ios-text-secondary)";
}

export interface SettingsPopoverController {
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  cleanup: () => void;
}

export function createSettingsPopoverController(opts: {
  button: HTMLButtonElement;
  panel: HTMLElement;
  onOpen?: () => void;
  onClose?: () => void;
  extraInsideTargets?: HTMLElement[];
}): SettingsPopoverController {
  let open = false;
  const extraInsideTargets = opts.extraInsideTargets ?? [];

  const setOpen = (next: boolean): void => {
    if (open === next) return;
    open = next;
    opts.panel.style.display = open ? "flex" : "none";
    applyGearButtonState(opts.button, open);
    if (open) opts.onOpen?.();
    else opts.onClose?.();
  };

  const onButtonClick = (e: MouseEvent): void => {
    e.stopPropagation();
    setOpen(!open);
  };

  const onOutsideClick = (e: MouseEvent): void => {
    if (!open) return;
    const target = e.target as Node | null;
    if (!target) return;
    if (opts.button.contains(target) || opts.panel.contains(target)) return;
    if (extraInsideTargets.some((el) => el.contains(target))) return;
    setOpen(false);
  };

  const onEscape = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && open) setOpen(false);
  };

  opts.button.addEventListener("click", onButtonClick);
  document.addEventListener("mousedown", onOutsideClick);
  document.addEventListener("keydown", onEscape);

  return {
    isOpen: () => open,
    setOpen,
    cleanup: () => {
      opts.button.removeEventListener("click", onButtonClick);
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("keydown", onEscape);
      setOpen(false);
    },
  };
}

export function createSettingsPanelTitle(text: string): HTMLElement {
  return ui_createElement("span", {
    text,
    styleString:
      "font-size: 18px; font-weight: 600; color: var(--ios-text-primary);",
  });
}

export function createSettingsPanelHint(text: string): HTMLElement {
  return ui_createElement("span", {
    text,
    styleString:
      "font-size: 12px; color: var(--ios-text-secondary); margin-top: -2px;",
  });
}

export function createSettingsSectionCard(title: string): {
  section: HTMLElement;
  body: HTMLElement;
} {
  const section = ui_createElement("section", {
    styleString: DS_COMPONENTS.settingGroupCard + " margin:0;",
  });
  section.appendChild(
    ui_createElement("div", {
      styleString: SECTION_HEADER_STYLE,
      children: [
        ui_createElement("span", {
          text: title,
          styleString: DS_COMPONENTS.settingGroupTitle,
        }),
      ],
    }),
  );
  const body = ui_createElement("div", { styleString: SECTION_BODY_STYLE });
  section.appendChild(body);
  return { section, body };
}

export type SettingsToggleButtonController = {
  element: HTMLButtonElement;
  isOn: () => boolean;
  setOn: (next: boolean, opts?: { silent?: boolean }) => void;
};

export function createSettingsToggleButton(
  initial: boolean,
  onChange: (next: boolean) => void,
): SettingsToggleButtonController {
  const button = ui_createElement("button", {
    props: { type: "button" },
    styleString: TOGGLE_BUTTON_STYLE,
  }) as HTMLButtonElement;
  let current = initial;
  const applyState = (): void => {
    button.textContent = current ? "On" : "Off";
    button.style.background = current
      ? "rgba(0,122,255,0.14)"
      : "rgba(120,120,128,0.12)";
    button.style.borderColor = current
      ? "rgba(0,122,255,0.35)"
      : "var(--ios-border)";
    button.style.color = current
      ? "var(--ios-blue)"
      : "var(--ios-text-secondary)";
  };
  const setOn = (next: boolean, opts?: { silent?: boolean }): void => {
    current = next;
    applyState();
    if (!opts?.silent) onChange(next);
  };
  button.addEventListener("click", () => setOn(!current));
  applyState();
  return { element: button, isOn: () => current, setOn };
}

export type SettingsNumericInputController = {
  element: HTMLInputElement;
  setDisabled: (disabled: boolean) => void;
  setValue: (next: number) => void;
  getResolved: () => number;
};

export function createSettingsNumericInput(opts: {
  getResolved: () => number;
  min: number;
  step: number;
  allowZero?: boolean;
  onCommit: (next: number) => void;
}): SettingsNumericInputController {
  const input = ui_createElement("input", {
    props: {
      type: "number",
      min: opts.min,
      step: opts.step,
      value: opts.getResolved(),
    },
    styleString: NUMBER_INPUT_STYLE,
  }) as HTMLInputElement;
  const setValue = (next: number): void => {
    input.value = String(Math.round(next));
  };
  input.addEventListener("change", () => {
    const next = Number.parseInt(input.value, 10);
    if (
      !Number.isFinite(next) ||
      next < opts.min ||
      (!opts.allowZero && next <= 0)
    ) {
      setValue(opts.getResolved());
      return;
    }
    opts.onCommit(next);
  });
  return {
    element: input,
    setDisabled: (disabled: boolean) => {
      input.disabled = disabled;
      input.style.opacity = disabled ? "0.55" : "1";
    },
    setValue,
    getResolved: opts.getResolved,
  };
}

export function createSettingsControlWithUnit(
  inputEl: HTMLElement,
  unitText: string,
): HTMLElement {
  return ui_createElement("div", {
    styleString: ROW_CONTROL_GROUP_STYLE,
    children: [
      inputEl,
      ui_createElement("span", { text: unitText, styleString: ROW_META_STYLE }),
    ],
  });
}

export function createSettingsAutoValue(text: string = "auto"): HTMLElement {
  return ui_createElement("span", { text, styleString: AUTO_VALUE_STYLE });
}

export function appendSettingsMatrixRow(opts: {
  body: HTMLElement;
  label: string;
  toggleEl: HTMLElement;
  paramLabel: string;
  controlEl: HTMLElement;
}): HTMLElement {
  const row = ui_createElement("div", {
    styleString: MATRIX_ROW_STYLE,
    children: [
      ui_createElement("span", {
        text: opts.label,
        styleString: ROW_LABEL_STYLE,
      }),
      ui_createElement("div", {
        styleString: ROW_TOGGLE_CELL_STYLE,
        children: [opts.toggleEl],
      }),
      ui_createElement("span", {
        text: opts.paramLabel,
        styleString: ROW_PARAM_LABEL_STYLE,
      }),
      ui_createElement("div", {
        styleString: ROW_CONTROL_CELL_STYLE,
        children: [opts.controlEl],
      }),
    ],
  });
  opts.body.appendChild(row);
  return row;
}

export function appendSettingsFormRow(opts: {
  body: HTMLElement;
  label: string;
  controlEl: HTMLElement;
}): HTMLElement {
  const row = ui_createElement("div", {
    styleString: FORM_ROW_STYLE,
    children: [
      ui_createElement("span", {
        text: opts.label,
        styleString: ROW_LABEL_STYLE,
      }),
      ui_createElement("div", {
        styleString: ROW_CONTROL_CELL_STYLE,
        children: [opts.controlEl],
      }),
    ],
  });
  opts.body.appendChild(row);
  return row;
}

export interface SettingsJsonEditorModal {
  backdrop: HTMLDivElement;
  setOpen: (open: boolean) => void;
  isOpen: () => boolean;
  refreshValue: () => void;
  onEscapeHandler: (e: KeyboardEvent) => void;
}

export function createSettingsJsonEditorModal(opts: {
  title: string;
  description?: string;
  getValue: () => string;
  onApply: (raw: string) => void;
  validate?: (raw: string) => string | null;
}): SettingsJsonEditorModal {
  const backdrop = ui_createElement("div", {
    styleString:
      "position: fixed; inset: 0; z-index: var(--z-page-popover, 260);" +
      " background: rgba(0,0,0,0.26); display: none; align-items: center; justify-content: center;" +
      " padding: 24px;",
  }) as HTMLDivElement;

  const modal = ui_createElement("div", {
    styleString:
      "width: min(900px, calc(100vw - 48px)); height: min(70vh, 720px); min-height: 420px;" +
      " border: 1px solid var(--ios-border); border-radius: 14px; overflow: hidden;" +
      " background: rgba(255,255,255,0.99); box-shadow: var(--ios-shadow);" +
      " display: flex; flex-direction: column;",
  }) as HTMLDivElement;
  backdrop.appendChild(modal);

  const textarea = ui_createElement("textarea", {
    props: { rows: 14 },
    styleString:
      DS_COMPONENTS.settingTextarea +
      " height: 100%; min-height: 0; resize: none; background: rgba(255,255,255,0.96);",
  }) as HTMLTextAreaElement;

  const refreshValue = (): void => {
    textarea.value = opts.getValue();
  };
  refreshValue();

  const closeBtn = ui_createElement("button", {
    text: "✕",
    props: { type: "button", "aria-label": `Close ${opts.title}` },
    styleString:
      "width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--ios-border);" +
      " background: rgba(120,120,128,0.12); color: var(--ios-text-secondary); cursor: pointer;" +
      " font-size: 15px; line-height: 1; display: inline-flex; align-items: center; justify-content: center;",
  }) as HTMLButtonElement;

  const formatBtn = createSettingsActionButton("Format");
  formatBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(textarea.value || "{}");
      textarea.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
      window.alert(`Invalid JSON: ${(e as any)?.message ?? String(e)}`);
    }
  });

  const applyBtn = createSettingsActionButton("Apply", { variant: "primary" });
  applyBtn.addEventListener("click", () => {
    const raw = textarea.value;
    if (opts.validate) {
      const err = opts.validate(raw);
      if (err) {
        window.alert(err);
        return;
      }
    }
    opts.onApply(raw);
  });

  modal.appendChild(
    ui_createElement("div", {
      styleString:
        "display:flex; align-items:center; justify-content:space-between; gap:8px;" +
        " padding: 12px 14px; border-bottom: 1px solid rgba(60,60,67,0.12); background: rgba(250,250,252,0.96);",
      children: [
        ui_createElement("span", {
          text: opts.title,
          styleString:
            "font-size: 15px; font-weight: 600; color: var(--ios-text-primary);",
        }),
        closeBtn,
      ],
    }),
  );

  const bodyChildren: HTMLElement[] = [];
  if (opts.description) {
    bodyChildren.push(
      ui_createElement("div", {
        text: opts.description,
        styleString:
          "font-size: 12px; color: var(--ios-text-secondary); line-height: 1.4; margin-bottom: 8px;",
      }),
    );
  }
  bodyChildren.push(textarea);
  modal.appendChild(
    ui_createElement("div", {
      styleString:
        "flex: 1 1 auto; min-height: 0; padding: 12px 14px; display: flex; flex-direction: column;",
      children: bodyChildren,
    }),
  );

  modal.appendChild(
    ui_createElement("div", {
      styleString:
        "display:flex; align-items:center; justify-content:space-between; gap:8px;" +
        " padding: 10px 14px; border-top: 1px solid rgba(60,60,67,0.12); background: rgba(250,250,252,0.96);",
      children: [
        formatBtn,
        ui_createElement("div", {
          styleString: "display:flex; justify-content:flex-end; gap:8px;",
          children: [applyBtn],
        }),
      ],
    }),
  );

  let isModalOpen = false;
  let previousBodyOverflow = "";
  const setOpen = (open: boolean): void => {
    if (isModalOpen === open) return;
    isModalOpen = open;
    backdrop.style.display = open ? "flex" : "none";
    if (open) {
      refreshValue();
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return;
    }
    document.body.style.overflow = previousBodyOverflow;
  };

  closeBtn.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) setOpen(false);
  });

  const onEscapeHandler = (e: KeyboardEvent): void => {
    if (e.key !== "Escape" || !isModalOpen) return;
    e.stopImmediatePropagation();
    setOpen(false);
  };

  return {
    backdrop,
    setOpen,
    isOpen: () => isModalOpen,
    refreshValue,
    onEscapeHandler,
  };
}

// ── Shared settings helpers ──────────────────────────────────────────────────

/**
 * Parse and validate a positive numeric interval value.
 * Returns `fallback` when the value is not a finite positive number.
 */
export function resolveInterval(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

/**
 * Like `resolveInterval` but also accepts zero (useful for "disabled" intervals).
 */
export function resolveNonNegativeInterval(
  value: unknown,
  fallback: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed);
}

export interface SettingsNumberControlOpts {
  settings: Record<string, unknown>;
  ctx: { onUpdateSettings: (patch: any) => void };
  key: string;
  fallback: number;
  min: number;
  step: number;
  unit: string;
}

/**
 * Create a numeric input control wired to a settings key with unit label.
 * Combines `createSettingsNumericInput` + `createSettingsControlWithUnit` +
 * the resolve/commit pattern shared by portfolio and holdings panels.
 */
export function createSettingsNumberControl(
  opts: SettingsNumberControlOpts,
): HTMLElement {
  const input = createSettingsNumericInput({
    getResolved: () => resolveInterval(opts.settings[opts.key], opts.fallback),
    min: opts.min,
    step: opts.step,
    onCommit: (next) => {
      opts.ctx.onUpdateSettings({ [opts.key]: next });
      opts.settings[opts.key] = next;
    },
  });
  return createSettingsControlWithUnit(input.element, opts.unit);
}

export function createSettingsActionButton(
  text: string,
  opts?: { variant?: "primary" | "secondary" | "danger"; width?: number },
): HTMLButtonElement {
  const variant = opts?.variant ?? "secondary";
  const width = opts?.width ?? 84;
  const base =
    variant === "primary"
      ? DS_BUTTONS.primary
      : variant === "danger"
        ? DS_BUTTONS.danger
        : DS_BUTTONS.secondary;
  return ui_createElement("button", {
    text,
    props: { type: "button" },
    styleString:
      base +
      ` justify-content:center; width:${width}px; height:28px; padding:0 8px; font-size:12px; border-radius:9px;`,
  }) as HTMLButtonElement;
}

// ── Phase matrix UI ──────────────────────────────────────────────────────────

const PHASE_LABELS: { phase: OrchestratorPhase; label: string }[] = [
  { phase: "market", label: "M" },
  { phase: "afterHours", label: "AH" },
  { phase: "preMarket", label: "PM" },
  { phase: "overnight", label: "ON" },
  { phase: "closed", label: "CL" },
];

const PHASE_MATRIX_ROW_STYLE =
  "display: grid; grid-template-columns: minmax(130px, 1fr) auto 132px;" +
  " align-items: center; column-gap: 8px; min-height: 44px; padding: 6px 0;" +
  " border-bottom: 1px solid rgba(60,60,67,0.10);";

const PHASE_CELL_BASE_STYLE =
  "width: 30px; height: 22px; border: 1px solid var(--ios-border); cursor: pointer;" +
  " font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center;" +
  " transition: all 0.15s; padding: 0;";

const STATUS_DOT_STYLE =
  "width: 8px; height: 8px; border-radius: 50%; background: #ccc; flex-shrink: 0;" +
  " transition: background 0.3s;";

/** Apply visual styling to a phase cell button based on override state and default. */
function applyPhaseCellStyle(
  btn: HTMLButtonElement,
  override: SchedulerOverride,
  defaultOn: boolean,
  isCurrentPhase: boolean,
): void {
  // Determine visual state
  if (override === "forceOn") {
    // Force on = solid green
    btn.style.background = "rgba(32,169,69,0.18)";
    btn.style.borderColor = "rgba(32,169,69,0.45)";
    btn.style.color = "#20a945";
  } else if (override === "forceOff") {
    // Force off = solid red
    btn.style.background = "rgba(215,49,38,0.12)";
    btn.style.borderColor = "rgba(215,49,38,0.35)";
    btn.style.color = "#d73126";
  } else if (defaultOn) {
    // Auto + default on = light green
    btn.style.background = "rgba(32,169,69,0.08)";
    btn.style.borderColor = "rgba(32,169,69,0.20)";
    btn.style.color = "rgba(32,169,69,0.7)";
  } else {
    // Auto + default off = dim
    btn.style.background = "transparent";
    btn.style.borderColor = "var(--ios-border)";
    btn.style.color = "var(--ios-text-secondary)";
  }

  // Current phase indicator: bottom accent
  btn.style.borderBottomWidth = isCurrentPhase ? "2px" : "1px";
  if (isCurrentPhase) {
    btn.style.borderBottomColor = "var(--ios-blue)";
  }
}

export type PhaseCellController = {
  btn: HTMLButtonElement;
  phase: OrchestratorPhase;
  update: (
    override: SchedulerOverride,
    defaultOn: boolean,
    isCurrentPhase: boolean,
  ) => void;
};

export type PhaseStripController = {
  strip: HTMLElement;
  cells: PhaseCellController[];
  updateAll: (
    currentPhase: OrchestratorPhase,
    getOverride: (phase: OrchestratorPhase) => SchedulerOverride,
    getDefault: (phase: OrchestratorPhase) => boolean,
  ) => void;
};

/**
 * Create a strip of 5 phase cells (M | AH | PM | ON | CL) for one scheduler source.
 * Each cell cycles auto -> forceOn -> forceOff -> auto on click.
 */
export function createPhaseStrip(opts: {
  onOverrideChange: (phase: OrchestratorPhase, next: SchedulerOverride) => void;
  getOverride: (phase: OrchestratorPhase) => SchedulerOverride;
  getDefault: (phase: OrchestratorPhase) => boolean;
  currentPhase: OrchestratorPhase;
}): PhaseStripController {
  const strip = ui_createElement("div", {
    styleString:
      "display: inline-flex; gap: 0; border-radius: 6px; overflow: hidden;",
  });

  const cells: PhaseCellController[] = PHASE_LABELS.map(({ phase, label }) => {
    const isFirst = phase === "market";
    const isLast = phase === "closed";
    const btn = ui_createElement("button", {
      text: label,
      props: {
        type: "button",
        title: phase,
      },
      styleString:
        PHASE_CELL_BASE_STYLE +
        (isFirst
          ? " border-radius: 4px 0 0 4px;"
          : isLast
            ? " border-radius: 0 4px 4px 0; border-left: none;"
            : " border-radius: 0; border-left: none;"),
    }) as HTMLButtonElement;

    const update = (
      override: SchedulerOverride,
      defaultOn: boolean,
      isCurrentPhase: boolean,
    ): void => {
      applyPhaseCellStyle(btn, override, defaultOn, isCurrentPhase);
      const stateText =
        override === "auto"
          ? defaultOn
            ? "auto (on)"
            : "auto (off)"
          : override === "forceOn"
            ? "forced on"
            : "forced off";
      btn.title = `${phase}: ${stateText}`;
    };

    // Cycle: auto -> forceOn -> forceOff -> auto
    btn.addEventListener("click", () => {
      const current = opts.getOverride(phase);
      const next: SchedulerOverride =
        current === "auto"
          ? "forceOn"
          : current === "forceOn"
            ? "forceOff"
            : "auto";
      opts.onOverrideChange(phase, next);
    });

    // Initial render
    update(
      opts.getOverride(phase),
      opts.getDefault(phase),
      phase === opts.currentPhase,
    );

    strip.appendChild(btn);
    return { btn, phase, update };
  });

  const updateAll = (
    currentPhase: OrchestratorPhase,
    getOverride: (phase: OrchestratorPhase) => SchedulerOverride,
    getDefault: (phase: OrchestratorPhase) => boolean,
  ): void => {
    for (const cell of cells) {
      cell.update(
        getOverride(cell.phase),
        getDefault(cell.phase),
        cell.phase === currentPhase,
      );
    }
  };

  return { strip, cells, updateAll };
}

export function createStatusDot(): HTMLElement {
  return ui_createElement("div", { styleString: STATUS_DOT_STYLE });
}

export function updateStatusDot(
  dot: HTMLElement,
  status: { isFetching: boolean; error: unknown | null; isPaused: boolean },
): void {
  if (status.error) {
    dot.style.background = "#cc0000";
  } else if (status.isFetching) {
    dot.style.background = "#ffcc00";
  } else if (status.isPaused) {
    dot.style.background = "var(--ios-gray)";
  } else {
    dot.style.background = "#00aa00";
  }
}

/**
 * Append a phase-matrix row: [dot + label] [phase strip] [control]
 */
export function appendPhaseMatrixRow(opts: {
  body: HTMLElement;
  label: string;
  dot: HTMLElement;
  phaseStrip: HTMLElement;
  controlEl: HTMLElement;
}): HTMLElement {
  const labelCell = ui_createElement("div", {
    styleString: "display: flex; align-items: center; gap: 6px;",
    children: [
      opts.dot,
      ui_createElement("span", {
        text: opts.label,
        styleString: ROW_LABEL_STYLE,
      }),
    ],
  });

  const row = ui_createElement("div", {
    styleString: PHASE_MATRIX_ROW_STYLE,
    children: [
      labelCell,
      opts.phaseStrip,
      ui_createElement("div", {
        styleString: ROW_CONTROL_CELL_STYLE,
        children: [opts.controlEl],
      }),
    ],
  });
  opts.body.appendChild(row);
  return row;
}

/**
 * Create a phase badge showing current phase name.
 */
export function createPhaseBadge(phase: OrchestratorPhase): {
  element: HTMLElement;
  update: (phase: OrchestratorPhase) => void;
} {
  const PHASE_DISPLAY: Record<OrchestratorPhase, string> = {
    market: "Market",
    afterHours: "After Hours",
    preMarket: "Pre-Market",
    overnight: "Overnight",
    closed: "Closed",
  };
  const PHASE_COLORS: Record<
    OrchestratorPhase,
    { bg: string; border: string; text: string }
  > = {
    market: {
      bg: "rgba(32,169,69,0.10)",
      border: "rgba(32,169,69,0.30)",
      text: "#20a945",
    },
    afterHours: {
      bg: "rgba(0,122,255,0.08)",
      border: "rgba(0,122,255,0.25)",
      text: "var(--ios-blue)",
    },
    preMarket: {
      bg: "rgba(0,122,255,0.08)",
      border: "rgba(0,122,255,0.25)",
      text: "var(--ios-blue)",
    },
    overnight: {
      bg: "rgba(120,120,128,0.08)",
      border: "rgba(120,120,128,0.20)",
      text: "var(--ios-text-secondary)",
    },
    closed: {
      bg: "rgba(120,120,128,0.06)",
      border: "rgba(120,120,128,0.15)",
      text: "var(--ios-text-secondary)",
    },
  };

  const element = ui_createElement("span", {
    text: PHASE_DISPLAY[phase],
    styleString:
      "display: inline-flex; align-items: center; height: 20px; padding: 0 8px;" +
      " border-radius: 999px; font-size: 10px; font-weight: 600;" +
      " transition: all 0.2s;",
  });

  const update = (p: OrchestratorPhase): void => {
    const c = PHASE_COLORS[p];
    element.textContent = PHASE_DISPLAY[p];
    element.style.background = c.bg;
    element.style.border = `1px solid ${c.border}`;
    element.style.color = c.text;
  };

  update(phase);
  return { element, update };
}

/**
 * Create a section card with a right-aligned badge in the header.
 */
export function createSettingsSectionCardWithBadge(
  title: string,
  badge: HTMLElement,
): { section: HTMLElement; body: HTMLElement } {
  const section = ui_createElement("section", {
    styleString: DS_COMPONENTS.settingGroupCard + " margin:0;",
  });
  section.appendChild(
    ui_createElement("div", {
      styleString:
        SECTION_HEADER_STYLE +
        " display: flex; align-items: center; justify-content: space-between;",
      children: [
        ui_createElement("span", {
          text: title,
          styleString: DS_COMPONENTS.settingGroupTitle,
        }),
        badge,
      ],
    }),
  );
  const body = ui_createElement("div", { styleString: SECTION_BODY_STYLE });
  section.appendChild(body);
  return { section, body };
}
