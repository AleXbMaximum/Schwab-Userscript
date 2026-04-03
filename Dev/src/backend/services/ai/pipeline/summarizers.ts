/**
 * Analyst-report summarizers for the AI analysis pipeline.
 *
 * Converts completed AIStageResult arrays into narrative text
 * (optionally augmented with machine-readable JSON blocks) that
 * is consumed by downstream debaters, trader, and risk managers.
 */

import type { AIAgentRole, AIStageResult } from "../types";

const ROLE_LABELS: Record<AIAgentRole, string> = {
  market_analyst: "MARKET ANALYST",
  fundamentals_analyst: "FUNDAMENTALS ANALYST",
  financial_quality_analyst: "FINANCIAL QUALITY ANALYST",
  sentiment_company: "SENTIMENT ANALYST (COMPANY)",
  sentiment_macro: "SENTIMENT ANALYST (MACRO)",
  technicals_analyst: "TECHNICALS ANALYST",
  sellside_analyst: "SELL-SIDE ANALYST",
  ownership_analyst: "OWNERSHIP ANALYST",
  bull_debater: "BULL ADVOCATE",
  bear_debater: "BEAR ADVOCATE",
  research_manager: "RESEARCH MANAGER",
  trader: "TRADER",
  risk_analyst_aggressive: "RISK ANALYST (AGGRESSIVE)",
  risk_analyst_conservative: "RISK ANALYST (CONSERVATIVE)",
  risk_analyst_neutral: "RISK ANALYST (NEUTRAL)",
  risk_manager: "RISK MANAGER",
};

export function summarizeAnalysts(stages: AIStageResult[]): string {
  return stages
    .filter((s) => s.status === "done" && s.content)
    .map((s) => `### ${s.label ?? ROLE_LABELS[s.role] ?? s.role}\n${s.content}`)
    .join("\n\n---\n\n");
}

/** Build analyst context that appends machine-readable JSON summaries for debaters. */
export function summarizeAnalystsWithJSON(stages: AIStageResult[]): string {
  const narrative = summarizeAnalysts(stages);
  const analystRoles: AIAgentRole[] = [
    "market_analyst",
    "fundamentals_analyst",
    "financial_quality_analyst",
    "sentiment_company",
    "sentiment_macro",
    "technicals_analyst",
    "sellside_analyst",
    "ownership_analyst",
  ];
  const jsonEntries = stages
    .filter((s) => analystRoles.includes(s.role) && s.summaryJSON)
    .map((s) => `${s.role}: ${JSON.stringify(s.summaryJSON)}`);
  if (!jsonEntries.length) return narrative;
  return (
    narrative +
    "\n\n---\n\n## ANALYST JSON SUMMARIES\n" +
    jsonEntries.join("\n")
  );
}
