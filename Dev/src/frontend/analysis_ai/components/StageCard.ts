import { ui_createElement } from "../../components/core/createElement";
import {
  ui_collapsible,
  ui_statusDot,
  injectStylesheet,
} from "../../components/core/ui_builders";
import {
  DS_COLORS,
  DS_TYPOGRAPHY,
  DS_COMPONENTS,
} from "../../components/core/theme";
import type {
  AIAgentRole,
  AIStageResult,
  AIStreamEvent,
} from "../../../backend/services/ai/types";
import { renderMarkdown } from "shared/utils/markdown";

// ── Markdown CSS (injected once) ─────────────────────────────────────────────

const MD_STYLES_ID = "alexquant-md-styles";

function ensureMarkdownStyles(): void {
  injectStylesheet(
    MD_STYLES_ID,
    `
.md-h1   { font-size: 15px; font-weight: 800; margin: 12px 0 4px; color: var(--ios-text-primary); }
.md-h2   { font-size: 13px; font-weight: 700; margin: 10px 0 3px; color: var(--ios-text-primary); }
.md-h3   { font-size: 12px; font-weight: 700; margin: 8px 0 2px; color: var(--ios-text-primary); }
.md-li   { padding-left: 14px; text-indent: -11px; margin: 1px 0; }
.md-li2  { padding-left: 26px; text-indent: -11px; margin: 1px 0; }
.md-code { background: var(--ax-bg-glass-inset); padding: 1px 4px; border-radius: 3px; font-size: 0.9em;
           font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.md-hr   { border: none; border-top: 1px solid var(--ios-border); margin: 8px 0; }
.md-spacer { height: 5px; }
.ai-thinking-wrap { margin-bottom: 6px; }
.ai-thinking-toggle {
  display: inline-flex; align-items: center; gap: 4px; cursor: pointer; user-select: none;
  font-size: 11px; font-weight: 600; color: var(--ios-purple); padding: 2px 0;
}
.ai-thinking-toggle:hover { opacity: 0.8; }
.ai-thinking-body {
  display: none; border-left: 2px solid var(--ios-purple); padding: 6px 10px; margin-top: 4px;
  font-size: 11px; line-height: 1.4; color: var(--ios-text-secondary); opacity: 0.85;
}
.ai-thinking-body.expanded { display: block; }
.ai-streaming-cursor::after {
  content: ""; display: inline-block; width: 6px; height: 13px;
  background: var(--ios-text-secondary); margin-left: 2px; vertical-align: text-bottom;
  animation: aiCursorBlink 0.8s step-end infinite;
}
@keyframes aiCursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.ai-citation-list { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--ios-border); }
.ai-citation-list a {
  font-size: 10px; color: var(--ios-blue); text-decoration: none; display: block; margin: 2px 0;
}
.ai-citation-list a:hover { text-decoration: underline; }
`,
  );
}

// ── Role labels ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<AIAgentRole, string> = {
  market_analyst: "Market Analyst",
  fundamentals_analyst: "Fundamentals Analyst",
  financial_quality_analyst: "Financial Quality",
  sentiment_company: "Sentiment (Company)",
  sentiment_macro: "Sentiment (Macro)",
  sellside_analyst: "Sell-Side Analyst",
  ownership_analyst: "Ownership Analyst",
  technicals_analyst: "Technicals Analyst",
  bull_debater: "Bull Advocate",
  bear_debater: "Bear Advocate",
  research_manager: "Research Manager",
  trader: "Trader",
  risk_analyst_aggressive: "Risk Analyst (Aggressive)",
  risk_analyst_conservative: "Risk Analyst (Conservative)",
  risk_analyst_neutral: "Risk Analyst (Neutral)",
  risk_manager: "Risk Manager",
};

// ── Static stage card (completed stages) ─────────────────────────────────────

