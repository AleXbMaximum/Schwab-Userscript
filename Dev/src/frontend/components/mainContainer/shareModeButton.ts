import { ui_createElement } from "../core/builders/createElement";
import {
  getShareMode,
  setShareMode,
  onShareModeChange,
  getCustomMultiplier,
  setCustomMultiplier,
  SHARE_MODE_CYCLE,
  SHARE_MODE_LABELS,
  type GlobalShareMode,
} from "shared/utils/domain/globalShareMode";
import {
  getCurrentMode,
  setTheme,
  onThemeChanged,
  type AxThemeMode,
} from "../core/axTheme/controller";
import {
  getRenderMode,
  setRenderMode,
  onRenderModeChanged,
  type AxRenderMode,
} from "../core/axTheme/renderMode/controller";

const GEAR_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>';

export function buildShareModeButton(): HTMLElement {
  const wrapper = ui_createElement("div", {
    className: "dock-settings-wrapper dock-share-btn",
  });

  const btn = ui_createElement("button", {
    className: "dock-settings-btn",
    props: { "aria-label": "Settings", innerHTML: GEAR_SVG },
  });

  wrapper.appendChild(btn);

  // ── Dropdown panel ──────────────────────────────────────────────────────
  const panel = ui_createElement("div", {
    className: "dock-settings-panel",
  });

  // Share Mode row
  const shareRow = ui_createElement("div", {
    className: "dock-settings-row",
  });
  const shareLabel = ui_createElement("span", {
    text: "Share Mode",
    className: "dock-settings-label",
  });
  shareRow.appendChild(shareLabel);

  const optionsContainer = ui_createElement("div", {
    className: "dock-settings-options",
  });
  const optionEls: HTMLElement[] = [];

  // Plain light-DOM <input> so Schwab's global keyboard handlers see
  // e.target.tagName === "INPUT" and skip interception (standard pattern
  // on trading platforms). Shadow DOM would retarget the event to a <span>,
  // causing the host page to treat keystrokes as hotkeys instead.
  const customInput = ui_createElement("input", {
    className: "dock-settings-custom-input",
    props: {
      type: "number",
      min: "1",
      step: "1",
      value: String(getCustomMultiplier()),
      placeholder: "x",
    },
  }) as HTMLInputElement;
  customInput.style.cssText =
    "width:42px;padding:1px 3px;font-size: var(--ax-fs-sm);text-align:center;" +
    "border:1px solid var(--ax-border);border-radius: var(--ax-radius-xs);" +
    "background: var(--ax-bg-input);color: var(--ax-fg);box-sizing:border-box;" +
    "display:none;-moz-appearance:textfield;";

  customInput.addEventListener("click", (e) => e.stopPropagation());
  customInput.addEventListener("keydown", (e) => e.stopPropagation());

  customInput.addEventListener("change", () => {
    const v = Number(customInput.value);
    if (Number.isFinite(v) && v > 0) {
      setCustomMultiplier(v);
    } else {
      customInput.value = String(getCustomMultiplier());
    }
  });

  for (const mode of SHARE_MODE_CYCLE) {
    const optBtn = ui_createElement("button", {
      className: "dock-settings-opt",
      text: SHARE_MODE_LABELS[mode],
      events: {
        click: (e) => {
          (e as Event).stopPropagation();
          setShareMode(mode);
        },
      },
    });
    optionEls.push(optBtn);
    optionsContainer.appendChild(optBtn);
  }
  optionsContainer.appendChild(customInput);

  shareRow.appendChild(optionsContainer);
  panel.appendChild(shareRow);

  // ── Theme Mode row ──────────────────────────────────────────────────────
  const themeRow = ui_createElement("div", {
    className: "dock-settings-row",
  });
  const themeLabel = ui_createElement("span", {
    text: "Theme",
    className: "dock-settings-label",
  });
  themeRow.appendChild(themeLabel);

  const themeOptionsContainer = ui_createElement("div", {
    className: "dock-settings-options",
  });
  const THEME_MODES: { mode: AxThemeMode; label: string }[] = [
    { mode: "light", label: "Light" },
    { mode: "dark", label: "Dark" },
  ];
  const themeOptionEls: { mode: AxThemeMode; el: HTMLElement }[] = [];
  for (const { mode, label } of THEME_MODES) {
    const optBtn = ui_createElement("button", {
      className: "dock-settings-opt",
      text: label,
      events: {
        click: (e) => {
          (e as Event).stopPropagation();
          setTheme(mode);
        },
      },
    });
    themeOptionEls.push({ mode, el: optBtn });
    themeOptionsContainer.appendChild(optBtn);
  }
  themeRow.appendChild(themeOptionsContainer);
  panel.appendChild(themeRow);

  function syncThemeOptions(activeMode: AxThemeMode) {
    for (const { mode, el } of themeOptionEls) {
      el.classList.toggle("active", mode === activeMode);
    }
  }
  syncThemeOptions(getCurrentMode());
  onThemeChanged(() => syncThemeOptions(getCurrentMode()));

  // ── Render Mode row ─────────────────────────────────────────────────────
  // Mirrors the Theme row above. Full keeps every glass effect, blur,
  // glow, and motion; Eco strips the expensive composites for low-power
  // devices or busy chart-heavy sessions.
  const renderRow = ui_createElement("div", {
    className: "dock-settings-row",
  });
  const renderLabel = ui_createElement("span", {
    text: "Render",
    className: "dock-settings-label",
  });
  renderRow.appendChild(renderLabel);

  const renderOptionsContainer = ui_createElement("div", {
    className: "dock-settings-options",
  });
  const RENDER_MODES: { mode: AxRenderMode; label: string }[] = [
    { mode: "full", label: "Full" },
    { mode: "eco", label: "Eco" },
  ];
  const renderOptionEls: { mode: AxRenderMode; el: HTMLElement }[] = [];
  for (const { mode, label } of RENDER_MODES) {
    const optBtn = ui_createElement("button", {
      className: "dock-settings-opt",
      text: label,
      events: {
        click: (e) => {
          (e as Event).stopPropagation();
          setRenderMode(mode);
        },
      },
    });
    renderOptionEls.push({ mode, el: optBtn });
    renderOptionsContainer.appendChild(optBtn);
  }
  renderRow.appendChild(renderOptionsContainer);
  panel.appendChild(renderRow);

  function syncRenderOptions(activeMode: AxRenderMode) {
    for (const { mode, el } of renderOptionEls) {
      el.classList.toggle("active", mode === activeMode);
    }
  }
  syncRenderOptions(getRenderMode());
  onRenderModeChanged(() => syncRenderOptions(getRenderMode()));

  wrapper.appendChild(panel);

  function syncOptions(mode: GlobalShareMode) {
    for (let i = 0; i < SHARE_MODE_CYCLE.length; i++) {
      optionEls[i].classList.toggle("active", SHARE_MODE_CYCLE[i] === mode);
    }
    customInput.style.display = mode === "custom" ? "inline-block" : "none";
    if (mode === "custom" && document.activeElement !== customInput) {
      customInput.value = String(getCustomMultiplier());
    }
  }

  syncOptions(getShareMode());
  onShareModeChange(syncOptions);

  let isOpen = false;
  function togglePanel() {
    isOpen = !isOpen;
    wrapper.classList.toggle("open", isOpen);
  }
  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    wrapper.classList.remove("open");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePanel();
  });

  document.addEventListener("click", closePanel);

  panel.addEventListener("click", (e) => e.stopPropagation());

  return wrapper;
}
