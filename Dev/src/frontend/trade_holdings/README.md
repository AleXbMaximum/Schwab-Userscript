# Frontend Trade Holdings

## Purpose

`frontend/trade_holdings/` owns the Holdings page, including the page shell, holdings-table rendering, mobile layout, settings UI, and account snapshot rendering.

## Owns

- page shell and settings in `page.ts`
- desktop and mobile table presentation in `holding_table/`
- account timeline, charting, and history recording in `snapshot/`
- holdings-page formatting helpers

## Does Not Own

- holdings ingestion and dirty tracking
- derived metric calculations
- shared holdings column ownership

## Key Entry Files

- [`page.ts`](page.ts)
- [`holding_table/controller/TableController.ts`](holding_table/controller/TableController.ts)
- [`holding_table/render/TableReconciler.ts`](holding_table/render/TableReconciler.ts)
- [`holding_table/table/rowValues.ts`](holding_table/table/rowValues.ts)
- [`snapshot/accountTimeline.ts`](snapshot/accountTimeline.ts)
- [`snapshot/AccountSnapshotRecorder.ts`](snapshot/AccountSnapshotRecorder.ts)

## Dependency Direction

The Holdings page consumes derived state from the backend pipeline and shared column/type definitions. UI reconciliation rules live here, but upstream value semantics belong to backend or shared layers.

## Internal Structure

- `holding_table/` owns table orchestration, mobile-card rendering, and the local readme that maps the subsystem.
  See [`holding_table/README.md`](holding_table/README.md) for the internal layer map.
- `holding_table/table/` owns row projection, table-only builder config, warning/derived selectors, and column metadata.
- `holding_table/render/` owns DOM reconciliation, cell rendering, flash behavior, and injected table CSS.
- `snapshot/` owns account history persistence, timeline chart rendering, stitched time-axis helpers, and snapshot runtime preferences.
- `setting_panel/` owns holdings-page settings UI composition.

## Related Topic Docs

- [`../../backend/pipeline/holdings-pipeline.md`](../../backend/pipeline/holdings-pipeline.md)
- [`../ui-and-charting.md`](../ui-and-charting.md)
- [`../../init-workflow.md`](../../init-workflow.md)
- [`holding_table/README.md`](holding_table/README.md)

## When Editing Here Also Read

- Read [`../../backend/pipeline/README.md`](../../backend/pipeline/README.md) before changing row identity, update cadence, or derived fields.
- Read [`../../shared/README.md`](../../shared/README.md) before changing shared holdings columns or cross-layer types.
