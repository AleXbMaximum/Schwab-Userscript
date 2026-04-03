# Holding Table

## Purpose

`frontend/trade_holdings/holding_table/` owns the Holdings page table runtime: row projection, derived-value display formatting, DOM reconciliation, column/header behavior, and intraday sparklines.

## Public Surface

- [`controller/TableController.ts`](controller/TableController.ts) is the orchestration entrypoint consumed by the Holdings page.
- [`mobileCardView.ts`](mobileCardView.ts) owns the mobile-card alternative view.
- [`types.ts`](types.ts) owns table-local shared types such as `RowRenderData`, `SortState`, and `TableActionsConfig`.

## Internal Layers

- `controller/` owns `TableController` orchestration, header interaction wiring, and summary-row action-cell composition.
- `formatting/` converts holdings rows and aggregate totals into display strings.
- `table/` owns table-specific projection logic: virtual-row builders, row factories, column metadata, warning/derived selectors, and table-only builder config.
- `render/` owns DOM patching, sticky-cell treatment, cell-level rendering, and injected table CSS.
- `sparkline/` owns intraday sparkline storage and canvas drawing.
- `utils/` owns low-level primitives such as width calculation, row keys, value access, and diffing.

## Dependency Direction

- `types.ts` is the shared contract surface for table-local models.
- `table/` and `formatting/` may depend on `types.ts`, shared utilities, and upstream holdings data, but must not depend on `render/`.
- `render/` consumes `RowRenderData`; it does not define row-model contracts.
- `controller/` composes `table/`, `render/`, `sparkline/`, and `utils/`, but should avoid embedding row-projection logic inline.
- Root facade files should stay thin. New subsystem logic should live in the nearest internal layer instead of returning to the root.

## Read Order

1. [`controller/TableController.ts`](controller/TableController.ts)
2. [`table/buildVirtualRows.ts`](table/buildVirtualRows.ts)
3. [`table/rowFactories.ts`](table/rowFactories.ts)
4. [`formatting/holdingsRowFormatter.ts`](formatting/holdingsRowFormatter.ts)
5. [`render/TableReconciler.ts`](render/TableReconciler.ts)
6. [`render/tableStyles.ts`](render/tableStyles.ts)
7. [`sparkline/IntradaySparklineStore.ts`](sparkline/IntradaySparklineStore.ts)

## Editing Notes

- Keep row-shape contracts in `types.ts` or `table/`; do not reintroduce them inside `render/`.
- When adding a display-only field, update `table/` and `formatting/` together so summary rows, child rows, and group rows stay aligned.
- When adding visual behavior, prefer `render/` over patching `controller/TableController.ts` directly.
