# Frontend Trade Holdings

## Purpose

`frontend/trade_holdings/` owns the Holdings page itself: page shell, holdings-table rendering, mobile layout, and the holdings-page settings panel.

## Owns

- page shell and settings in `page.ts`
- desktop and mobile table presentation in `holding_table/`
- holdings-page formatting helpers
- holdings settings UI in `setting_panel/`

## Does Not Own

- holdings ingestion and dirty tracking
- derived metric calculations
- shared holdings column ownership
- the floating account snapshot widget and the account-history timeline (now in [`../snapshot/`](../snapshot/), a sibling top-level frontend directory)
- the account-history recorder/persistence (now in [`../../backend/pipeline/snapshot/`](../../backend/pipeline/snapshot/), owned by the backend pipeline)

## Key Entry Files

- [`page.ts`](page.ts)
- [`holding_table/controller/TableController.ts`](holding_table/controller/TableController.ts)
- [`holding_table/render/TableReconciler.ts`](holding_table/render/TableReconciler.ts)
- [`holding_table/table/rowValues.ts`](holding_table/table/rowValues.ts)
- [`setting_panel/`](setting_panel/) - holdings-page settings UI composition

## Dependency Direction

The Holdings page consumes derived state from the backend pipeline and shared column/type definitions. UI reconciliation rules live here, but upstream value semantics belong to backend or shared layers.

## Internal Structure

- `holding_table/` owns table orchestration, mobile-card rendering, and the local readme that maps the subsystem.
  See [`holding_table/README.md`](holding_table/README.md) for the internal layer map.
- `holding_table/table/` owns row projection, table-only builder config, warning/derived selectors, and column metadata.
- `holding_table/render/` owns DOM reconciliation, cell rendering, flash behavior, and injected table CSS.
- `setting_panel/` owns holdings-page settings UI composition.

The previous `trade_holdings/snapshot/` subdirectory has been split:

- UI rendering (timeline chart, slide panel, metric DOM, floating snapshot) now lives in [`../snapshot/`](../snapshot/) (`FloatingSnapshot.ts`, `panel/`, `metrics/`, `timeline/`).
- Account-history recording, archive, compaction, and persistence now live in [`../../backend/pipeline/snapshot/`](../../backend/pipeline/snapshot/) (`AccountSnapshotRecorder.ts`, `historyCache.ts`, `historyCompaction.ts`, `historyPersistence.ts`, `historyPoint.ts`).

## Related Topic Docs

- [`../../backend/pipeline/holdings-pipeline.md`](../../backend/pipeline/holdings-pipeline.md)
- [`../ui-and-charting.md`](../ui-and-charting.md)
- [`../../init-workflow.md`](../../init-workflow.md)
- [`holding_table/README.md`](holding_table/README.md)

## When Editing Here Also Read

- Read [`../../backend/pipeline/README.md`](../../backend/pipeline/README.md) before changing row identity, update cadence, or derived fields.
- Read [`../../shared/README.md`](../../shared/README.md) before changing shared holdings columns or cross-layer types.
