# Frontend Analysis — Option Flow

## Purpose

`frontend/analysis_optionFlow/` owns the option flow monitor dashboard page, including the local dashboard store, settings UI, chart surfaces, and signal presentation over monitor data.

## Owns

- page layout and lifecycle in `page.ts`
- monitor runtime in `monitor/` (`MonitorController.ts`, `monitorCapture.ts`, `monitorRuntime.ts`, `monitorScheduler.ts`, `monitorSettings.ts`, `monitorFetchPipeline.ts`, `monitorUniverse.ts`)
- dashboard query and local state in `data/queryEngine.ts`, `data/monitorHistory.ts`, and `store.ts`
- option flow charts in `components/charts/`, heatmaps in `components/heatmaps/`, and supporting panels (`SignalPanel.ts`, `IVCorrelation.ts`, `ControlBar.ts`, `ZoneControlBar.ts`, `chartData.ts`, `chartProfiles.ts`)
- signal engine in `signals/` (`signalEngine.ts`, `types.ts`)
- monitor settings UI in `setting_panel/` (`settingsPanel.ts`, `flowPageSetting.ts`, `monitoredTickers_infoPanel.ts`, `TickerGridManager.ts`, `DatabaseInfoModal.ts`)

## Does Not Own

- IndexedDB schema for monitor stores (lives in `backend/core/db/capture/`)
- options ETL or label backfill ownership (lives in `backend/computation/options/monitor/`)
- transport-level options fetching

## Key Entry Files

- [`page.ts`](page.ts)
- [`store.ts`](store.ts)
- [`monitor/MonitorController.ts`](monitor/MonitorController.ts)
- [`monitor/monitorCapture.ts`](monitor/monitorCapture.ts) - includes the inlined `buildMetaRow` (former `MetaETL`)
- [`monitor/monitorScheduler.ts`](monitor/monitorScheduler.ts) - writes `monitor.lastCycleAt` to KV
- [`monitor/monitorSettings.ts`](monitor/monitorSettings.ts) - writes `monitor.settings` to KV
- [`data/queryEngine.ts`](data/queryEngine.ts)
- [`signals/signalEngine.ts`](signals/signalEngine.ts)

## Dependency Direction

This page depends on monitor storage, backend data contracts, and frontend chart primitives. Avoid moving ETL or persistence rules into page-local code.

## Related Topic Docs

- [`../ui-and-charting.md`](../ui-and-charting.md)
- [`../../backend/core/db/STORAGE.md`](../../backend/core/db/STORAGE.md)
- [`../../backend/core/network/network-and-auth.md`](../../backend/core/network/network-and-auth.md)

## When Editing Here Also Read

- Read [`../../backend/core/db/README.md`](../../backend/core/db/README.md) before changing monitor snapshot read or write expectations.
- Read [`../analysis_options/README.md`](../analysis_options/README.md) when changing shared option-monitor concepts.
