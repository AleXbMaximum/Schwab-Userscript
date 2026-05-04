# Backend Pipeline

## Purpose

`backend/pipeline/` owns holdings-centric runtime orchestration: fetch cadence, ingestion, derived-state rebuilds, event fan-out, phase management, and persistence handoff.

## Owns

- `BackendOrchestrator` and supporting orchestration helpers (in `orchestration/`)
- `HoldingsDataService`
- ingestion and dirty tracking in `ingestion/`
- `HoldingsFrameEmitter` (top-level)
- account-history snapshot recording in `snapshot/`
- pipeline-state persistence in `persistence/`
- bridges for streamer and overnight integration in `bridges/`
- benchmark wiring in `beta/` and the per-symbol index in `indexSymbols.ts`

## Does Not Own

- raw transport and parser logic
- pure analytics formulas in `backend/computation/`
- page-specific table rendering

## Subdirectory Map

| Subdir | Purpose |
| --- | --- |
| `orchestration/` | runtime composition: `BackendOrchestrator.ts`, `EventBus.ts`, `PhaseManager.ts`, `PollingScheduler.ts`, `pollingOrchestrator.ts`, `settingsRouter.ts`, `sourceOverrideManager.ts`, `DerivedStatePipeline.ts`, `backendOrchestratorTypes.ts` |
| `ingestion/` | raw ingestion + dirty tracking: `DataIngestion.ts`, `IngestionCoordinator.ts`, `streamerIngestion.ts` (extracted from `DataIngestion`), `HoldingsIndexBuilder.ts`, `SentinelNormalizer.ts`, `FieldMergePolicy.ts`, `holdingsIndexTypes.ts` |
| `bridges/` | `StreamerBridge.ts` (Schwab streamer lifecycle), `OvernightBridge.ts` (Yahoo overnight) |
| `snapshot/` | account history: `AccountSnapshotRecorder.ts`, `historyCache.ts`, `historyCompaction.ts`, `historyPersistence.ts`, `historyPoint.ts` |
| `persistence/` | `PipelineStatePersistor.ts` |
| `beta/` | beta integration glue used by the orchestrator |
| (root) | `HoldingsDataService.ts`, `HoldingsFrameEmitter.ts`, `InMemoryStateRepository.ts`, `indexSymbols.ts`, this README, `holdings-pipeline.md` |

## Key Entry Files

- [`orchestration/BackendOrchestrator.ts`](orchestration/BackendOrchestrator.ts)
- [`HoldingsDataService.ts`](HoldingsDataService.ts)
- [`ingestion/IngestionCoordinator.ts`](ingestion/IngestionCoordinator.ts)
- [`ingestion/streamerIngestion.ts`](ingestion/streamerIngestion.ts)
- [`HoldingsFrameEmitter.ts`](HoldingsFrameEmitter.ts)
- [`orchestration/PhaseManager.ts`](orchestration/PhaseManager.ts)
- [`orchestration/DerivedStatePipeline.ts`](orchestration/DerivedStatePipeline.ts)
- [`snapshot/AccountSnapshotRecorder.ts`](snapshot/AccountSnapshotRecorder.ts)
- [`persistence/PipelineStatePersistor.ts`](persistence/PipelineStatePersistor.ts)

## Dependency Direction

`pipeline/` consumes normalized data from `backend/core/network/`, delegates calculations to `backend/computation/`, persists through `backend/core/db/`, and emits derived state to frontend consumers.

## Related Topic Docs

- [`holdings-pipeline.md`](holdings-pipeline.md)
- [`../core/network/network-and-auth.md`](../core/network/network-and-auth.md)
- [`../core/db/STORAGE.md`](../core/db/STORAGE.md)
- [`../../init-workflow.md`](../../init-workflow.md)

## When Editing Here Also Read

- Read [`holdings-pipeline.md`](holdings-pipeline.md) before changing ingestion, dirty tracking, or table-facing state shape.
- Read [`../../frontend/trade_holdings/README.md`](../../frontend/trade_holdings/README.md) when a pipeline change affects reconciliation or visible holdings fields.
- Read [`../computation/README.md`](../computation/README.md) when derived metric ownership might move across layers.

