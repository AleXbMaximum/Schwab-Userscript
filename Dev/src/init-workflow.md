# Initialization Workflow

## Scope

This document covers application startup from userscript entry in [`AlexQuant.ts`](AlexQuant.ts) through the first rendered page and the deferred background services that come online after first paint.

## Owner Directory

`Dev/src/`

## Recommended Read Order

1. [`README.md`](README.md)
2. [`AlexQuant.ts`](AlexQuant.ts)
3. [`backend/core/network/network-and-auth.md`](backend/core/network/network-and-auth.md)
4. [`backend/core/db/README.md`](backend/core/db/README.md)
5. [`frontend/components/README.md`](frontend/components/README.md)

## Key Files

- [`AlexQuant.ts`](AlexQuant.ts) - bootstrap sequence and lifecycle wiring
- [`frontend/components/DataPipelineCoordinator.ts`](frontend/components/DataPipelineCoordinator.ts) - thin frontend adapter over backend orchestration
- [`backend/pipeline/BackendOrchestrator.ts`](backend/pipeline/BackendOrchestrator.ts) - runtime service composition root
- [`frontend/RenderEngine.ts`](frontend/RenderEngine.ts) - page switching and rerender entrypoint

## Five-Phase Lifecycle

| Phase | Primary Goal | Main Work |
| --- | --- | --- |
| 1. Parallel prerequisites | unblock first useful render | inject global styles, start `fetchAuthToken()`, open IndexedDB, wait for DOM readiness, wait for page init context |
| 2. Storage hydration | load persisted settings and state | build the storage operator, set token scope, load persisted settings, sync settings into render state |
| 3. UI skeleton and controllers | create stable runtime shells | build the main container, create `DataPipelineCoordinator`, create `RenderEngine`, register auth listeners, preload monitor controller |
| 4. First useful render | show the initial Holdings view | await auth token, set auth state, resolve account info, start header renderer, render `HOLDINGS` |
| 5. Deferred background features | start non-critical services after first paint | connect streamer, start auth auto-refresh, start snapshot recorder, create floating snapshot, finish monitor startup |

## End-to-End Flow

```text
userscript load
  -> guard against duplicate initialization
  -> install log tooling and global CSS
  -> begin auth + DB + DOM + init-context waits in parallel
  -> hydrate storage-backed settings
  -> create UI shell, coordinator, render engine, and lifecycle listeners
  -> resolve auth/account context
  -> render Holdings
  -> start deferred background services
```

## Critical Invariants

- Startup must remain idempotent. `window.__SCHWABER_INITIALIZED__` prevents duplicate userscript bootstraps.
- Auth, DB, DOM, and init-context discovery are intentionally parallelized. Do not serialize them unless the dependency graph changes.
- `DataPipelineCoordinator` is the frontend boundary. UI startup should not instantiate backend services directly outside this adapter.
- The first page render must not wait on optional services such as streamer connection, floating snapshot, or monitor ETL warmup.
- Runtime services started in `AlexQuant.ts` must also be stoppable from the same lifecycle surface.

## Related Local Docs

- [`README.md`](README.md)
- [`backend/README.md`](backend/README.md)
- [`frontend/README.md`](frontend/README.md)
- [`frontend/components/README.md`](frontend/components/README.md)
- [`backend/core/network/network-and-auth.md`](backend/core/network/network-and-auth.md)

