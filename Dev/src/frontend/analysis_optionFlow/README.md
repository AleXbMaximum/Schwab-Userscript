# Frontend Analysis — Option Flow

## Purpose

`frontend/analysis_optionFlow/` owns the option flow monitor dashboard page, including the local dashboard store, settings UI, chart surfaces, and signal presentation over monitor data.

## Owns

- page layout and lifecycle in `page.ts`
- monitor-page integration in `monitor/MonitorController.ts`, `monitor/monitorCapture.ts`, and `monitor/monitorUniverse.ts`
- dashboard query and local state in `data/queryEngine.ts` and `store.ts`
- option flow charts, heatmaps, and signal panels

## Does Not Own

- IndexedDB schema for monitor stores
- options ETL or label backfill ownership
- transport-level options fetching

## Key Entry Files

- [`page.ts`](page.ts)
- [`store.ts`](store.ts)
- [`monitor/MonitorController.ts`](monitor/MonitorController.ts)
- [`monitor/monitorCapture.ts`](monitor/monitorCapture.ts)
- [`data/queryEngine.ts`](data/queryEngine.ts)

## Dependency Direction

This page depends on monitor storage, backend data contracts, and frontend chart primitives. Avoid moving ETL or persistence rules into page-local code.

## Related Topic Docs

- [`../ui-and-charting.md`](../ui-and-charting.md)
- [`../../backend/core/db/STORAGE.md`](../../backend/core/db/STORAGE.md)
- [`../../backend/core/network/network-and-auth.md`](../../backend/core/network/network-and-auth.md)

## When Editing Here Also Read

- Read [`../../backend/core/db/README.md`](../../backend/core/db/README.md) before changing monitor snapshot read or write expectations.
- Read [`../analysis_options/README.md`](../analysis_options/README.md) when changing shared option-monitor concepts.
