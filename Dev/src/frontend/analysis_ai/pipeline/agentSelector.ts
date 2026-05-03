import { ui_createElement } from "../../components/core/builders/createElement";
import type { AnalystKey } from "./pipelineConfigPanel";

// ── Constants ────────────────────────────────────────────────────────────────

export const ANALYST_LABELS: { key: AnalystKey; label: string }[] = [
  { key: "market", label: "Market" },
  { key: "technicals", label: "Technicals" },
  { key: "fundamentals", label: "Fundamentals" },
  { key: "financial_quality", label: "Financial Quality" },
  { key: "sentiment_company", label: "Sentiment (Co.)" },
  { key: "sentiment_macro", label: "Sentiment (Macro)" },
  { key: "sellside", label: "Sell-Side" },
  { key: "ownership", label: "Ownership" },
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentSelectorResult {
  headerEl: HTMLElement;
  gridEl: HTMLElement;
  behaviorRow: HTMLElement;
  getEnabledAnalysts(): string[];
  isMemoryEnabled(): boolean;
  isToolsEnabled(): boolean;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createAgentSelector(opts: {
  savedAnalysts: AnalystKey[];
  memoryEnabled: boolean;
  toolsEnabled: boolean;
  onAnalystChange: () => void;
  onMemoryChange: (v: boolean) => void;
  onToolsChange: (v: boolean) => void;
}): AgentSelectorResult {
  const {
    savedAnalysts,
    memoryEnabled,
    toolsEnabled,
    onAnalystChange,
    onMemoryChange,
    onToolsChange,
  } = opts;

  const pipelineAnalystState: Record<AnalystKey, boolean> = {} as Record<
    AnalystKey,
    boolean
  >;
  for (const a of ANALYST_LABELS)
    pipelineAnalystState[a.key] = savedAnalysts.includes(a.key);

  let pipelineMemoryEnabled = memoryEnabled;
  let pipelineToolsEnabled = toolsEnabled;

  // ── Header with date input ────────────────────────────────────────────
  const headerEl = ui_createElement("div", {
    styleString: "display: flex; align-items: center; gap: 8px;",
  });
  headerEl.appendChild(
    ui_createElement("span", {
      text: "Agents",
      styleString:
        "font-size: 12px; font-weight: 700; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;",
    }),
  );
  headerEl.appendChild(
    ui_createElement("span", { styleString: "flex: 1;" }),
  );

  const today = new Date().toISOString().split("T")[0];
  const dateInput = ui_createElement("input", {
    props: { type: "date", value: today, max: today },
    styleString:
      "padding: 2px 5px; font-size: var(--ax-fs-sm); border: 1px solid var(--ax-border);" +
      " border-radius: 6px; outline: none; font-family: var(--ax-font-body);" +
      " background: var(--ax-bg-input); color: var(--ax-fg-2);",
  }) as HTMLInputElement;
  headerEl.appendChild(dateInput);

  // ── Agent checkbox grid ───────────────────────────────────────────────
  const gridEl = ui_createElement("div", {
    styleString:
      "display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 4px;",
  });
  for (const a of ANALYST_LABELS) {
    const lbl = ui_createElement("label", {
      styleString:
        "display: flex; align-items: center; gap: 4px; font-size: 12.5px;" +
        " color: var(--ios-text-primary); cursor: pointer; padding: 2px 3px; border-radius: 6px;",
    });
    const cb = ui_createElement("input", {
      props: { type: "checkbox" },
      styleString: "width: 14px; height: 14px; cursor: pointer;",
    }) as HTMLInputElement;
    cb.checked = pipelineAnalystState[a.key];
    cb.addEventListener("change", () => {
      pipelineAnalystState[a.key] = cb.checked;
      onAnalystChange();
    });
    lbl.appendChild(cb);
    lbl.appendChild(ui_createElement("span", { text: a.label }));
    gridEl.appendChild(lbl);
  }

  // ── Behavior toggles (memory + tools) ─────────────────────────────────
  const behaviorRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 12px; flex-wrap: wrap;",
  });

  const makeToggle = (
    labelText: string,
    checked: boolean,
    onChange: (v: boolean) => void,
  ) => {
    const lbl = ui_createElement("label", {
      styleString:
        "display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--ios-text-primary); cursor: pointer;",
    });
    const cb = ui_createElement("input", {
      props: { type: "checkbox" },
      styleString: "width: 14px; height: 14px; cursor: pointer;",
    }) as HTMLInputElement;
    cb.checked = checked;
    cb.addEventListener("change", () => onChange(cb.checked));
    lbl.appendChild(cb);
    lbl.appendChild(ui_createElement("span", { text: labelText }));
    return lbl;
  };

  behaviorRow.appendChild(
    makeToggle("Memory", pipelineMemoryEnabled, (v) => {
      pipelineMemoryEnabled = v;
      onMemoryChange(v);
    }),
  );
  behaviorRow.appendChild(
    makeToggle("Tools", pipelineToolsEnabled, (v) => {
      pipelineToolsEnabled = v;
      onToolsChange(v);
    }),
  );

  return {
    headerEl,
    gridEl,
    behaviorRow,
    getEnabledAnalysts: () =>
      (Object.entries(pipelineAnalystState) as [string, boolean][])
        .filter(([, v]) => v)
        .map(([k]) => k),
    isMemoryEnabled: () => pipelineMemoryEnabled,
    isToolsEnabled: () => pipelineToolsEnabled,
  };
}
