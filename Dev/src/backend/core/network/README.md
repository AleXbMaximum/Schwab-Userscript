# Backend Core Network

## Purpose

`backend/core/network/` owns external transport, protocol handling, parser normalization, and the chart-data abstraction used by both backend services and frontend consumers.

## Owns

- Schwab REST and WebSocket adapters under `schwab/`
- Yahoo and Barron's fetchers
- LLM client transport (factory + per-provider modules)
- parser and normalization boundaries
- `ChartDataService`

## Does Not Own

- polling cadence and orchestration
- IndexedDB schema design
- page-level presentation or UI fallback behavior

## Subdirectory Map

| Subdir | Purpose |
| --- | --- |
| `schwab/SchwabNetworkSource.ts` | top-level adapter facade for the holdings pipeline |
| `schwab/streamer.ts` + `schwab/streamer/` | WebSocket streamer (top-level entry; `streamer/fieldMaps.ts` holds numeric → name maps) |
| `schwab/endpoints/` | per-endpoint REST callers: `balances.ts`, `holdings.ts`, `quotes.ts`, `options.ts`, `news.ts`, `marketData.ts`, `calendar.ts`, `indicesHistory.ts`, `symbol_quotes_history.ts` |
| `schwab/infra/` | shared transport infra: `auth.ts`, `httpUtils.ts` (incl. `withTokenRefresh`), `initContext.ts` |
| `schwab/parsing/` | normalizers: `holdingsParser.ts`, `optionsParser.ts`, `quotesParser.ts`, `streamerParser.ts`, `chartNormalizer.ts`, `calendarParser.ts`, `numberParsers.ts` |
| `chart/` | `ChartDataService.ts` and chart-data fan-out |
| `yahoo/` | Yahoo REST adapters and overnight streamer fan-out |
| `barrons/` | Barron's news fetchers split into `BarronsFetcher.ts`, `transport.ts`, `urls.ts`, `extractors.ts`, `types.ts` |
| `llm/` | LLM client; `LLMClient.ts` exposes the `LLMClient` type and the `createLLMClient()` factory, dispatching to `anthropicProvider.ts`, `geminiProvider.ts`, `openaiProvider.ts`; SSE handling in `sseParser.ts` |

## Key Entry Files

- [`schwab/SchwabNetworkSource.ts`](schwab/SchwabNetworkSource.ts)
- [`schwab/infra/auth.ts`](schwab/infra/auth.ts)
- [`schwab/infra/httpUtils.ts`](schwab/infra/httpUtils.ts) - `withTokenRefresh` and shared HTTP helpers
- [`schwab/infra/initContext.ts`](schwab/infra/initContext.ts) - init-context discovery used during boot
- [`schwab/streamer.ts`](schwab/streamer.ts)
- [`chart/ChartDataService.ts`](chart/ChartDataService.ts)
- [`llm/LLMClient.ts`](llm/LLMClient.ts) - `createLLMClient()` factory dispatching to provider modules
- [`barrons/BarronsFetcher.ts`](barrons/BarronsFetcher.ts) - thin coordinator over `transport.ts` / `urls.ts` / `extractors.ts`
- [`network-and-auth.md`](network-and-auth.md)

## Dependency Direction

This directory may depend on browser networking APIs, protocol-specific parsing helpers, and `shared/` types. Downstream consumers in `pipeline/`, `services/`, and selected frontend pages should treat this layer as the normalization boundary.

## Related Topic Docs

- [`network-and-auth.md`](network-and-auth.md)
- [`../db/STORAGE.md`](../db/STORAGE.md)
- [`../../pipeline/holdings-pipeline.md`](../../pipeline/holdings-pipeline.md)
- [`../../../init-workflow.md`](../../../init-workflow.md)

## When Editing Here Also Read

- Read [`../../pipeline/README.md`](../../pipeline/README.md) when changing payload shape or streamer behavior.
- Read [`../../services/README.md`](../../services/README.md) when changing adapter contracts used by AI or news.
- Read [`../../../frontend/ui-and-charting.md`](../../../frontend/ui-and-charting.md) when chart data semantics change.

