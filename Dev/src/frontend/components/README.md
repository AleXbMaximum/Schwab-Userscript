# Frontend Components

## Purpose

`frontend/components/` contains shared UI primitives and composition glue used by multiple pages, including the design system, layout shell, header rendering, floating snapshot, and company-detail utilities.

## Owns

- design tokens and builders in `core/`
- main layout shell in `mainContainer/`
- backend adapter glue in `DataPipelineCoordinator.ts`
- header widgets and status rendering in `header/`
- floating snapshot widgets in `snapshot/`

## Does Not Own

- page-specific business workflows
- backend orchestration ownership
- chart rendering primitives in `../charts/`
- shared type definitions

## Key Entry Files

- [`core/theme.ts`](core/theme.ts)
- [`core/ui_builders.ts`](core/ui_builders.ts)
- [`core/settingsFramework.ts`](core/settingsFramework.ts)
- [`DataPipelineCoordinator.ts`](DataPipelineCoordinator.ts)
- [`header/HeaderRenderer.ts`](header/HeaderRenderer.ts)

## Dependency Direction

Shared components may depend on `shared/` and narrow backend-facing APIs, but page modules should depend on components rather than duplicating design-system or layout logic locally.

## Related Topic Docs

- [`../ui-and-charting.md`](../ui-and-charting.md)
- [`../../init-workflow.md`](../../init-workflow.md)
- [`../../backend/pipeline/holdings-pipeline.md`](../../backend/pipeline/holdings-pipeline.md)

## When Editing Here Also Read

- Read [`../README.md`](../README.md) for page ownership boundaries.
- Read [`../../shared/README.md`](../../shared/README.md) before changing shared contracts or logging primitives consumed here.
- Read [`../ui-and-charting.md`](../ui-and-charting.md) before changing how components interact with shared chart rendering primitives.
