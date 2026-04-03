import type { AIProviderKind, OpenAIServiceTier } from "shared/types/core";
import type {
  LLMRequestOptions,
  LLMResponse,
  StreamChunk,
} from "backend/services/ai/types";
import { supportsCustomTemperature } from "backend/services/ai/config/modelCatalog";
import { logService } from "shared/log/core/LogService";
import { parseSSEStream } from "./sseParser";

const log = logService.namespace("ai");

function isOpenAIReasoningModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return /^o\d/.test(normalized) || /^gpt-5($|[-.])/.test(normalized);
}

export type LLMClientConfig = {
  provider: AIProviderKind;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  openAIServiceTier?: OpenAIServiceTier;
};

export class LLMClient {
  readonly provider: AIProviderKind;
  readonly model: string;
  private readonly apiKey: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly openAIServiceTier: OpenAIServiceTier;
  private readonly supportsCustomTemperature: boolean;

  constructor(config: LLMClientConfig) {
    this.provider = config.provider;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
    this.temperature = config.temperature ?? 0.3;
    this.openAIServiceTier = config.openAIServiceTier ?? "auto";
    this.supportsCustomTemperature = supportsCustomTemperature(
      this.provider,
      this.model,
    );
  }

  // ── Non-streaming completion ─────────────────────────────────────────────

  async complete(options: LLMRequestOptions): Promise<LLMResponse> {
    const span = log.span("llmComplete", {
      provider: this.provider,
      model: this.model,
    });
    try {
      let result: LLMResponse;
      if (this.provider === "anthropic")
        result = await this.completeAnthropic(options);
      else if (this.provider === "google")
        result = await this.completeGoogle(options);
      else result = await this.completeOpenAI(options);
      span.end(
        "ok",
        { tokensUsed: result.tokensUsed, model: result.model },
        "info",
      );
      return result;
    } catch (err) {
      span.end(
        "error",
        { error: (err as Error)?.message ?? String(err) },
        "error",
      );
      throw err;
    }
  }

  // ── Streaming completion ─────────────────────────────────────────────────

  async *completeStream(
    options: LLMRequestOptions,
  ): AsyncGenerator<StreamChunk> {
    const span = log.span("llmCompleteStream", {
      provider: this.provider,
      model: this.model,
    });
    try {
      if (this.provider === "anthropic")
        yield* this.streamAnthropic(options);
      else if (this.provider === "google")
        yield* this.streamGemini(options);
      else yield* this.streamOpenAI(options);
      span.end("ok", {}, "info");
    } catch (err) {
      span.end(
        "error",
        { error: (err as Error)?.message ?? String(err) },
        "error",
      );
      yield {
        type: "error",
        error: (err as Error)?.message ?? String(err),
      };
    }
  }

