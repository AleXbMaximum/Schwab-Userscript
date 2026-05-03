import { ui_createElement } from "./builders/createElement";
import { DS_COMPONENTS } from "./styles/theme";
import type { OrchestratorPhase } from "../../../shared/utils/time";
import type { SchedulerOverride } from "../../../shared/types/core";

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
  " border-bottom: 1px solid var(--ax-border-subtle);";

const PHASE_CELL_BASE_STYLE =
  "width: 30px; height: 22px; border: 1px solid var(--ios-border); cursor: pointer;" +
  " font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center;" +
  " transition: all 0.15s; padding: 0;";

const STATUS_DOT_STYLE =
  "width: 8px; height: 8px; border-radius: 50%; background: var(--ax-gray); flex-shrink: 0;" +
  " transition: background 0.3s;";

const ROW_LABEL_STYLE =
  "font-size: 11.5px; font-weight: var(--ax-fw-medium); color: var(--ios-text-primary);";

const ROW_CONTROL_CELL_STYLE =
  "display: flex; align-items: center; justify-content: flex-end; gap: 4px;";

const SECTION_HEADER_STYLE =
  "padding: 10px 12px; border-bottom: 1px solid var(--ax-border-subtle);";

const SECTION_BODY_STYLE = "padding: 8px 12px;";

/** Apply visual styling to a phase cell button based on override state and default. */
function applyPhaseCellStyle(
  btn: HTMLButtonElement,
  override: SchedulerOverride,
  defaultOn: boolean,
  isCurrentPhase: boolean,
): void {
  if (override === "forceOn") {
    btn.style.background = "rgba(32,169,69,0.18)";
    btn.style.borderColor = "rgba(32,169,69,0.45)";
    btn.style.color = "#20a945";
  } else if (override === "forceOff") {
    btn.style.background = "rgba(215,49,38,0.12)";
    btn.style.borderColor = "rgba(215,49,38,0.35)";
    btn.style.color = "#d73126";
  } else if (defaultOn) {
    btn.style.background = "rgba(32,169,69,0.08)";
    btn.style.borderColor = "rgba(32,169,69,0.20)";
    btn.style.color = "rgba(32,169,69,0.7)";
  } else {
    btn.style.background = "transparent";
    btn.style.borderColor = "var(--ios-border)";
    btn.style.color = "var(--ios-text-secondary)";
  }

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
      props: { type: "button", title: phase },
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

/** Create a phase badge showing current phase name. */
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
      bg: "var(--ax-tone-muted-soft-bg)",
      border: "var(--ax-tone-muted-border)",
      text: "var(--ax-fg-2)",
    },
    closed: {
      bg: "var(--ax-tone-muted-soft-bg)",
      border: "var(--ax-tone-muted-border)",
      text: "var(--ax-fg-2)",
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

/** Create a section card with a right-aligned badge in the header. */
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
