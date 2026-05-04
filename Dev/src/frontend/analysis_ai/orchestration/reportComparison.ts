import { ui_createElement } from "../../components/core/builders/createElement";
import { DS_TYPOGRAPHY } from "../../components/core/styles/theme";
import {
  createLLMClient,
  type LLMClientConfig,
} from "../../../backend/core/network/llm/LLMClient";
import type { AIAnalysisRecord } from "../../../backend/services/ai/types";
import { buildReport } from "../../../backend/services/ai/pipeline/reportBuilder";
import { makeCopyBtn } from "../components/reportList";

// ── Comparison prompt ────────────────────────────────────────────────────────

const COMPARISON_SYSTEM_PROMPT =
  "You are a senior portfolio analyst comparing two AI-generated trading analysis reports for the same stock. " +
  "Identify how the investment thesis has evolved, flag meaningful shifts, and synthesize a comparative view. " +
  "Be concise, direct, and actionable. Use markdown-style headers and bullet points.";

function buildComparisonUserContent(
  symbol: string,
  older: AIAnalysisRecord,
  newer: AIAnalysisRecord,
  dateOlder: string,
  dateNewer: string,
): string {
  return (
    `Compare these two analyses for ${symbol}:\n\n` +
    `${"=".repeat(60)}\n` +
    `REPORT A \u2014 ${dateOlder} (earlier)\n` +
    `${"=".repeat(60)}\n` +
    `${buildReport(older)}\n\n` +
    `${"=".repeat(60)}\n` +
    `REPORT B \u2014 ${dateNewer} (more recent)\n` +
    `${"=".repeat(60)}\n` +
    `${buildReport(newer)}\n\n` +
    `${"─".repeat(60)}\n` +
    `Address the following sections:\n\n` +
    `1. **Decision Change** \u2014 How has the recommendation evolved? (action, conviction, price targets, stop loss)\n` +
    `2. **Narrative Shift** \u2014 Which key arguments changed, reversed, or were newly introduced?\n` +
    `3. **Consistent Themes** \u2014 What risks, opportunities, or views remain unchanged across both reports?\n` +
    `4. **Risk Evolution** \u2014 Has the risk profile improved, deteriorated, or shifted in character?\n` +
    `5. **Momentum Signal** \u2014 Does the trajectory of AI consensus suggest an accelerating or decelerating thesis?\n` +
    `6. **Actionable Takeaway** \u2014 Given both analyses together, what should a trader pay most attention to right now?`
  );
}

// ── Date formatter ───────────────────────────────────────────────────────────

function formatReportDate(record: AIAnalysisRecord): string {
  return new Date(
    record.completedAt ?? record.requestedAt,
  ).toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ── Run comparison ───────────────────────────────────────────────────────────

export interface ComparisonContext {
  symbol: string;
  completedReports: AIAnalysisRecord[];
  resolveClientConfig: (profileId: string | undefined) => LLMClientConfig;
  statusLabel: HTMLElement;
  resultsSection: HTMLElement;
  onButtonStateChange: (disabled: boolean) => void;
}

export async function runComparison(ctx: ComparisonContext): Promise<void> {
  const { completedReports, resolveClientConfig, statusLabel, resultsSection } =
    ctx;
  if (completedReports.length < 2) return;

  const compConfig = resolveClientConfig(undefined);
  if (!compConfig.apiKey) {
    window.alert(
      "Please configure your AI API key from the AI Analysis settings menu (top-right gear).",
    );
    return;
  }

  const [newer, older] = completedReports;
  ctx.onButtonStateChange(true);
  statusLabel.textContent = "Running comparison analysis\u2026";
  resultsSection.innerHTML = "";
  resultsSection.style.display = "none";

  try {
    const client = createLLMClient(compConfig);
    const dateOlder = formatReportDate(older);
    const dateNewer = formatReportDate(newer);

    const response = await client.complete({
      systemPrompt: COMPARISON_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildComparisonUserContent(
            ctx.symbol,
            older,
            newer,
            dateOlder,
            dateNewer,
          ),
        },
      ],
      maxTokens: 1800,
      temperature: 0.4,
    });

    const compText = response.content;

    resultsSection.innerHTML = "";
    resultsSection.style.display = "flex";

    const compHeader = ui_createElement("div", {
      styleString:
        "display: flex; align-items: center; gap: 8px; flex-wrap: wrap;",
    });
    compHeader.appendChild(
      ui_createElement("span", {
        text: `\u21c4 Comparison \u2014 ${ctx.symbol}`,
        styleString: DS_TYPOGRAPHY.heading,
      }),
    );
    compHeader.appendChild(
      ui_createElement("span", {
        text: `${dateOlder}  \u2192  ${dateNewer}`,
        styleString: "font-size: 11px; color: var(--ios-text-secondary);",
      }),
    );
    compHeader.appendChild(
      ui_createElement("span", { styleString: "flex: 1;" }),
    );
    compHeader.appendChild(
      makeCopyBtn(
        "Copy",
        () =>
          `Comparison Analysis \u2014 ${ctx.symbol}\n${dateOlder}  \u2192  ${dateNewer}\n\n${compText}`,
      ),
    );
    resultsSection.appendChild(compHeader);

    const compBody = ui_createElement("div", {
      styleString:
        "padding: 14px 16px; border: 1px solid var(--ax-border); border-radius: var(--ax-radius-xl);" +
        " background: var(--ax-glass-2-bg); font-size: var(--ax-fs-lg); line-height: 1.5;" +
        " color: var(--ax-fg); white-space: pre-wrap; font-family: var(--ax-font-body);",
    });
    compBody.textContent = compText;
    resultsSection.appendChild(compBody);

    statusLabel.textContent = `Comparison done \u00b7 ${(response.tokensUsed / 1000).toFixed(1)}K tokens`;
  } catch (err) {
    statusLabel.textContent = `Comparison error: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    ctx.onButtonStateChange(false);
  }
}
