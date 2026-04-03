# Backend Services News

## Purpose

`backend/services/news/` owns news-source polling, symbol scoping, tagging, summarization, and lifecycle coordination independent of any single page render.

## Owns

- `NewsService` state and polling cadence
- `NewsLifecycleCoordinator`
- source fan-out in `newsFetchers.ts`
- summarization and tagging helpers
- news memory persistence glue

## Does Not Own

- core HTTP transport primitives
- page layout or news page UI filters
- holdings ingestion

## Key Entry Files

- [`NewsService.ts`](NewsService.ts)
- [`NewsLifecycleCoordinator.ts`](NewsLifecycleCoordinator.ts)
- [`newsFetchers.ts`](newsFetchers.ts)
- [`NewsSummarizer.ts`](NewsSummarizer.ts)
- [`types.ts`](types.ts)

## Dependency Direction

This service consumes core network and DB primitives, then pushes normalized news items to frontend consumers and optional AI enrichment helpers.

## Related Topic Docs

- [`../../core/network/network-and-auth.md`](../../core/network/network-and-auth.md)
- [`../../core/db/STORAGE.md`](../../core/db/STORAGE.md)

## When Editing Here Also Read

- Read [`../../../frontend/README.md`](../../../frontend/README.md) for page-level consumers.
- Read [`../ai/README.md`](../ai/README.md) when changing summarization hooks that overlap with AI configuration or providers.

