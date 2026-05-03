import { ui_createElement } from "./builders/createElement";
import { DS_BUTTONS, DS_COMPONENTS } from "./styles/theme";

const SETTINGS_GEAR_ICON_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="3"></circle>' +
  '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' +
  "</svg>";

const SETTINGS_BUTTON_STYLE =
  "width: 32px; height: 32px; border-radius: var(--ax-radius-lg); cursor: pointer;" +
  " border: 1px solid var(--ax-border); color: var(--ax-fg-2);" +
  " background: var(--ax-bg-input); display: flex; align-items: center; justify-content: center;" +
  " transition: all 0.15s;";

const SETTINGS_PANEL_STYLE =
  "position: absolute; top: 38px; right: 0; z-index: var(--z-page-popover, 210);" +
  " width: min(640px, calc(100vw - 28px)); max-height: min(86vh, 900px); overflow-y: auto;" +
  " padding: 14px; border: 1px solid var(--ax-border); border-radius: 14px;" +
  " background: var(--ax-bg-card); box-shadow: var(--ax-shadow-lg);" +
  " display: none; flex-direction: column; gap: 10px;";

const SECTION_HEADER_STYLE =
  "padding: 12px 16px; border-bottom: 1px solid var(--ax-border-subtle);" +
  " background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent);";

const SECTION_BODY_STYLE =
  DS_COMPONENTS.settingGroupBody + " padding: 4px 16px 8px;";

const MATRIX_ROW_STYLE =
  "display: grid; grid-template-columns: minmax(160px, 1fr) 96px 72px 132px;" +
  " align-items: center; column-gap: 4px; min-height: 44px; padding: 6px 0;" +
  " border-bottom: 1px solid var(--ax-border-subtle);";

const FORM_ROW_STYLE =
  "display: grid; grid-template-columns: minmax(160px, 1fr) 220px;" +
  " align-items: center; column-gap: 4px; min-height: 44px; padding: 6px 0;" +
  " border-bottom: 1px solid var(--ax-border-subtle);";

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
  "width: 84px; height: 28px; border-radius: 8px; border: 1px solid var(--ax-border);" +
  " font-size: 12px; font-weight: 600; cursor: pointer; background: var(--ax-bg-chip);" +
  " color: var(--ax-fg-2); transition: all 0.15s;";

const NUMBER_INPUT_STYLE =
  "width: 10ch; padding: 4px 6px; text-align: right; font-size: var(--ax-fs-md); border: 1px solid var(--ax-border);" +
  " border-radius: var(--ax-radius-md); background: var(--ax-bg-input); color: var(--ax-fg); outline: none;";

const AUTO_VALUE_STYLE =
  "display:inline-flex; align-items:center; justify-content:center; height:24px; padding:0 10px;" +
  " border:1px solid var(--ax-border); border-radius:999px; background:var(--ax-bg-chip);" +
  " font-size:12px; color:var(--ax-fg-2); font-weight:500; text-transform:capitalize;";

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
    : "var(--ax-bg-input)";
  button.style.borderColor = open ? "rgba(0,122,255,0.4)" : "var(--ax-border)";
  button.style.color = open ? "var(--ax-blue)" : "var(--ax-fg-2)";
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
      : "var(--ax-bg-chip)";
    button.style.borderColor = current
      ? "rgba(0,122,255,0.35)"
      : "var(--ax-border)";
    button.style.color = current
      ? "var(--ax-blue)"
      : "var(--ax-fg-2)";
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

export type { SettingsJsonEditorModal } from "./settingsJsonEditorModal";
export { createSettingsJsonEditorModal } from "./settingsJsonEditorModal";

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


// ── Phase matrix UI moved to ./settingsPhaseMatrix.ts ─────────
export {
  createPhaseStrip,
  createStatusDot,
  updateStatusDot,
  appendPhaseMatrixRow,
  createPhaseBadge,
  createSettingsSectionCardWithBadge,
  type PhaseCellController,
  type PhaseStripController,
} from "./settingsPhaseMatrix";

