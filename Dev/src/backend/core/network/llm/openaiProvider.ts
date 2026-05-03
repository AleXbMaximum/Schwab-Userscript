import type {
  LLMRequestOptions,
  LLMResponse,
  StreamChunk,
} from "backend/services/ai/types";
import { parseSSEStream } from "./sseParser";

export type OpenAIProviderContext = {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  openAIServiceTier: "auto" | "default" | "flex" | "priority";
  supportsCustomTemperature: boolean;
  fetchWithTimeout: (
    url: string,
    init: RequestInit,
    timeoutMs: number,
    providerName: string,
  ) => Promise<Response>;
  fetchStreaming: (
    url: string,
    init: RequestInit,
    signal?: AbortSignal,
    providerName?: string,
    connectTimeoutMs?: number,
  ) => Promise<Response>;
};

export function isOpenAIReasoningModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return /^o\d/.test(normalized) || /^gpt-5($|[-.])/.test(normalized);
}

export async function completeOpenAI(
  ctx: OpenAIProviderContext,
  options: LLMRequestOptions,
): Promise<LLMResponse> {
  const isReasoning = isOpenAIReasoningModel(ctx.model);

  const payload: Record<string, unknown> = {
    model: ctx.model,
    input: [
      {
        role: isReasoning ? "developer" : "system",
        content: options.systemPrompt,
      },
      ...options.messages,
    ],
    max_output_tokens: options.maxTokens ?? ctx.maxTokens,
  };
  if (isReasoning) {
    payload.reasoning = { effort: "medium", summary: "auto" };
  }
  if (!isReasoning && ctx.supportsCustomTemperature) {
    payload.temperature = options.temperature ?? ctx.temperature;
  }

  const timeoutMs = ctx.openAIServiceTier === "flex" ? 600_000 : 180_000;
  const response = await ctx.fetchWithTimeout(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    timeoutMs,
    "OpenAI",
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `OpenAI API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const parsed = (await response.json()) as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      output_tokens_details?: {
        reasoning_tokens?: number;
      };
    };
    model?: string;
    status?: string;
  };

  const outputMsg = parsed.output?.find((o) => o.type === "message");
  const text =
    outputMsg?.content
      ?.filter((c) => c.type === "output_text")
      .map((c) => c.text ?? "")
      .join("") ?? "";
  const inputTokens = parsed.usage?.input_tokens ?? 0;
  const outputTokens = parsed.usage?.output_tokens ?? 0;
  const reasoningTokens =
    parsed.usage?.output_tokens_details?.reasoning_tokens;
  const finishReason = parsed.status ?? undefined;
  return {
    content: text,
    tokensUsed: inputTokens + outputTokens,
    model: parsed.model ?? ctx.model,
    ...(finishReason ? { finishReason } : {}),
    ...(reasoningTokens != null ? { reasoningTokens } : {}),
  };
}

/**
 * OpenAI streaming via the Responses API (/v1/responses).
 * Uses Responses API for native web_search tool and reasoning.summary.
 */
export async function* streamOpenAI(
  ctx: OpenAIProviderContext,
  options: LLMRequestOptions,
): AsyncGenerator<StreamChunk> {
  const isReasoning = isOpenAIReasoningModel(ctx.model);

  const payload: Record<string, unknown> = {
    model: ctx.model,
    stream: true,
    input: [
      {
        role: isReasoning ? "developer" : "system",
        content: options.systemPrompt,
      },
      ...options.messages,
    ],
    max_output_tokens: options.maxTokens ?? ctx.maxTokens,
  };
  if (options.webSearch) {
    payload.tools = [{ type: "web_search" }];
  }
  if (isReasoning) {
    payload.reasoning = { effort: "medium", summary: "auto" };
  }
  if (!isReasoning && ctx.supportsCustomTemperature) {
    payload.temperature = options.temperature ?? ctx.temperature;
  }

  const response = await ctx.fetchStreaming(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    options.signal,
    "OpenAI",
  );

  for await (const data of parseSSEStream(response, options.signal)) {
    let event: {
      type?: string;
      delta?: string;
      annotation?: Record<string, unknown>;
      response?: Record<string, unknown>;
    };
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }

    const eventType = event.type;
    if (eventType === "response.output_text.delta") {
      yield { type: "text", delta: event.delta ?? "" };
    } else if (eventType === "response.reasoning_summary_text.delta") {
      yield { type: "thinking", delta: event.delta ?? "" };
    } else if (eventType === "response.output_text.annotation.added") {
      const ann = event.annotation as
        | {
            type?: string;
            url?: string;
            title?: string;
            start_index?: number;
            end_index?: number;
          }
        | undefined;
      if (ann?.type === "url_citation" && ann.url) {
        yield {
          type: "annotation",
          annotation: {
            url: ann.url,
            title: ann.title ?? "",
            startIndex: ann.start_index ?? 0,
            endIndex: ann.end_index ?? 0,
          },
        };
      }
    } else if (eventType === "response.completed") {
      const usage = (event.response as Record<string, unknown>)?.usage as
        | Record<string, unknown>
        | undefined;
      const inputTokens = (usage?.input_tokens as number) ?? 0;
      const outputTokens = (usage?.output_tokens as number) ?? 0;
      const outputDetails = usage?.output_tokens_details as
        | Record<string, unknown>
        | undefined;
      yield {
        type: "done",
        tokensUsed: inputTokens + outputTokens,
        reasoningTokens: outputDetails?.reasoning_tokens as number | undefined,
        finishReason:
          ((event.response as Record<string, unknown>)?.status as string) ??
          undefined,
      };
    }
  }
}
