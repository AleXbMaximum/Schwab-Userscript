# Backend Services

## Purpose

`backend/services/` contains stateful domain services that are not part of the core holdings ingestion loop. The current service domains are AI analysis and news aggregation.

## Owns

- AI orchestration, prompt pipelines, model config, and analysis persistence coordination
- news polling, tagging, summarization, symbol scoping, and memory integration

## Does Not Own

- low-level transport clients
- IndexedDB schema primitives
- holdings pipeline orchestration

## Key Entry Files

- [`ai/AIService.ts`](ai/AIService.ts) - session lifecycle façade
- [`ai/AIOrchestrator.ts`](ai/AIOrchestrator.ts) - thin coordinator that delegates phase logic to `service/aiPhaseAnalysts.ts`, `service/aiPhaseDebate.ts`, and `service/aiAgentRunner.ts`
- [`ai/config/AIConfigStore.ts`](ai/config/AIConfigStore.ts) - provider/model defaults plus the `getAIProviders()` accessor (the previous standalone `config/getAIProviders.ts` was merged in)
- [`ai/pipeline/`](ai/pipeline/) - data-prep helpers (`DataFetcher.ts`, `prepareBundle.ts`, plus formatters/parsers/summarizers/technicals/contextBuilders/dataPreprocessing/reportBuilder)
- [`ai/prompts/`](ai/prompts/) - `prompts.ts` barrel, `intensity.ts`, `tools.ts`, and per-agent prompts under `prompts/agents/`
- [`ai/tools/toolExecutor.ts`](ai/tools/toolExecutor.ts) - tool-call dispatch
- [`news/NewsService.ts`](news/NewsService.ts)
- [`news/NewsLifecycleCoordinator.ts`](news/NewsLifecycleCoordinator.ts)
- [`news/newsFetchHelpers.ts`](news/newsFetchHelpers.ts) and [`news/newsItemHelpers.ts`](news/newsItemHelpers.ts) - extracted helpers
- [`news/NewsTagging.ts`](news/NewsTagging.ts), [`news/NewsSummarizer.ts`](news/NewsSummarizer.ts), [`news/NewsMemoryStore.ts`](news/NewsMemoryStore.ts)

## Dependency Direction

Services consume `backend/core/` infrastructure and `shared/` types, then expose higher-level runtime behavior to frontend pages and orchestration layers.

## Related Topic Docs

- [`ai/ai-workflow.md`](ai/ai-workflow.md)
- [`../core/network/network-and-auth.md`](../core/network/network-and-auth.md)
- [`../core/db/STORAGE.md`](../core/db/STORAGE.md)

## When Editing Here Also Read

- Read [`ai/README.md`](ai/README.md) or [`news/README.md`](news/README.md) for the local service boundary.
- Read the consuming frontend page README when changing output shape or lifecycle expectations.