export function renderStageCard(stage: AIStageResult): HTMLElement {
  ensureMarkdownStyles();

  const statusColor =
    stage.status === "done"
      ? DS_COLORS.positive
      : stage.status === "error"
        ? DS_COLORS.negative
        : stage.status === "running"
          ? DS_COLORS.neutral
          : DS_COLORS.muted;

  const dot = ui_statusDot(statusColor);

  const label = ui_createElement("span", {
    text: stage.label ?? ROLE_LABELS[stage.role] ?? stage.role,
    styleString: DS_TYPOGRAPHY.cardLabel,
  });

  const meta = ui_createElement("span", {
    text:
      stage.status === "running"
        ? "..."
        : stage.durationMs != null
          ? `${(stage.durationMs / 1000).toFixed(1)}s`
          : "",
    styleString: DS_TYPOGRAPHY.cardMeta,
  });

  const body = ui_createElement("div", {
    styleString:
      DS_COMPONENTS.collapsibleBody +
      " font-size: 12px; line-height: 1.5; color: var(--ios-text-secondary);" +
      " word-break: break-word; max-height: 400px; overflow-y: auto;",
  });

  if (stage.status === "error") {
    body.textContent = `Error: ${stage.errorMessage ?? "Unknown error"}`;
  } else {
    // Thinking block (collapsed by default on completed stages)
    if (stage.thinkingContent) {
      body.appendChild(buildThinkingBlock(stage.thinkingContent, false));
    }
    // Main content rendered as markdown
    const contentEl = ui_createElement("div", {});
    contentEl.innerHTML = renderMarkdown(stage.content || "");
    body.appendChild(contentEl);
    // Citations
    if (stage.citations && stage.citations.length > 0) {
      body.appendChild(buildCitationList(stage.citations));
    }
  }

  return ui_collapsible({
    headerChildren: [dot, label, meta],
    body,
    defaultExpanded: false,
  });
}

// ── Streaming stage card ─────────────────────────────────────────────────────

export interface StreamingStageCard {
  element: HTMLElement;
  /** Update content from a streaming event. */
  updateFromStream(event: AIStreamEvent): void;
  /** Finalize the card with the completed stage result. */
  finalize(stage: AIStageResult): void;
}

export function createStreamingStageCard(
  role: AIAgentRole,
  labelOverride?: string,
): StreamingStageCard {
  ensureMarkdownStyles();

  const dot = ui_statusDot(DS_COLORS.neutral);
  const label = ui_createElement("span", {
    text: labelOverride ?? ROLE_LABELS[role] ?? role,
    styleString: DS_TYPOGRAPHY.cardLabel,
  });
  const meta = ui_createElement("span", {
    text: "...",
    styleString: DS_TYPOGRAPHY.cardMeta,
  });

  const body = ui_createElement("div", {
    styleString:
      DS_COMPONENTS.collapsibleBody +
      " font-size: 12px; line-height: 1.5; color: var(--ios-text-secondary);" +
      " word-break: break-word; max-height: 400px; overflow-y: auto;",
  });

  const thinkingWrap = ui_createElement("div", {
    className: "ai-thinking-wrap",
    styleString: "display: none;",
  });
  const thinkingBody = ui_createElement("div", {
    className: "ai-thinking-body expanded",
  });
  thinkingWrap.appendChild(thinkingBody);
  body.appendChild(thinkingWrap);

  const contentEl = ui_createElement("div", {
    className: "ai-streaming-cursor",
  });
  body.appendChild(contentEl);

  const element = ui_collapsible({
    headerChildren: [dot, label, meta],
    body,
    defaultExpanded: true,
  });

  let accumulatedText = "";
  let accumulatedThinking = "";
  let pendingRender = false;

  const scheduleRender = () => {
    if (pendingRender) return;
    pendingRender = true;
    requestAnimationFrame(() => {
      pendingRender = false;
      contentEl.innerHTML = renderMarkdown(accumulatedText);
      if (accumulatedThinking) {
        thinkingWrap.style.display = "";
        thinkingBody.innerHTML = renderMarkdown(accumulatedThinking);
      }
      // Auto-scroll to bottom
      body.scrollTop = body.scrollHeight;
    });
  };

  return {
    element,
    updateFromStream(event: AIStreamEvent) {
      if (event.type === "stage_text") {
        accumulatedText = event.accumulated;
        scheduleRender();
      } else if (event.type === "stage_thinking") {
        accumulatedThinking = event.accumulated;
        scheduleRender();
      }
    },
    finalize(stage: AIStageResult) {
      // Remove streaming cursor
      contentEl.classList.remove("ai-streaming-cursor");

      // Update header
      const color =
        stage.status === "done" ? DS_COLORS.positive : DS_COLORS.negative;
      dot.style.cssText = `width: 7px; height: 7px; border-radius: 50%; background: ${color}; flex-shrink: 0;`;
      meta.textContent =
        stage.durationMs != null
          ? `${(stage.durationMs / 1000).toFixed(1)}s`
          : "";

      // Final render
      if (stage.status === "error") {
        contentEl.innerHTML = "";
        contentEl.textContent = `Error: ${stage.errorMessage ?? "Unknown error"}`;
        thinkingWrap.style.display = "none";
      } else {
        contentEl.innerHTML = renderMarkdown(stage.content || "");

        // Collapse thinking block
        if (stage.thinkingContent) {
          thinkingWrap.innerHTML = "";
          thinkingWrap.style.display = "";
          thinkingWrap.appendChild(
            buildThinkingBlock(stage.thinkingContent, false),
          );
        }

        // Citations
        if (stage.citations && stage.citations.length > 0) {
          body.appendChild(buildCitationList(stage.citations));
        }
      }
    },
  };
}

