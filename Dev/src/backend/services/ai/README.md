# Backend Services AI

## Purpose

`backend/services/ai/` owns the multi-agent analysis workflow, its runtime coordination, provider configuration, prompts, data-preparation helpers, and persistence-facing orchestration.

## Owns

- `AIService` session lifecycle
- `AIOrchestrator` stage execution
- prompt templates and tool-calling policy
- provider/model configuration
- AI-specific data fetch, formatting, parsing, and reporting helpers

## Does Not Own

- LLM transport primitives in `backend/core/network/llm/`
- IndexedDB store class implementations in `backend/core/db/ai/`
- page-level UI composition in `frontend/analysis_ai/`

## Key Entry Files

- [`AIService.ts`](AIService.ts)
- [`AIOrchestrator.ts`](AIOrchestrator.ts)
- [`types.ts`](types.ts)
- [`config/AIConfigStore.ts`](config/AIConfigStore.ts)
- [`config/getAIProviders.ts`](config/getAIProviders.ts)
- [`pipeline/DataFetcher.ts`](pipeline/DataFetcher.ts)
- [`ai-workflow.md`](ai-workflow.md)

## Dependency Direction

The AI service layer depends on core network/db primitives and `shared/` types. Frontend AI pages should consume the service contract rather than reaching into lower-level provider or store details.

## Related Topic Docs

- [`ai-workflow.md`](ai-workflow.md)
- [`../../core/network/network-and-auth.md`](../../core/network/network-and-auth.md)
- [`../../core/db/STORAGE.md`](../../core/db/STORAGE.md)

## When Editing Here Also Read

- Read [`../../../frontend/analysis_ai/README.md`](../../../frontend/analysis_ai/README.md) before changing stage shape, settings, or history behavior.
- Read [`../../core/network/README.md`](../../core/network/README.md) when provider transport or timeout behavior changes.

