import type { AIProviderKind, OpenAIServiceTier } from "shared/types/core";
import type {
  LLMRequestOptions,
  LLMResponse,
  StreamChunk,
} from "backend/services/ai/types";
import { supportsCustomTemperature } from "backend/services/ai/config/modelCatalog";
import { logService } from "shared/log/core/LogService";
import {
  completeOpenAI,
  streamOpenAI,
  type OpenAIProviderContext,
} from "./openaiProvider";
import {
  completeAnthropic,
  streamAnthropic,
  type AnthropicProviderContext,
} from "./anthropicProvider";
import {
  completeGemini,
  streamGemini,
  type GeminiProviderContext,
} from "./geminiProvider";

const log = logService.namespace("ai");

export type LLMClientConfig = {
  provider: AIProviderKind;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  openAIServiceTier?: OpenAIServiceTier;
};

export type LLMClient = {
  readonly provider: AIProviderKind;
  readonly model: string;
  complete(options: LLMRequestOptions): Promise<LLMResponse>;
  completeStream(options: LLMRequestOptions): AsyncGenerator<StreamChunk>;
};

// ── Fetch helpers (module-scope, shared by all providers) ──────────────────

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  providerName: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
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
 * Fetch for streaming: connection timeout only (default 30s).
 * Once the connection is established the read timeout is managed by the
 * caller's AbortSignal, not by a timer.
 */
async function fetchStreaming(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
  providerName = "LLM",
  connectTimeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
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

// ── Provider dispatch table ────────────────────────────────────────────────

type ProviderHandlers = {
  complete: (
    ctx: OpenAIProviderContext & AnthropicProviderContext & GeminiProviderContext,
    options: LLMRequestOptions,
  ) => Promise<LLMResponse>;
  stream: (
    ctx: OpenAIProviderContext & AnthropicProviderContext & GeminiProviderContext,
    options: LLMRequestOptions,
  ) => AsyncGenerator<StreamChunk>;
};

const PROVIDERS: Record<AIProviderKind, ProviderHandlers> = {
  anthropic: {
    complete: completeAnthropic as ProviderHandlers["complete"],
    stream: streamAnthropic as ProviderHandlers["stream"],
  },
  openai: {
    complete: completeOpenAI as ProviderHandlers["complete"],
    stream: streamOpenAI as ProviderHandlers["stream"],
  },
  google: {
    complete: completeGemini as ProviderHandlers["complete"],
    stream: streamGemini as ProviderHandlers["stream"],
  },
};

export function createLLMClient(config: LLMClientConfig): LLMClient {
  const provider = config.provider;
  const model = config.model;
  const ctx = {
    apiKey: config.apiKey,
    model,
    maxTokens: config.maxTokens ?? 4096,
    temperature: config.temperature ?? 0.3,
    openAIServiceTier: config.openAIServiceTier ?? ("auto" as OpenAIServiceTier),
    supportsCustomTemperature: supportsCustomTemperature(provider, model),
    fetchWithTimeout,
    fetchStreaming,
  };
  const handlers = PROVIDERS[provider];

  return {
    provider,
    model,
    async complete(options) {
      const span = log.span("llmComplete", { provider, model });
      try {
        const result = await handlers.complete(ctx, options);
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
    },
    async *completeStream(options) {
      const span = log.span("llmCompleteStream", { provider, model });
      try {
        yield* handlers.stream(ctx, options);
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
    },
  };
}
