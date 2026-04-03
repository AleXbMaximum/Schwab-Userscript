import type { AIAnalysisRecord } from "../types";

// Report = decision summary + per-agent output (what each agent concluded)
export function buildReport(record: AIAnalysisRecord): string {
  const lines: string[] = [];
  const d = record.finalDecision;
  const ts = new Date(record.completedAt ?? record.requestedAt).toLocaleString(
    "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  );
  const divider = "\u2500".repeat(64);
  const bigDivider = "\u2550".repeat(64);

  lines.push(`AI Analysis Report \u2014 ${record.symbol}`);
  lines.push(`Generated: ${ts}`);
  lines.push(`Model: ${record.model} | Provider: ${record.provider}`);
  lines.push(
    `${record.stages.length} agents \u00b7 ${(record.totalTokensUsed / 1000).toFixed(1)}K tokens \u00b7 ${(record.totalDurationMs / 1000).toFixed(0)}s`,
  );
  lines.push("");

  if (d) {
    lines.push(bigDivider);
    lines.push("FINAL DECISION");
    lines.push(bigDivider);
    lines.push(`DECISION: ${d.action}  |  Conviction: ${d.conviction}/10`);
    lines.push(
      `Time Horizon: ${d.timeHorizon.replace(/_/g, " ")}  |  Risk Level: ${d.riskLevel}`,
    );
    if (d.targetPrice != null)
      lines.push(`Target Price: $${d.targetPrice.toFixed(2)}`);
    if (d.stopLoss != null)
      lines.push(`Stop Loss:    $${d.stopLoss.toFixed(2)}`);
    lines.push("");
    lines.push("Summary:");
    lines.push(d.summary);
    lines.push("");
    if (d.keyBullPoints.length > 0) {
      lines.push("Bull Case:");
      d.keyBullPoints.forEach((p) => lines.push(`  \u2022 ${p}`));
      lines.push("");
    }
    if (d.keyBearPoints.length > 0) {
      lines.push("Bear Case:");
      d.keyBearPoints.forEach((p) => lines.push(`  \u2022 ${p}`));
      lines.push("");
    }
    if (d.riskFactors.length > 0) {
      lines.push("Risk Factors:");
      d.riskFactors.forEach((p) => lines.push(`  \u2022 ${p}`));
      lines.push("");
    }
  }

  for (const stage of record.stages) {
    lines.push(divider);
    const label = stage.label ?? stage.role;
    const meta: string[] = [stage.status];
    if (stage.durationMs != null)
      meta.push(`${(stage.durationMs / 1000).toFixed(1)}s`);
    if (stage.tokensUsed != null)
      meta.push(`${stage.tokensUsed.toLocaleString()} tokens`);
    if (stage.toolCallsMade != null && stage.toolCallsMade > 0)
      meta.push(
        `${stage.toolCallsMade} tool call${stage.toolCallsMade !== 1 ? "s" : ""}`,
      );
    lines.push(`[${label}]  (${meta.join(" | ")})`);
    lines.push("");
    if (stage.errorMessage) {
      lines.push(`ERROR: ${stage.errorMessage}`);
    } else {
      lines.push(stage.content || "(no output)");
    }
    lines.push("");
  }

  return lines.join("\n");
}

// Transcript = raw market data + every LLM exchange (system prompt -> user input -> assistant reply, including tool rounds)
export function buildTranscript(record: AIAnalysisRecord): string {
  const lines: string[] = [];
  const ts = new Date(record.completedAt ?? record.requestedAt).toLocaleString(
    "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  );
  const thin = "\u2500".repeat(64);
  const thick = "\u2550".repeat(64);

  lines.push(`AI Analysis Full Transcript \u2014 ${record.symbol}`);
  lines.push(`Generated: ${ts}`);
  lines.push(`Model: ${record.model} | Provider: ${record.provider}`);
  lines.push(
    `${record.stages.length} stages \u00b7 ${(record.totalTokensUsed / 1000).toFixed(1)}K tokens \u00b7 ${(record.totalDurationMs / 1000).toFixed(0)}s`,
  );
  lines.push("");

  if (record.marketData) {
    lines.push(thick);
    lines.push("RAW MARKET DATA");
    lines.push(thick);
    lines.push(JSON.stringify(record.marketData, null, 2));
    lines.push("");
  }

  for (const stage of record.stages) {
    lines.push(thick);
    const label = stage.label ?? stage.role;
    const meta: string[] = [stage.status];
    if (stage.durationMs != null)
      meta.push(`${(stage.durationMs / 1000).toFixed(1)}s`);
    if (stage.tokensUsed != null)
      meta.push(`${stage.tokensUsed.toLocaleString()} tokens`);
    if (stage.toolCallsMade != null && stage.toolCallsMade > 0)
      meta.push(
        `${stage.toolCallsMade} tool call${stage.toolCallsMade !== 1 ? "s" : ""}`,
      );
    lines.push(`STAGE: ${label}  (${meta.join(" | ")})`);
    lines.push(thick);

    if (stage.systemPrompt) {
      lines.push(`${thin}`);
      lines.push("SYSTEM PROMPT");
      lines.push(`${thin}`);
      lines.push(stage.systemPrompt);
      lines.push("");
    }

    if (stage.inputMessages && stage.inputMessages.length > 0) {
      for (let i = 0; i < stage.inputMessages.length; i++) {
        const msg = stage.inputMessages[i];
        lines.push(`${thin}`);
        lines.push(
          `${msg.role === "user" ? "USER INPUT" : "ASSISTANT"} [turn ${i + 1}]`,
        );
        lines.push(`${thin}`);
        lines.push(msg.content);
        lines.push("");
      }
    } else {
      lines.push(
        "(prompt not recorded \u2014 generated before transcript logging was added)",
      );
      lines.push("");
    }

    lines.push(`${thin}`);
    lines.push("ASSISTANT RESPONSE (final output)");
    lines.push(`${thin}`);
    if (stage.errorMessage) {
      lines.push(`ERROR: ${stage.errorMessage}`);
    } else {
      lines.push(stage.content || "(no output)");
    }
    lines.push("");
  }

  if (record.finalDecision) {
    lines.push(thick);
    lines.push("FINAL DECISION (JSON)");
    lines.push(thick);
    lines.push(JSON.stringify(record.finalDecision, null, 2));
    lines.push("");
  }

  return lines.join("\n");
}

export function decisionColor(action: string): string {
  if (action === "BUY" || action === "STRONG_BUY") return "var(--ios-green)";
  if (action === "SELL" || action === "STRONG_SELL") return "var(--ios-red)";
  return "var(--ios-orange)";
}
