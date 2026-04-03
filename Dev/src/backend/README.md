# Backend

## Purpose

`backend/` owns the runtime data plane behind the UI: transport adapters, persistence, orchestration, derived calculations, and stateful services.

## Owns

- infrastructure in `core/`
- holdings and event orchestration in `pipeline/`
- pure calculations in `computation/`
- stateful business services in `services/`

## Does Not Own

- DOM rendering or page composition in `frontend/`
- cross-layer primitive ownership already centralized in `shared/`

## Key Entry Files

- [`pipeline/BackendOrchestrator.ts`](pipeline/BackendOrchestrator.ts) - runtime composition root
- [`pipeline/HoldingsDataService.ts`](pipeline/HoldingsDataService.ts) - holdings pipeline core service

## Dependency Direction

`core/` is the lowest backend layer. `pipeline/` and `services/` depend on `core/` and `shared/`. `computation/` stays reusable and side-effect light. Nothing in `backend/` should depend on page modules in `frontend/`.

## Related Topic Docs

- [`../init-workflow.md`](../init-workflow.md)
- [`pipeline/holdings-pipeline.md`](pipeline/holdings-pipeline.md)
- [`core/network/network-and-auth.md`](core/network/network-and-auth.md)
- [`services/ai/ai-workflow.md`](services/ai/ai-workflow.md)
- [`core/db/STORAGE.md`](core/db/STORAGE.md)

## When Editing Here Also Read

- Read [`core/README.md`](core/README.md) before changing transport, storage, or settings boundaries.
- Read [`pipeline/README.md`](pipeline/README.md) before changing holdings orchestration or update cadence.
- Read the relevant frontend README when a backend contract is rendered directly on a page.

