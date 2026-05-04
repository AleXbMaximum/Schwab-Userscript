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

- [`AIService.ts`](AIService.ts) - application-wide singleton, session lifecycle, stream/progress fan-out
- [`AIOrchestrator.ts`](AIOrchestrator.ts) - thin coordinator over the `service/` phase modules
- [`types.ts`](types.ts)
- [`config/AIConfigStore.ts`](config/AIConfigStore.ts) - KV-backed provider/model config; exports `DEFAULT_PROVIDERS`, `DEFAULT_AGENT_MODELS`, `DEFAULT_PIPELINE`, `DEFAULT_GENERAL`, and the top-level `getAIProviders()` accessor (formerly in a separate file)
- [`config/clientConfigFactory.ts`](config/clientConfigFactory.ts), [`config/modelCatalog.ts`](config/modelCatalog.ts), [`config/pricing.ts`](config/pricing.ts), [`config/types.ts`](config/types.ts)
- [`pipeline/DataFetcher.ts`](pipeline/DataFetcher.ts) and [`pipeline/prepareBundle.ts`](pipeline/prepareBundle.ts) - market-data fan-out and bundle preparation
- [`service/aiPhaseAnalysts.ts`](service/aiPhaseAnalysts.ts), [`service/aiPhaseDebate.ts`](service/aiPhaseDebate.ts), [`service/aiAgentRunner.ts`](service/aiAgentRunner.ts) - phase-specific orchestration delegated by `AIOrchestrator`
- [`prompts/prompts.ts`](prompts/prompts.ts) (barrel), [`prompts/intensity.ts`](prompts/intensity.ts), [`prompts/tools.ts`](prompts/tools.ts), and per-agent files under [`prompts/agents/`](prompts/agents/)
- [`tools/toolExecutor.ts`](tools/toolExecutor.ts)
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

