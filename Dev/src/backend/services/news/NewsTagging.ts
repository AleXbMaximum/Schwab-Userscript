import { LLMClient } from "../../core/network/llm/LLMClient";
import { getProviderApiKey } from "../ai/config/types";
import type { AIProvidersConfig } from "../ai/config/types";
import type { UnifiedNewsItem } from "./types";

export type NewsTag = string;

export type TaggedNewsItem = UnifiedNewsItem & {
  tags?: NewsTag[];
};

const TAG_SYSTEM_PROMPT =
  "You are a financial news classifier. For each news headline, assign 1-3 category tags from this list: " +
  "Fed, Rates, Inflation, Earnings, Tech, Energy, Crypto, Commodities, Geopolitical, Trade, Housing, Labor, Banking, IPO, M&A, Regulation, Healthcare, Consumer, Other. " +
  'Return valid JSON only: an array of objects with "index" (0-based) and "tags" (string[]). Nothing else.';

export async function tagNewsItems(
  items: UnifiedNewsItem[],
  providerConfig: AIProvidersConfig,
): Promise<TaggedNewsItem[]> {
  const apiKey = getProviderApiKey(providerConfig);
  if (!apiKey) return items;

  const headlines = items.map((item, i) => `[${i}] ${item.title}`).join("\n");

  const client = new LLMClient({
    provider: providerConfig.selected,
    apiKey,
    model: providerConfig.selectedModel,
    maxTokens: 512,
    temperature: 0,
  });

  try {
    const response = await client.complete({
      systemPrompt: TAG_SYSTEM_PROMPT,
      messages: [{ role: "user", content: headlines }],
    });

    const parsed: { index: number; tags: string[] }[] = JSON.parse(
      response.content,
    );
    const tagged = [...items] as TaggedNewsItem[];
    for (const entry of parsed) {
      if (tagged[entry.index]) {
        tagged[entry.index].tags = entry.tags;
      }
    }
    return tagged;
  } catch {
    return items;
  }
}
