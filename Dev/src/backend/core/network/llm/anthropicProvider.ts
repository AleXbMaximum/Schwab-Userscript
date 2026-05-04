import type {
  LLMRequestOptions,
  LLMResponse,
  StreamChunk,
} from "backend/services/ai/types";
import { parseSSEStream } from "./sseParser";

export type AnthropicProviderContext = {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
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

const ENDPOINT = "https://api.anthropic.com/v1/messages";

function buildBody(
  ctx: AnthropicProviderContext,
  options: LLMRequestOptions,
  stream: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: ctx.model,
    max_tokens: options.maxTokens ?? ctx.maxTokens,
    temperature: options.temperature ?? ctx.temperature,
    system: options.systemPrompt,
    messages: options.messages,
  };
  if (stream) body.stream = true;
  return body;
}

function buildHeaders(ctx: AnthropicProviderContext): Record<string, string> {
  return {
    "x-api-key": ctx.apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
}

export async function completeAnthropic(
  ctx: AnthropicProviderContext,
  options: LLMRequestOptions,
): Promise<LLMResponse> {
  const response = await ctx.fetchWithTimeout(
    ENDPOINT,
    {
      method: "POST",
      headers: buildHeaders(ctx),
      body: JSON.stringify(buildBody(ctx, options, false)),
    },
    180_000,
    "Anthropic",
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Anthropic API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const parsed = (await response.json()) as {
    content?: { text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    model?: string;
  };
  const text = parsed.content?.[0]?.text ?? "";
  const tokens =
    (parsed.usage?.input_tokens ?? 0) + (parsed.usage?.output_tokens ?? 0);
  return {
    content: text,
    tokensUsed: tokens,
    model: parsed.model ?? ctx.model,
  };
}

/**
 * Anthropic streaming via /v1/messages with stream: true.
 */
export async function* streamAnthropic(
  ctx: AnthropicProviderContext,
  options: LLMRequestOptions,
): AsyncGenerator<StreamChunk> {
  const response = await ctx.fetchStreaming(
    ENDPOINT,
    {
      method: "POST",
      headers: buildHeaders(ctx),
      body: JSON.stringify(buildBody(ctx, options, true)),
    },
    options.signal,
    "Anthropic",
  );

  let totalTokens = 0;
  for await (const data of parseSSEStream(response, options.signal)) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }

    if (event.type === "content_block_delta") {
      const delta = event.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta") {
        yield { type: "text", delta: (delta.text as string) ?? "" };
      } else if (delta?.type === "thinking_delta") {
        yield { type: "thinking", delta: (delta.thinking as string) ?? "" };
      }
    } else if (event.type === "message_delta") {
      const usage = event.usage as Record<string, unknown> | undefined;
      totalTokens =
        ((usage?.input_tokens as number) ?? 0) +
        ((usage?.output_tokens as number) ?? 0);
    } else if (event.type === "message_stop") {
      yield { type: "done", tokensUsed: totalTokens };
    }
  }
}
