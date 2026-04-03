# Dev/src Source Architecture Guide

## Tooling Root

Run userscript npm commands from `Dev/`. The userscript `package.json`, `package-lock.json`, `webpack.config.js`, `tsconfig.json`, `eslint.config.cjs`, `0header.js`, `node_modules/`, and `.dist/` now live in `Dev/`.

`Dev/src/` is the canonical documentation entrypoint for the application. Read this file first, then follow the task-specific routes below into local `README.md` files and near-source topic docs.

## System Map

```text
AlexQuant.ts
├── backend/   runtime orchestration, transport, persistence, computation
├── frontend/  page renderers, shared UI scaffolding, chart rendering primitives
└── shared/    cross-layer types, table columns, logging, utilities
```

The top-level bootstrap path is:

```text
AlexQuant.ts
  -> frontend/components/DataPipelineCoordinator.ts
  -> backend/pipeline/BackendOrchestrator.ts
  -> frontend/RenderEngine.ts
```

## Reading Routes

| Task | Read Order |
| --- | --- |
| Bootstrap, auth, storage hydration, first paint | [`init-workflow.md`](init-workflow.md) -> [`backend/core/network/network-and-auth.md`](backend/core/network/network-and-auth.md) -> [`backend/core/db/README.md`](backend/core/db/README.md) -> [`frontend/components/README.md`](frontend/components/README.md) |
| Holdings ingestion, incremental updates, table reconciliation | [`backend/pipeline/holdings-pipeline.md`](backend/pipeline/holdings-pipeline.md) -> [`backend/pipeline/README.md`](backend/pipeline/README.md) -> [`frontend/trade_holdings/README.md`](frontend/trade_holdings/README.md) -> [`shared/README.md`](shared/README.md) |
| Network adapters, auth, streamer, parsers, persistence side effects | [`backend/core/network/network-and-auth.md`](backend/core/network/network-and-auth.md) -> [`backend/core/network/README.md`](backend/core/network/README.md) -> [`backend/core/db/STORAGE.md`](backend/core/db/STORAGE.md) |
| AI analysis pipeline and page integration | [`backend/services/ai/ai-workflow.md`](backend/services/ai/ai-workflow.md) -> [`backend/services/ai/README.md`](backend/services/ai/README.md) -> [`frontend/analysis_ai/README.md`](frontend/analysis_ai/README.md) |
| UI design tokens, shared UI builders, chart lifecycle | [`frontend/ui-and-charting.md`](frontend/ui-and-charting.md) -> [`frontend/components/README.md`](frontend/components/README.md) -> page README for the surface being changed |
| IndexedDB schema, KV conventions, monitor snapshots, AI history | [`backend/core/db/STORAGE.md`](backend/core/db/STORAGE.md) -> [`backend/core/db/README.md`](backend/core/db/README.md) -> relevant consumer README |

## Cross-System Rules

- Normalize upstream. Parser and adapter layers own unit conversion, sentinel cleanup, and payload normalization before state reaches the pipeline or UI.
- Treat every `*Pct` field as a ratio in the `0-1` range unless a doc explicitly says otherwise.
- Keep shared contracts in `shared/`. Cross-layer types, holdings column IDs, and logging APIs must not fork between backend and frontend.
- Keep browser-only chart rendering primitives in `frontend/charts/`. Only chart data contracts that truly cross layers belong in `shared/`.
- Fix boundary issues at the owner layer. Do not compensate for transport or schema drift inside page renderers.
- When you change a workflow, invariant, or schema, update the nearest local `README.md`, the owning topic doc, and this index if the navigation changes.

## Local README Map

### Backend

- [`backend/README.md`](backend/README.md)
- [`backend/core/README.md`](backend/core/README.md)
- [`backend/core/db/README.md`](backend/core/db/README.md)
- [`backend/core/network/README.md`](backend/core/network/README.md)
- [`backend/pipeline/README.md`](backend/pipeline/README.md)
- [`backend/computation/README.md`](backend/computation/README.md)
- [`backend/services/README.md`](backend/services/README.md)
- [`backend/services/ai/README.md`](backend/services/ai/README.md)
- [`backend/services/news/README.md`](backend/services/news/README.md)

### Frontend

- [`frontend/README.md`](frontend/README.md)
- [`frontend/components/README.md`](frontend/components/README.md)
- [`frontend/analysis_ai/README.md`](frontend/analysis_ai/README.md)
- [`frontend/analysis_optionFlow/README.md`](frontend/analysis_optionFlow/README.md)
- [`frontend/analysis_options/README.md`](frontend/analysis_options/README.md)
- [`frontend/analysis_visualize/README.md`](frontend/analysis_visualize/README.md)
- [`frontend/trade_holdings/README.md`](frontend/trade_holdings/README.md)
- [`frontend/trade_holdings/holding_table/README.md`](frontend/trade_holdings/holding_table/README.md)
- [`frontend/trade_portfolio/README.md`](frontend/trade_portfolio/README.md)

### Shared

- [`shared/README.md`](shared/README.md)

## Topic Docs

- [`init-workflow.md`](init-workflow.md)
- [`backend/pipeline/holdings-pipeline.md`](backend/pipeline/holdings-pipeline.md)
- [`backend/core/network/network-and-auth.md`](backend/core/network/network-and-auth.md)
- [`frontend/ui-and-charting.md`](frontend/ui-and-charting.md)
- [`backend/services/ai/ai-workflow.md`](backend/services/ai/ai-workflow.md)
- [`backend/core/db/STORAGE.md`](backend/core/db/STORAGE.md)

## Choosing Between A README And A Topic Doc

Create or expand a local `README.md` when a directory is a navigation hub, owns a boundary, or contains multiple collaborating modules. Create or expand a topic doc when the contract crosses directories, spans a lifecycle, or would make the local README hard to scan.
