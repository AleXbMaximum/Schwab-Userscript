import { ui_createElement } from "../../components/core/createElement";
import type {
  AIAnalysisPhase,
  AIAnalysisState,
  AIAgentRole,
} from "../../../backend/services/ai/types";
import { renderStageCard } from "../components/StageCard";

// ── Types ────────────────────────────────────────────────────────────────────

export type PipelineNodeDef = {
  id: string;
  label: string;
  phaseMatch: AIAnalysisPhase[];
  roleFilter: AIAgentRole[];
};

type NodeStatus = "pending" | "running" | "done" | "error";

// ── Constants ────────────────────────────────────────────────────────────────

const PHASE_ORDER: AIAnalysisPhase[] = [
  "fetching_data",
  "running_analysts",
  "running_debate",
  "running_trader",
  "running_risk",
  "finalizing",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNodeStatus(
  node: PipelineNodeDef,
  state: AIAnalysisState | null,
): NodeStatus {
  if (!state || state.phase === "idle") return "pending";
  if (state.phase === "complete") return "done";
  if (state.phase === "error") {
    const currentIdx = PHASE_ORDER.indexOf(state.phase);
    const nodeIdx = Math.min(
      ...node.phaseMatch
        .map((p) => PHASE_ORDER.indexOf(p))
        .filter((i) => i >= 0),
    );
    if (nodeIdx <= currentIdx) return "error";
    return "pending";
  }
  const currentIdx = PHASE_ORDER.indexOf(state.phase);
  const nodeMinIdx = Math.min(
    ...node.phaseMatch.map((p) => {
      const i = PHASE_ORDER.indexOf(p);
      return i >= 0 ? i : Infinity;
    }),
  );
  if (nodeMinIdx === Infinity) return "pending";
  if (currentIdx > nodeMinIdx) return "done";
  if (node.phaseMatch.includes(state.phase)) return "running";
  return "pending";
}

function nodeChipStyle(status: NodeStatus): string {
  const base =
    "padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;" +
    " white-space: nowrap; transition: all 0.3s; border: 1.5px solid; user-select: none;";
  switch (status) {
    case "pending":
      return (
        base +
        " background: rgba(0,0,0,0.03); color: var(--ios-text-secondary); border-color: var(--ios-border); cursor: default;"
      );
    case "running":
      return (
        base +
        " background: rgba(0,122,255,0.12); color: var(--ios-blue); border-color: rgba(0,122,255,0.3); cursor: default;"
      );
    case "done":
      return (
        base +
        " background: rgba(52,199,89,0.10); color: var(--ios-green); border-color: rgba(52,199,89,0.3); cursor: pointer;"
      );
    case "error":
      return (
        base +
        " background: rgba(255,59,48,0.10); color: var(--ios-red); border-color: rgba(255,59,48,0.3); cursor: pointer;"
      );
  }
}

// ── Node builder ─────────────────────────────────────────────────────────────

export function buildPipelineNodes(
  numAnalysts: number,
  debateRounds: number,
  riskRounds: number,
): PipelineNodeDef[] {
  return [
    {
      id: "data",
      label: "Data",
      phaseMatch: ["fetching_data"],
      roleFilter: [],
    },
    {
      id: "analysts",
      label: `Analysts (${numAnalysts})`,
      phaseMatch: ["running_analysts"],
      roleFilter: [
        "market_analyst",
        "technicals_analyst",
        "fundamentals_analyst",
        "financial_quality_analyst",
        "sentiment_company",
        "sentiment_macro",
        "sellside_analyst",
        "ownership_analyst",
      ],
    },
    {
      id: "debate",
      label: `Debate \u00d7${debateRounds}`,
      phaseMatch: ["running_debate"],
      roleFilter: ["bull_debater", "bear_debater", "research_manager"],
    },
    {
      id: "trader",
      label: "Trader",
      phaseMatch: ["running_trader"],
      roleFilter: ["trader"],
    },
    {
      id: "risk",
      label: `Risk \u00d7${riskRounds}`,
      phaseMatch: ["running_risk"],
      roleFilter: [
        "risk_analyst_aggressive",
        "risk_analyst_conservative",
        "risk_analyst_neutral",
      ],
    },
    {
      id: "risk_mgr",
      label: "Risk Mgr",
      phaseMatch: ["finalizing"],
      roleFilter: ["risk_manager"],
    },
  ];
}

// ── Flow component ───────────────────────────────────────────────────────────

export interface PipelineFlowResult {
  element: HTMLElement;
  update(state: AIAnalysisState | null, nodes: PipelineNodeDef[]): void;
  collapse(): void;
  getState(): AIAnalysisState | null;
}

export function createPipelineFlow(): PipelineFlowResult {
  let currentPipelineState: AIAnalysisState | null = null;
  let currentExpandedNode: string | null = null;

  const container = ui_createElement("div", {
    styleString: "display: flex; flex-direction: column; gap: 8px;",
  });
  const flowRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 0; overflow-x: auto; padding: 4px 0;",
  });
  const flowExpandPanel = ui_createElement("div", {
    styleString: "display: none; flex-direction: column; gap: 6px;",
  });
  container.appendChild(flowRow);
  container.appendChild(flowExpandPanel);

  const update = (state: AIAnalysisState | null, nodes: PipelineNodeDef[]) => {
    if (state !== undefined) currentPipelineState = state;
    flowRow.innerHTML = "";

    nodes.forEach((node, idx) => {
      const status = getNodeStatus(node, currentPipelineState);
      const chip = ui_createElement("div", {
        text: node.label,
        styleString: nodeChipStyle(status),
      });

      if (status === "done" || status === "error") {
        chip.addEventListener("click", () => {
          if (currentExpandedNode === node.id) {
            currentExpandedNode = null;
            flowExpandPanel.style.display = "none";
            flowExpandPanel.innerHTML = "";
            return;
          }
          currentExpandedNode = node.id;
          flowExpandPanel.innerHTML = "";
          flowExpandPanel.style.display = "flex";

          const stages = (currentPipelineState?.stages ?? []).filter((s) =>
            node.roleFilter.includes(s.role),
          );

          if (stages.length === 0) {
            flowExpandPanel.appendChild(
              ui_createElement("span", {
                text:
                  node.id === "data"
                    ? "Data fetch completed."
                    : "No stage data available.",
                styleString:
                  "font-size: 12px; color: var(--ios-text-secondary); padding: 6px 0;",
              }),
            );
          } else {
            for (const stage of stages) {
              flowExpandPanel.appendChild(renderStageCard(stage));
            }
          }
        });
      }

      if (status === "running") {
        chip.style.animation = "none";
        let opacity = 1;
        const pulseInterval = setInterval(() => {
          opacity = opacity === 1 ? 0.6 : 1;
          chip.style.opacity = String(opacity);
          if (!chip.isConnected) clearInterval(pulseInterval);
        }, 800);
      }

      flowRow.appendChild(chip);
      if (idx < nodes.length - 1) {
        flowRow.appendChild(
          ui_createElement("span", {
            text: "\u2192",
            styleString:
              "font-size: 12px; color: var(--ios-text-secondary); margin: 0 5px; flex-shrink: 0;",
          }),
        );
      }
    });
  };

  return {
    element: container,
    update,
    collapse: () => {
      currentExpandedNode = null;
      flowExpandPanel.style.display = "none";
      flowExpandPanel.innerHTML = "";
    },
    getState: () => currentPipelineState,
  };
}