// ── Thinking block helper ────────────────────────────────────────────────────

function buildThinkingBlock(
  content: string,
  defaultExpanded: boolean,
): HTMLElement {
  const wrap = ui_createElement("div", { className: "ai-thinking-wrap" });

  const toggle = ui_createElement("div", { className: "ai-thinking-toggle" });
  const arrow = ui_createElement("span", {
    text: defaultExpanded ? "\u25BE" : "\u25B8",
  });
  const toggleLabel = ui_createElement("span", {
    text: defaultExpanded ? "Hide Thinking" : "Show Thinking",
  });
  toggle.appendChild(arrow);
  toggle.appendChild(toggleLabel);

  const thinkingBody = ui_createElement("div", {
    className: "ai-thinking-body" + (defaultExpanded ? " expanded" : ""),
  });
  thinkingBody.innerHTML = renderMarkdown(content);

  let expanded = defaultExpanded;
  toggle.addEventListener("click", () => {
    expanded = !expanded;
    thinkingBody.classList.toggle("expanded", expanded);
    arrow.textContent = expanded ? "\u25BE" : "\u25B8";
    toggleLabel.textContent = expanded ? "Hide Thinking" : "Show Thinking";
  });

  wrap.appendChild(toggle);
  wrap.appendChild(thinkingBody);
  return wrap;
}

// ── Citation list helper ─────────────────────────────────────────────────────

function buildCitationList(
  citations: { url: string; title: string }[],
): HTMLElement {
  const seen = new Set<string>();
  const unique: { url: string; title: string; index: number }[] = [];
  for (const c of citations) {
    if (!seen.has(c.url)) {
      seen.add(c.url);
      unique.push({ ...c, index: unique.length + 1 });
    }
  }

  const list = ui_createElement("div", { className: "ai-citation-list" });
  list.appendChild(
    ui_createElement("div", {
      text: "Sources",
      styleString:
        "font-size: 10px; font-weight: 700; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;",
    }),
  );
  for (const c of unique) {
    const a = document.createElement("a");
    a.href = c.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = `[${c.index}] ${c.title || c.url}`;
    list.appendChild(a);
  }
  return list;
}
