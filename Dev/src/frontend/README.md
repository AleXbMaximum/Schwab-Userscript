# Frontend

## Purpose

`frontend/` owns page renderers, shared UI scaffolding, chart rendering primitives, settings panels, and local presentation state. It is the UI boundary over backend orchestration and shared contracts.

## Owns

- page switching in `RenderEngine.ts`
- feature pages under `analysis_*`, `trade_*`, and `news_page/`
- shared chart rendering primitives in `charts/`
- shared UI building blocks in `components/`

## Does Not Own

- transport, orchestration, or persistence ownership in `backend/`
- cross-layer type definitions that belong in `shared/`

## Key Entry Files

- [`RenderEngine.ts`](RenderEngine.ts)
- [`charts/ChartManager.ts`](charts/ChartManager.ts)
- [`charts/chartPanel.ts`](charts/chartPanel.ts)
- [`components/DataPipelineCoordinator.ts`](components/DataPipelineCoordinator.ts)
- page entry files such as [`trade_holdings/page.ts`](trade_holdings/page.ts) and [`analysis_ai/page.ts`](analysis_ai/page.ts)

## Dependency Direction

Pages consume `shared/` contracts and selected backend public APIs. Shared components and chart primitives sit below pages. Keep ownership of business rules in backend or shared layers unless the rule is presentation-only.

## Related Topic Docs

- [`../init-workflow.md`](../init-workflow.md)
- [`ui-and-charting.md`](ui-and-charting.md)
- [`../backend/pipeline/holdings-pipeline.md`](../backend/pipeline/holdings-pipeline.md)
- [`../backend/services/ai/ai-workflow.md`](../backend/services/ai/ai-workflow.md)

## When Editing Here Also Read

- Read [`components/README.md`](components/README.md) for shared UI conventions before adding new patterns.
- Read the owning page README before changing a local page contract.
- `news_page/` is intentionally covered by this file in the first pass; add a page-local README only if it develops a non-obvious contract.
