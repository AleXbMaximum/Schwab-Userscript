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

- [`ai/AIService.ts`](ai/AIService.ts)
- [`ai/AIOrchestrator.ts`](ai/AIOrchestrator.ts)
- [`news/NewsService.ts`](news/NewsService.ts)
- [`news/NewsLifecycleCoordinator.ts`](news/NewsLifecycleCoordinator.ts)

## Dependency Direction

Services consume `backend/core/` infrastructure and `shared/` types, then expose higher-level runtime behavior to frontend pages and orchestration layers.

## Related Topic Docs

- [`ai/ai-workflow.md`](ai/ai-workflow.md)
- [`../core/network/network-and-auth.md`](../core/network/network-and-auth.md)
- [`../core/db/STORAGE.md`](../core/db/STORAGE.md)

## When Editing Here Also Read

- Read [`ai/README.md`](ai/README.md) or [`news/README.md`](news/README.md) for the local service boundary.
- Read the consuming frontend page README when changing output shape or lifecycle expectations.

