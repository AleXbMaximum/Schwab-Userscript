/**
 * Response parsers for the AI analysis pipeline.
 *
 * Extract structured data (tool calls, debate-continuation flags,
 * JSON summaries, risk-manager decisions) from raw LLM output text,
 * and evaluate data completeness of the MarketDataBundle.
 */

import type {
  AIFinalDecision,
  AIToolCall,
  AIToolName,
  DataCompletenessResult,
  MarketDataBundle,
} from "../types";

// ── Tool-call parsing ────────────────────────────────────────────────────────

export function parseToolCall(content: string): AIToolCall | null {
  const match = content.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as { name: string };
    const validNames: AIToolName[] = [
      "get_balance_sheet",
      "get_cash_flow",
      "get_income_statement",
      "get_insider_transactions",
      "get_global_macro_news",
      "get_barrons_news",
      "get_barrons_ratings",
      "get_barrons_financials",
    ];
    if (validNames.includes(parsed.name as AIToolName)) {
      return { name: parsed.name as AIToolName };
    }
  } catch {
    // ignore
  }
  return null;
}

export function stripToolCallTag(content: string): string {
  return content.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();
}

// ── Debate continuation ──────────────────────────────────────────────────────

export function parseContinueDebate(content: string): boolean {
  const match = content.match(
    /<continue_debate>(true|false)<\/continue_debate>/i,
  );
  return match?.[1]?.toLowerCase() === "true";
}

// ── Summary JSON extraction ──────────────────────────────────────────────────

/**
 * Extract and parse the SUMMARY_JSON: {...} block from an analyst's response content.
 * Returns null if no valid JSON block is found.
 */
export function parseSummaryJSON(
  content: string,
): Record<string, unknown> | null {
  const match = content.match(/SUMMARY_JSON:\s*(\{[\s\S]*?\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Strip the SUMMARY_JSON block from displayed content. */
export function stripSummaryJSON(content: string): string {
  return content.replace(/SUMMARY_JSON:\s*\{[\s\S]*?\}/, "").trim();
}

// ── Risk-manager decision parsing ────────────────────────────────────────────

export function parseRiskManagerDecision(
  content: string,
): AIFinalDecision | null {
  try {
    let jsonStr = content.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    const parsed = JSON.parse(jsonStr) as Partial<AIFinalDecision>;
    // Inject defaults for extended fields so old stored records don't break
    return {
      action: parsed.action ?? "HOLD",
      conviction: parsed.conviction ?? 5,
      targetPrice: parsed.targetPrice ?? null,
      stopLoss: parsed.stopLoss ?? null,
      timeHorizon: parsed.timeHorizon ?? "medium_term",
      riskLevel: parsed.riskLevel ?? "medium",
      keyBullPoints: parsed.keyBullPoints ?? [],
      keyBearPoints: parsed.keyBearPoints ?? [],
      riskFactors: parsed.riskFactors ?? [],
      summary: parsed.summary ?? "",
      entryTriggers: parsed.entryTriggers ?? [],
      invalidationLevel: parsed.invalidationLevel ?? null,
      scalePlan: parsed.scalePlan ?? [],
      hedgeSuggestion: parsed.hedgeSuggestion ?? null,
      watchlistPlan: parsed.watchlistPlan ?? null,
      gapRiskMitigation: parsed.gapRiskMitigation ?? [],
      positionNowPct: parsed.positionNowPct ?? null,
      compositeScores: parsed.compositeScores ?? null,
      dataQuality: parsed.dataQuality ?? null,
      aggregateScore: parsed.aggregateScore ?? null,
    };
  } catch {
    return null;
  }
}

// ── Data completeness evaluation ─────────────────────────────────────────────

/** Evaluate MarketDataBundle for missing critical fields. */
export function evaluateDataCompleteness(
  data: MarketDataBundle,
): DataCompletenessResult {
  const f = data.fundamentals;
  const KEY_FIELDS: Array<keyof typeof f> = [
    "peRatio",
    "forwardPE",
    "priceToBook",
    "evToEbitda",
    "revenueGrowthYoy",
    "earningsGrowthYoy",
    "netMargin",
    "freeCashFlow",
  ];
  const missingFields = KEY_FIELDS.filter((k) => f[k] == null) as string[];
  const hasAnyStatement =
    (data.balanceSheet?.quarters?.length ?? 0) > 0 ||
    (data.cashFlow?.quarters?.length ?? 0) > 0 ||
    (data.incomeStatement?.quarters?.length ?? 0) > 0;
  const criticalMissing = missingFields.length > 4 && !hasAnyStatement;
  return { missingFields, criticalMissing };
}
