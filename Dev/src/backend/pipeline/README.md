# Backend Pipeline

## Purpose

`backend/pipeline/` owns holdings-centric runtime orchestration: fetch cadence, ingestion, derived-state rebuilds, event fan-out, phase management, and persistence handoff.

## Owns

- `BackendOrchestrator`
- `HoldingsDataService`
- ingestion and dirty tracking in `ingestion/`
- `EventBus`, `HoldingsFrameEmitter`, and `PollingScheduler`
- bridges for streamer, overnight, and beta integration

## Does Not Own

- raw transport and parser logic
- pure analytics formulas in `backend/computation/`
- page-specific table rendering

## Key Entry Files

- [`BackendOrchestrator.ts`](BackendOrchestrator.ts)
- [`HoldingsDataService.ts`](HoldingsDataService.ts)
- [`ingestion/IngestionCoordinator.ts`](ingestion/IngestionCoordinator.ts)
- [`HoldingsFrameEmitter.ts`](HoldingsFrameEmitter.ts)
- [`PhaseManager.ts`](PhaseManager.ts)

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

