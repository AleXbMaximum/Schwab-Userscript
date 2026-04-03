# Holdings Pipeline

## Scope

This document covers the end-to-end Holdings data path from upstream fetches and streamer updates through derived-state rebuilds and Holdings page reconciliation.

## Owner Directory

`Dev/src/backend/pipeline/`

## Recommended Read Order

1. [`../../README.md`](../../README.md)
2. [`README.md`](README.md)
3. [`../core/network/network-and-auth.md`](../core/network/network-and-auth.md)
4. [`../../frontend/trade_holdings/README.md`](../../frontend/trade_holdings/README.md)
5. [`../../shared/README.md`](../../shared/README.md)

## Key Files

- [`BackendOrchestrator.ts`](BackendOrchestrator.ts)
- [`HoldingsDataService.ts`](HoldingsDataService.ts)
- [`ingestion/IngestionCoordinator.ts`](ingestion/IngestionCoordinator.ts)
- [`DerivedStatePipeline.ts`](DerivedStatePipeline.ts)
- [`HoldingsFrameEmitter.ts`](HoldingsFrameEmitter.ts)
- [`../../frontend/trade_holdings/holding_table/controller/TableController.ts`](../../frontend/trade_holdings/holding_table/controller/TableController.ts)

## End-to-End Flow

```text
Holdings API -----> DataIngestion -----------\
Quotes API   -----> mergeQuoteIntoRow --------> DerivedStatePipeline -> HoldingsFrameEmitter -> EventBus -> Holdings UI
Streamer WS  -----> streamer ingestion ------/
Yahoo chart  -----> BetaService ----------------------------------------------/
Settings     -----> warnings and view config --------------------------------/
```

## Runtime Composition

`AlexQuant.ts` creates `DataPipelineCoordinator`, which owns a `BackendOrchestrator`. The orchestrator composes:

- `HoldingsDataService` for ingestion, derived-state rebuilds, and holdings frame emission
- `PollingScheduler` for holdings, quotes, balances, and beta cadence
- `BetaManager` and `BetaService` for benchmark enrichment
- `StreamerBridge` for Schwab streamer lifecycle
- `OvernightBridge` for Yahoo overnight updates
- `NewsLifecycleCoordinator` for symbol-scoped news lifecycle

## Pipeline Stages

### 1. Startup Wiring

- `BackendOrchestrator.start()` wires subscriptions before fetching so the first holdings frame is not lost.
- `DataPipelineCoordinator` is a thin UI adapter. It forwards holdings frames and balances to `HeaderRenderer` and page listeners.
- `start()` and `stop()` are intended to be idempotent at both coordinator and orchestrator layers.

### 2. Polling And Push Updates

- Holdings, quotes, balances, and beta fetches are scheduled through `PollingScheduler`.
- Real-time push updates flow through `StreamerBridge` into `HoldingsDataService.ingestStreamerUpdates`.
- Overnight updates flow through `OvernightBridge` into dedicated overnight fields rather than overwriting the normal quote surface.

### 3. Raw Ingestion And Dirty Tracking

- `ingestion/DataIngestion.ts` and `ingestion/IngestionCoordinator.ts` own raw holdings state and touched-key tracking.
- Full holdings ingests mark the pipeline for a full rebuild.
- Streamer and overnight ingests track touched holdings and touched underlyings so downstream work can remain incremental when safe.
- `IngestionCoordinator` caches symbol and holdings indexes so incremental updates do not rebuild lookup maps unnecessarily.

### 4. Derived State And Hierarchy

- `DerivedStatePipeline.ts` coordinates derived calculations and hierarchy rebuilds.
- `backend/computation/holdings/` owns derived metrics, aggregations, hierarchy rows, and warnings.
- Incremental rebuilds recompute only affected holdings and underlyings, then refresh aggregate context.
- `BetaManager` enriches derived state with benchmark and factor data after the core holdings rebuild.

### 5. Holdings Frame Emission

- `HoldingsFrameEmitter.ts` wakes on dirty signals instead of tight idle polling.
- Emission is rate-limited by `refreshIntervalMs`, decoupling raw update frequency from UI repaint frequency.
- `BackendOrchestrator` replays the latest holdings frame to late subscribers through `EventBus`.

### 6. Holdings Page Reconciliation

- `frontend/trade_holdings/holding_table/controller/TableController.ts` orchestrates table updates.
- `holding_table/render/TableReconciler.ts`, `holding_table/utils/CellDiffer.ts`, and `holding_table/render/FlashAnimator.ts` own DOM-level reconciliation and cell flash behavior.
- When sort state and expansion state stay stable, row rebuilds can remain incremental based on touched underlyings.

## Phase Model

`PhaseManager` divides runtime behavior into market, after-hours, pre-market, overnight, and closed phases.

| Phase | Holdings Fetch | Schwab Streamer | Polling | Yahoo Overnight |
| --- | --- | --- | --- | --- |
| market | regular session fetches | enabled | active | off |
| afterHours | dual regular plus extended fetches | disabled | active | off |
| preMarket | dual regular plus extended fetches | disabled | active | off |
| overnight | warmup fetch once on entry | disabled | paused after warmup | active |
| closed | none | disabled | paused | off |

Phase evaluation uses boundary-aligned scheduling (`msUntilNextBoundary`) instead of a flat 60-second interval. A self-rescheduling `setTimeout` chain sleeps until the next CT boundary, with a `visibilitychange` listener for tab-focus recovery after browser background throttling.

The phase model is coordinated with [`../core/network/network-and-auth.md`](../core/network/network-and-auth.md), especially for streamer enablement, overnight warmup, and quote-source clamping.

## Cross-Cutting Conventions

- Percent fields use ratio semantics (`0.052` means `5.2%`).
- Row identity is keyed through stable group, parent, and child row keys. Reconciliation depends on these keys remaining stable.
- Extended-hours and overnight fields are distinct surfaces. Do not collapse them into one set of display values without updating both pipeline and UI docs.

## Critical Invariants

- Parser and adapter normalization must happen before data reaches ingestion logic.
- Incremental rebuild safety is more important than avoiding a full rebuild. If touched-key coverage is uncertain, rebuild fully.
- Streamer and overnight flows must not silently overwrite dedicated after-hours or overnight fields.
- Table reconciliation assumes stable row keys and consistent column IDs from `shared/holdingsTableColumns.ts`.

## Related Local Docs

- [`README.md`](README.md)
- [`../README.md`](../README.md)
- [`../core/network/network-and-auth.md`](../core/network/network-and-auth.md)
- [`../../frontend/trade_holdings/README.md`](../../frontend/trade_holdings/README.md)
- [`../../shared/README.md`](../../shared/README.md)
