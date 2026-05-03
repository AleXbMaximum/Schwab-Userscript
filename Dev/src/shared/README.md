# Shared

## Purpose

`shared/` contains cross-layer contracts and reusable primitives that must stay consistent between backend and frontend.

## Owns

- shared domain types in `types/`
- logging primitives in `log/`
- general utilities in `utils/`

## Does Not Own

- runtime orchestration
- feature-specific page state
- transport adapters

## Key Entry Files

- [`types/core.ts`](types/core.ts)
- [`types/holdingsTableColumns.ts`](types/holdingsTableColumns.ts)
- [`types/marketData.ts`](types/marketData.ts)
- [`log/core/LogService.ts`](log/core/LogService.ts)
- [`utils/formatters.ts`](utils/formatters.ts)
- [`utils/time.ts`](utils/time.ts)

## Dependency Direction

`shared/` is imported by both backend and frontend and should stay acyclic. If a contract belongs to more than one layer, it belongs here instead of in a feature directory. Browser-only chart rendering helpers belong in `frontend/charts/`.

## Related Topic Docs

- [`../frontend/ui-and-charting.md`](../frontend/ui-and-charting.md)
- [`../backend/pipeline/holdings-pipeline.md`](../backend/pipeline/holdings-pipeline.md)
- [`../init-workflow.md`](../init-workflow.md)

## When Editing Here Also Read

- Read the nearest consumer README before changing a shared type or helper.
- Read [`../backend/core/db/STORAGE.md`](../backend/core/db/STORAGE.md) when a shared type is persisted.
