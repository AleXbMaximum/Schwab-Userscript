import type {
  LLMRequestOptions,
  LLMResponse,
  StreamChunk,
} from "backend/services/ai/types";
import { parseSSEStream } from "./sseParser";

export type GeminiProviderContext = {
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

function buildBody(
  ctx: GeminiProviderContext,
  options: LLMRequestOptions,
  webSearch: boolean,
): Record<string, unknown> {
  const contents = options.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: options.systemPrompt }] },
    contents,
    generationConfig: {
      temperature: options.temperature ?? ctx.temperature,
      maxOutputTokens: options.maxTokens ?? ctx.maxTokens,
    },
  };
  if (webSearch) body.tools = [{ google_search: {} }];
  return body;
}

function buildUrl(ctx: GeminiProviderContext, streaming: boolean): string {
  const op = streaming ? "streamGenerateContent?alt=sse" : "generateContent";
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ctx.model)}:${op}${streaming ? "&" : "?"}key=${encodeURIComponent(ctx.apiKey)}`;
}

export async function completeGemini(
  ctx: GeminiProviderContext,
  options: LLMRequestOptions,
): Promise<LLMResponse> {
  const response = await ctx.fetchWithTimeout(
    buildUrl(ctx, false),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildBody(ctx, options, false)),
    },
    180_000,
    "Google",
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Google API error ${response.status}: ${text.slice(0, 300)}`,
    );
  }

  const parsed = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { totalTokenCount?: number };
  };
  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const tokens = parsed.usageMetadata?.totalTokenCount ?? 0;
  return { content: text, tokensUsed: tokens, model: ctx.model };
}

/**
 * Gemini streaming via streamGenerateContent?alt=sse.
 */
export async function* streamGemini(
  ctx: GeminiProviderContext,
  options: LLMRequestOptions,
): AsyncGenerator<StreamChunk> {
  const response = await ctx.fetchStreaming(
    buildUrl(ctx, true),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildBody(ctx, options, !!options.webSearch)),
    },
    options.signal,
    "Google",
  );

  let totalTokens = 0;
  let lastGroundingMetadata: Record<string, unknown> | null = null;

  for await (const data of parseSSEStream(response, options.signal)) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }

    const candidates = event.candidates as
      | Array<Record<string, unknown>>
      | undefined;
    const candidate = candidates?.[0];
    const content = candidate?.content as
      | { parts?: Array<Record<string, unknown>> }
      | undefined;
    const parts = content?.parts;

    if (parts) {
      for (const part of parts) {
        if (part.thought) {
          yield { type: "thinking", delta: (part.text as string) ?? "" };
        } else if (part.text) {
          yield { type: "text", delta: part.text as string };
        }
      }
    }

    const usageMeta = event.usageMetadata as
      | Record<string, unknown>
      | undefined;
    if (usageMeta?.totalTokenCount) {
      totalTokens = usageMeta.totalTokenCount as number;
    }

    if (candidate?.groundingMetadata) {
      lastGroundingMetadata = candidate.groundingMetadata as Record<
        string,
        unknown
      >;
    }
  }

  if (lastGroundingMetadata) {
    const chunks =
      (lastGroundingMetadata.groundingChunks as
        | Array<{ web?: { uri?: string; title?: string } }>
        | undefined) ?? [];
    for (const chunk of chunks) {
      if (chunk.web?.uri) {
        yield {
          type: "annotation",
          annotation: {
            url: chunk.web.uri,
            title: chunk.web.title ?? "",
            startIndex: 0,
            endIndex: 0,
          },
        };
      }
    }
  }

  yield { type: "done", tokensUsed: totalTokens };
}
