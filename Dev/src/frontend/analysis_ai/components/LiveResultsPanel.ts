import { ui_createElement } from "../../components/core/createElement";
import { DS_TYPOGRAPHY } from "../../components/core/theme";
import type {
  AIAgentRole,
  AIAnalysisRecord,
  AIAnalysisState,
  AIStreamEvent,
} from "../../../backend/services/ai/types";
import {
  buildReport,
  buildTranscript,
} from "../../../backend/services/ai/pipeline/reportBuilder";
import {
  createStreamingStageCard,
  renderStageCard,
} from "./StageCard";
import type { StreamingStageCard } from "./StageCard";
import { renderDecisionSummary } from "./DecisionSummary";
import { makeCopyBtn } from "./reportList";

/**
 * Encapsulates the live streaming-output panel and the finalized report view.
 *
 * - `handleStream(event)`: receives stream events, lazily creates per-stage
 *   cards, and updates them in place.
 * - `finalizeFromState(state)`: walks `state.stages` and finalizes any
 *   streaming card whose stage has reached a terminal status.
 * - `showRecord(record)`: clears the panel and renders a complete report
 *   (decision summary + per-agent stage cards + copy buttons).
 * - `reset()`: clears streaming state at the start of a new run.
 */
export function createLiveResultsPanel(deps: {
  resultsSection: HTMLElement;
}): {
  handleStream(event: AIStreamEvent): void;
  finalizeFromState(state: AIAnalysisState): void;
  showRecord(record: AIAnalysisRecord): void;
  reset(): void;
} {
  const { resultsSection } = deps;

  const streamingCards = new Map<string, StreamingStageCard>();
  let streamingStagesBox: HTMLElement | null = null;

  const cardKey = (role: AIAgentRole, label?: string): string =>
    label ? `${role}::${label}` : role;

  function ensureStreamingHost(): HTMLElement {
    if (streamingStagesBox) return streamingStagesBox;
    streamingStagesBox = ui_createElement("div", {
      styleString: "display: flex; flex-direction: column; gap: 6px;",
    });
    resultsSection.style.display = "flex";
    resultsSection.innerHTML = "";
    resultsSection.appendChild(
      ui_createElement("span", {
        text: "Live Agent Output",
        styleString: DS_TYPOGRAPHY.heading,
      }),
    );
    resultsSection.appendChild(streamingStagesBox);
    return streamingStagesBox;
  }

  function handleStream(event: AIStreamEvent): void {
    const key = cardKey(event.role, event.label);
    let card = streamingCards.get(key);

    if (!card) {
      card = createStreamingStageCard(event.role, event.label);
      streamingCards.set(key, card);
      ensureStreamingHost().appendChild(card.element);
    }

    if (event.type !== "stage_done") {
      card.updateFromStream(event);
    }
  }

  function finalizeFromState(state: AIAnalysisState): void {
    if (streamingCards.size === 0) return;
    for (const stage of state.stages) {
      if (stage.status !== "running") {
        const key = cardKey(stage.role, stage.label);
        const card = streamingCards.get(key);
        if (card) {
          card.finalize(stage);
          streamingCards.delete(key);
        }
      }
    }
  }

  function showRecord(record: AIAnalysisRecord): void {
    resultsSection.innerHTML = "";
    resultsSection.style.display = "flex";
    streamingCards.clear();
    streamingStagesBox = null;

    if (record.finalDecision) {
      resultsSection.appendChild(
        renderDecisionSummary(record.finalDecision, record.marketData),
      );
    }

    const stagesHeader = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 8px; flex-wrap: wrap;",
    });
    stagesHeader.appendChild(
      ui_createElement("span", {
        text: "Agent Reports",
        styleString: DS_TYPOGRAPHY.heading,
      }),
    );
    stagesHeader.appendChild(
      ui_createElement("span", {
        text: `${record.stages.length} agents · ${(record.totalTokensUsed / 1000).toFixed(1)}K tokens · ${(record.totalDurationMs / 1000).toFixed(0)}s`,
        styleString: "font-size: 11px; color: var(--ios-text-secondary);",
      }),
    );
    stagesHeader.appendChild(
      ui_createElement("span", { styleString: "flex: 1;" }),
    );
    stagesHeader.appendChild(
      makeCopyBtn("Copy Report", () => buildReport(record)),
    );
    stagesHeader.appendChild(
      makeCopyBtn("Copy Transcript", () => buildTranscript(record)),
    );
    resultsSection.appendChild(stagesHeader);

    const stagesBox = ui_createElement("div", {
      styleString: "display: flex; flex-direction: column; gap: 6px;",
    });
    for (const stage of record.stages) {
      stagesBox.appendChild(renderStageCard(stage));
    }
    resultsSection.appendChild(stagesBox);
  }

  function reset(): void {
    streamingCards.clear();
    streamingStagesBox = null;
  }

  return { handleStream, finalizeFromState, showRecord, reset };
}
