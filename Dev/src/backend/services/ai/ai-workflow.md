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
| Frontend page | [`../../../frontend/analysis_ai/page.ts`](../../../frontend/analysis_ai/page.ts), `pipeline/pipelineConfigPanel.ts`, `pipeline/pipelineFlow.ts`, `pipeline/agentSelector.ts`, `pipeline/debateConfig.ts`, `components/reportList.ts` |
| Frontend components | [`../../../frontend/analysis_ai/components/StageCard.ts`](../../../frontend/analysis_ai/components/StageCard.ts), `components/DecisionSummary.ts`, `components/LiveResultsPanel.ts` |
| Frontend orchestration | `orchestration/analysisRunner.ts`, `orchestration/reportComparison.ts`, `orchestration/symbolInput.ts` |
| Frontend settings | `setting_panel/settingsPanel.ts`, `setting_panel/customModelSection.ts`, `setting_panel/modelSection.ts`, `setting_panel/providerSection.ts`, `setting_panel/connectivitySection.ts` |
| Runtime service | [`AIService.ts`](AIService.ts), [`AIOrchestrator.ts`](AIOrchestrator.ts) (thin coordinator), [`service/aiPhaseAnalysts.ts`](service/aiPhaseAnalysts.ts), [`service/aiPhaseDebate.ts`](service/aiPhaseDebate.ts), [`service/aiAgentRunner.ts`](service/aiAgentRunner.ts), [`types.ts`](types.ts) |
| Prompts | [`prompts/prompts.ts`](prompts/prompts.ts) (barrel re-exporting per-agent files), [`prompts/intensity.ts`](prompts/intensity.ts), [`prompts/tools.ts`](prompts/tools.ts), `prompts/agents/*` |
| Tools | [`tools/toolExecutor.ts`](tools/toolExecutor.ts) |
| Data pipeline | [`pipeline/DataFetcher.ts`](pipeline/DataFetcher.ts), [`pipeline/prepareBundle.ts`](pipeline/prepareBundle.ts), `pipeline/contextBuilders.ts`, `pipeline/dataPreprocessing.ts`, `pipeline/formatters.ts`, `pipeline/parsers.ts`, `pipeline/summarizers.ts`, `pipeline/technicals.ts`, `pipeline/reportBuilder.ts` |
| LLM transport | [`../../core/network/llm/LLMClient.ts`](../../core/network/llm/LLMClient.ts) - `createLLMClient(config)` returns a client with `complete()` / `completeStream()`; provider dispatch lives in `anthropicProvider.ts`, `geminiProvider.ts`, `openaiProvider.ts` |
| Persistence | [`../../core/db/ai/AIAnalysisStore.ts`](../../core/db/ai/AIAnalysisStore.ts), [`../../core/db/ai/MemoryStore.ts`](../../core/db/ai/MemoryStore.ts), `config/*` |

## Runtime Model

- `AIService` is the application-wide singleton. It preserves one active run across page navigation and allows the page to re-subscribe after remount.
- `AIOrchestrator` is a thin coordinator: it owns top-level stage sequencing, cancellation checks, and persistence checkpoints, but delegates analyst execution to `service/aiPhaseAnalysts.ts`, debate to `service/aiPhaseDebate.ts`, and per-agent ReAct loops (with tool iteration limits) to `service/aiAgentRunner.ts`.
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
- During the per-agent ReAct loop in `service/aiAgentRunner.ts`, the **final iteration** uses the client's `completeStream()` (returned by `createLLMClient`) instead of `complete()`. Earlier iterations (tool-calling rounds) still use non-streaming `complete()` because full responses are needed to parse tool calls.
- Stream events (`AIStreamEvent`) flow: provider module -> `LLMClient` (factory output) -> `service/aiAgentRunner` -> `AIOrchestrator` -> `AIService` -> page subscriber.
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

- AI output is rendered through `renderMarkdown()` in `shared/utils/format/markdown.ts`.
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
