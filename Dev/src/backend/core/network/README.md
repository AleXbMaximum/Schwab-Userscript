# Backend Core Network

## Purpose

`backend/core/network/` owns external transport, protocol handling, parser normalization, and the chart-data abstraction used by both backend services and frontend consumers.

## Owns

- Schwab REST and WebSocket adapters
- Yahoo and Barron's fetchers
- LLM client transport
- parser and normalization boundaries
- `ChartDataService`

## Does Not Own

- polling cadence and orchestration
- IndexedDB schema design
- page-level presentation or UI fallback behavior

## Key Entry Files

- [`schwab/SchwabNetworkSource.ts`](schwab/SchwabNetworkSource.ts)
- [`schwab/auth.ts`](schwab/auth.ts)
- [`chart/ChartDataService.ts`](chart/ChartDataService.ts)
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

