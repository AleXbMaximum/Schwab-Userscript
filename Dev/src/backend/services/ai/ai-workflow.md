# AI Workflow

## Scope

This document describes the multi-agent AI analysis pipeline, including page integration, service orchestration, provider transport usage, tool-calling behavior, and persistence.

## Owner Directory

`Dev/src/backend/services/ai/`

## Recommended Read Order

1. [`../../../README.md`](../../../README.md)
2. [`README.md`](README.md)
3. [`../../../frontend/analysis_ai/README.md`](../../../frontend/analysis_ai/README.md)
4. [`../../core/network/network-and-auth.md`](../../core/network/network-and-auth.md)
5. [`../../core/db/STORAGE.md`](../../core/db/STORAGE.md)

## Module Map

| Layer | Files |
| --- | --- |
| Frontend page | [`../../../frontend/analysis_ai/page.ts`](../../../frontend/analysis_ai/page.ts), `pipelineConfigPanel.ts`, `pipelineFlow.ts`, `reportList.ts` |
| Frontend components | [`../../../frontend/analysis_ai/components/StageCard.ts`](../../../frontend/analysis_ai/components/StageCard.ts), `DecisionSummary.ts` |
| Frontend settings | [`../../../frontend/analysis_ai/setting_panel/settingsPanel.ts`](../../../frontend/analysis_ai/setting_panel/settingsPanel.ts), `customModelSection.ts`, `connectivitySection.ts` |
| Runtime service | [`AIService.ts`](AIService.ts), [`AIOrchestrator.ts`](AIOrchestrator.ts), [`types.ts`](types.ts), [`prompts/prompts.ts`](prompts/prompts.ts) |
| Data pipeline | [`pipeline/DataFetcher.ts`](pipeline/DataFetcher.ts), `contextBuilders.ts`, `dataPreprocessing.ts`, `formatters.ts`, `parsers.ts`, `summarizers.ts`, `technicals.ts`, `reportBuilder.ts` |
| LLM transport | [`../../core/network/llm/LLMClient.ts`](../../core/network/llm/LLMClient.ts) |
| Persistence | [`../../core/db/ai/AIAnalysisStore.ts`](../../core/db/ai/AIAnalysisStore.ts), [`../../core/db/ai/MemoryStore.ts`](../../core/db/ai/MemoryStore.ts), `config/*` |

## Runtime Model

- `AIService` is the application-wide singleton. It preserves one active run across page navigation and allows the page to re-subscribe after remount.
- `AIOrchestrator` owns stage transitions, cancellation checks, persistence checkpoints, and tool iteration limits.
- The page layer owns layout and interaction, but not stage semantics or run lifecycle policy.

## Stage Lifecycle

The pipeline runs through these phases:

```text
fetching_data
  -> running_analysts
  -> running_debate
  -> running_trader
  -> running_risk
  -> finalizing
  -> complete | error
```

Persistence checkpoints:

- create an early `in_progress` record
- update the record as stages complete or fail
- finalize as `completed`, `failed`, or `cancelled`
- optionally write a memory record when the final decision is complete

## Tool-Calling Contract

- tool calls are parsed from the XML-like envelope used by the orchestrator prompts
- tool names are allowlisted in the AI types and parser helpers
- iteration count is bounded by config
- each tool call appends tool output back into the running conversation before the next model turn

When adding a tool, update the type allowlist, parser allowlist, executor wiring, and prompt schema in the same change.

## Data Fetching And Enrichment

- `DataFetcher.fetchMarketData()` fans out across chart, fundamentals, news, and optional enrichment sources
- optional-source failures are fail-soft and should not abort the entire run unless the core data contract is broken
- preprocessing and formatter helpers live in the AI pipeline directory, not in the page

## Persistence Contract

- provider and model configuration live in KV-backed AI config stores
- analysis history persists in `ai_analyses`
- reusable condensed memory persists in `ai_memories`
- the frontend page reads persisted history through the same service-facing contract rather than bypassing orchestration

## Streaming Mode

When `enableStreaming: true` in `AIAnalysisConfig`:

- The orchestrator accepts an optional `onStream: AIStreamCallback` alongside the existing `onProgress`.
- `AIService.subscribeStream()` registers stream event listeners (separate from progress listeners).
- During `runAgentWithTools`, the **final iteration** of the ReAct loop uses `LLMClient.completeStream()` instead of `complete()`. Earlier iterations (tool-calling rounds) still use non-streaming `complete()` because full responses are needed to parse tool calls.
- Stream events (`AIStreamEvent`) flow: `LLMClient` -> `AIOrchestrator` -> `AIService` -> page subscriber.
- Event types: `stage_text`, `stage_thinking`, `stage_annotation`, `stage_done`.
- Frontend renders streaming content via `createStreamingStageCard()` with `requestAnimationFrame` throttling.
- Cancellation propagates through `AbortController` -> `AbortSignal` -> `parseSSEStream` reader.

## Web Search

When `enableWebSearch: true`:

- OpenAI: Uses Responses API (`/v1/responses`) with `tools: [{ type: "web_search" }]`.
- Gemini: Uses `tools: [{ google_search: {} }]` with grounding metadata.
- Anthropic: No built-in web search (option ignored).
- Citations are collected as `StreamChunk.annotation` events and stored in `AIStageResult.citations`.
- Frontend renders citations as footnotes via `buildCitationList()` in `StageCard.ts`.

## Markdown Rendering

- AI output is rendered through `renderMarkdown()` in `shared/utils/markdown.ts`.
- HTML entities are escaped before markdown processing (XSS-safe).
- StageCard and DecisionSummary both use markdown rendering.
- Markdown CSS is injected once via `injectStylesheet()`.

## Critical Invariants

- only one active AI analysis run is allowed at a time
- stage result shape must remain compatible with `StageCard` and the report/export helpers
- output parsers and prompt contracts must evolve together
- provider transport and DB schema ownership stay outside this directory even though this service coordinates both
- streaming mode is backward-compatible: when `enableStreaming: false`, behavior is identical to pre-streaming

## Related Local Docs

- [`README.md`](README.md)
- [`../README.md`](../README.md)
- [`../../../frontend/analysis_ai/README.md`](../../../frontend/analysis_ai/README.md)
- [`../../core/network/network-and-auth.md`](../../core/network/network-and-auth.md)
- [`../../core/db/STORAGE.md`](../../core/db/STORAGE.md)
