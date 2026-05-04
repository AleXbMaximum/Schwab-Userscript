import { createLLMClient } from "../../core/network/llm/LLMClient";
import { getProviderApiKey } from "../ai/config/types";
import type { AIProvidersConfig } from "../ai/config/types";
import type { LLMResponse } from "../ai/types";
import { getNewsItemSymbols } from "./types";
import type { UnifiedNewsItem } from "./types";

const SYSTEM_PROMPT =
  "You are a concise financial news analyst. Summarize the provided news articles in a brief, actionable format. " +
  "Group by theme. Highlight key market-moving events, sentiment shifts, and notable corporate actions. " +
  "Use bullet points. Keep it under 400 words.";
const RETRY_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  " Return plain-text bullet points directly. Never return an empty response.";
const PRIMARY_MAX_TOKENS = 2048;
const RETRY_MAX_TOKENS = 4096;
const PROMPT_ITEM_LIMIT = 120;
const SUMMARY_CHAR_LIMIT = 700;

export type SummarizeMode = "all" | "new";

/**
 * Lightweight single-call LLM summarizer for news items.
 * Reuses the user's AI provider config from AIConfigStore.
 */
export async function summarizeNews(
  items: UnifiedNewsItem[],
  mode: SummarizeMode,
  providerConfig: AIProvidersConfig,
): Promise<string> {
  const filtered = mode === "new" ? items.filter((i) => i.isNew) : items;

  if (filtered.length === 0) {
    return mode === "new"
      ? "No new articles to summarize."
      : "No articles to summarize.";
  }

  const apiKey = getProviderApiKey(providerConfig);
  if (!apiKey) {
    return "AI provider API key not configured. Go to Settings > AI to set up.";
  }

  const effectiveModel =
    providerConfig.newsModel && providerConfig.newsModel.trim().length > 0
      ? providerConfig.newsModel
      : providerConfig.selectedModel;

  const { limitedItems, omittedCount } = limitPromptItems(filtered);
  const newsText = limitedItems
    .map((n, i) => {
      const symbols = getNewsItemSymbols(n);
      return (
        `[${i + 1}] ${n.title}\n` +
        `Source: ${n.source} (${n.sourceType})` +
        (symbols.length > 0 ? ` | Symbols: ${symbols.join(", ")}` : "") +
        `\n${truncateText(n.summary || "(no summary)", SUMMARY_CHAR_LIMIT)}`
      );
    })
    .join("\n\n");

  const scopeLabel = mode === "new" ? "NEW (previously unseen)" : "all";
  const coverageNote =
    omittedCount > 0
      ? `\nOnly the ${limitedItems.length} most recent articles are included out of ${filtered.length} total because of prompt limits.\n`
      : "\n";
  const userMessage = `Summarize these ${scopeLabel} news articles.${coverageNote}\n${newsText}`;

  const baseClientConfig = {
    provider: providerConfig.selected,
    apiKey,
    model: effectiveModel,
    temperature: 0.2,
    ...(providerConfig.selected === "openai"
      ? { openAIServiceTier: providerConfig.openai.serviceTier }
      : {}),
  } as const;

  const primaryResponse = await createLLMClient({
    ...baseClientConfig,
    maxTokens: PRIMARY_MAX_TOKENS,
  }).complete({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const primaryText = primaryResponse.content.trim();
  if (primaryText.length > 0) return primaryText;

  const shouldRetry =
    providerConfig.selected === "openai" &&
    (primaryResponse.finishReason === "length" ||
      (primaryResponse.reasoningTokens ?? 0) > 0);

  if (shouldRetry) {
    const retryResponse = await createLLMClient({
      ...baseClientConfig,
      maxTokens: RETRY_MAX_TOKENS,
    }).complete({
      systemPrompt: RETRY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const retryText = retryResponse.content.trim();
    if (retryText.length > 0) return retryText;
    return buildEmptySummaryMessage(retryResponse);
  }

  return buildEmptySummaryMessage(primaryResponse);
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}...`;
}

function limitPromptItems(items: UnifiedNewsItem[]): {
  limitedItems: UnifiedNewsItem[];
  omittedCount: number;
} {
  if (items.length <= PROMPT_ITEM_LIMIT) {
    return { limitedItems: items, omittedCount: 0 };
  }
  return {
    limitedItems: items.slice(0, PROMPT_ITEM_LIMIT),
    omittedCount: items.length - PROMPT_ITEM_LIMIT,
  };
}

function buildEmptySummaryMessage(response: LLMResponse): string {
  const details: string[] = [];
  if (response.finishReason)
    details.push(`finish_reason=${response.finishReason}`);
  if (response.reasoningTokens != null)
    details.push(`reasoning_tokens=${response.reasoningTokens}`);
  const detailText = details.length > 0 ? ` (${details.join(", ")})` : "";
  return (
    `AI returned an empty summary${detailText}. ` +
    "Please retry, reduce article count, or switch the News model in News settings."
  );
}