  // ── Fetch helpers ────────────────────────────────────────────────────────

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    providerName: string,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      return response;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(
          `${providerName} request timed out (${Math.round(timeoutMs / 1000)}s)`,
        );
      }
      throw new Error(`${providerName} network error: ${String(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch for streaming: connection timeout only (30s).
   * Once the connection is established the read timeout is managed by the
   * caller's AbortSignal, not by a timer.
   */
  private async fetchStreaming(
    url: string,
    init: RequestInit,
    signal?: AbortSignal,
    providerName = "LLM",
    connectTimeoutMs = 30_000,
  ): Promise<Response> {
    const controller = new AbortController();
    // Combine caller signal with connection timeout
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    const timeoutId = setTimeout(() => controller.abort(), connectTimeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `${providerName} streaming error ${response.status}: ${text.slice(0, 300)}`,
        );
      }
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        if (signal?.aborted) throw new Error("Cancelled");
        throw new Error(
          `${providerName} streaming connection timed out (${Math.round(connectTimeoutMs / 1000)}s)`,
        );
      }
      throw err;
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }

  // ── Non-streaming providers ──────────────────────────────────────────────

  private async completeAnthropic(
    options: LLMRequestOptions,
  ): Promise<LLMResponse> {
    const body = {
      model: this.model,
      max_tokens: options.maxTokens ?? this.maxTokens,
      temperature: options.temperature ?? this.temperature,
      system: options.systemPrompt,
      messages: options.messages,
    };

    const response = await this.fetchWithTimeout(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
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
      model: parsed.model ?? this.model,
    };
  }

  private async completeGoogle(
    options: LLMRequestOptions,
  ): Promise<LLMResponse> {
    const contents = options.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: options.systemPrompt }] },
      contents,
      generationConfig: {
        temperature: options.temperature ?? this.temperature,
        maxOutputTokens: options.maxTokens ?? this.maxTokens,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const response = await this.fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
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
    return { content: text, tokensUsed: tokens, model: this.model };
  }

  private async completeOpenAI(
    options: LLMRequestOptions,
  ): Promise<LLMResponse> {
    const isReasoning = isOpenAIReasoningModel(this.model);

    const payload: Record<string, unknown> = {
      model: this.model,
      input: [
        {
          role: isReasoning ? "developer" : "system",
          content: options.systemPrompt,
        },
        ...options.messages,
      ],
      max_output_tokens: options.maxTokens ?? this.maxTokens,
    };
    if (isReasoning) {
      payload.reasoning = { effort: "medium", summary: "auto" };
    }
    if (!isReasoning && this.supportsCustomTemperature) {
      payload.temperature = options.temperature ?? this.temperature;
    }

    const timeoutMs = this.openAIServiceTier === "flex" ? 600_000 : 180_000;
    const response = await this.fetchWithTimeout(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
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
      model: parsed.model ?? this.model,
      ...(finishReason ? { finishReason } : {}),
      ...(reasoningTokens != null ? { reasoningTokens } : {}),
    };
  }

  // ── Streaming providers ──────────────────────────────────────────────────

  /**
   * OpenAI streaming via the Responses API (/v1/responses).
   * Uses Responses API for native web_search tool and reasoning.summary.
   */
  private async *streamOpenAI(
    options: LLMRequestOptions,
  ): AsyncGenerator<StreamChunk> {
    const isReasoning = isOpenAIReasoningModel(this.model);

    const payload: Record<string, unknown> = {
      model: this.model,
      stream: true,
      input: [
        {
          role: isReasoning ? "developer" : "system",
          content: options.systemPrompt,
        },
        ...options.messages,
      ],
      max_output_tokens: options.maxTokens ?? this.maxTokens,
    };
    if (options.webSearch) {
      payload.tools = [{ type: "web_search" }];
    }
    if (isReasoning) {
      payload.reasoning = { effort: "medium", summary: "auto" };
    }
    if (!isReasoning && this.supportsCustomTemperature) {
      payload.temperature = options.temperature ?? this.temperature;
    }

    const response = await this.fetchStreaming(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      options.signal,
      "OpenAI",
    );

    for await (const data of parseSSEStream(response, options.signal)) {
      let event: { type?: string; delta?: string; annotation?: Record<string, unknown>; response?: Record<string, unknown> };
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
        const usage = (event.response as Record<string, unknown>)
          ?.usage as Record<string, unknown> | undefined;
        const inputTokens = (usage?.input_tokens as number) ?? 0;
        const outputTokens = (usage?.output_tokens as number) ?? 0;
        const outputDetails = usage?.output_tokens_details as
          | Record<string, unknown>
          | undefined;
        yield {
          type: "done",
          tokensUsed: inputTokens + outputTokens,
          reasoningTokens: outputDetails?.reasoning_tokens as
            | number
            | undefined,
          finishReason:
            ((event.response as Record<string, unknown>)
              ?.status as string) ?? undefined,
        };
      }
    }
  }

  /**
   * Anthropic streaming via /v1/messages with stream: true.
   */
  private async *streamAnthropic(
    options: LLMRequestOptions,
  ): AsyncGenerator<StreamChunk> {
    const body = {
      model: this.model,
      max_tokens: options.maxTokens ?? this.maxTokens,
      temperature: options.temperature ?? this.temperature,
      system: options.systemPrompt,
      messages: options.messages,
      stream: true,
    };

    const response = await this.fetchStreaming(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
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

  /**
   * Gemini streaming via streamGenerateContent?alt=sse.
   */
  private async *streamGemini(
    options: LLMRequestOptions,
  ): AsyncGenerator<StreamChunk> {
    const contents = options.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: options.systemPrompt }] },
      contents,
      generationConfig: {
        temperature: options.temperature ?? this.temperature,
        maxOutputTokens: options.maxTokens ?? this.maxTokens,
      },
    };
    if (options.webSearch) {
      body.tools = [{ google_search: {} }];
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;

    const response = await this.fetchStreaming(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
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

    // Emit grounding citations after stream ends
    if (lastGroundingMetadata) {
      const chunks = (
        lastGroundingMetadata.groundingChunks as
          | Array<{ web?: { uri?: string; title?: string } }>
          | undefined
      ) ?? [];
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
}
