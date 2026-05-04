# Backend Core

## Purpose

`backend/core/` contains reusable infrastructure that other backend layers build on: IndexedDB access, external network adapters, and settings persistence helpers.

## Owns

- IndexedDB schema and store classes in `db/`
- transport and parser boundaries in `network/`
- settings storage and validation helpers in `setting/`

## Does Not Own

- holdings orchestration, polling schedules, or phase management
- stateful AI/news workflows
- page-level rendering behavior

## Key Entry Files

- [`db/core/AlexQuantDB.ts`](db/core/AlexQuantDB.ts) - IndexedDB bootstrap entry
- [`db/core/KVStore.ts`](db/core/KVStore.ts) - key-value abstraction
- [`db/core/idbUtils.ts`](db/core/idbUtils.ts) - shared `readTx`/`writeTx`/`writeTxResult`/`txPromise` helpers (adopted across capture, AI, and account stores)
- [`network/schwab/SchwabNetworkSource.ts`](network/schwab/SchwabNetworkSource.ts) - Schwab transport entry
- [`network/types.ts`](network/types.ts) - cross-adapter network types
- [`setting/settingsStorage.ts`](setting/settingsStorage.ts) - storage operator factory
- [`setting/config/`](setting/config/) - state-mapping and storage-config tables

## Dependency Direction

`core/` may depend on `shared/`, browser APIs, and external services. Higher backend layers consume `core/`; `core/` should not import from `pipeline/`, `services/`, or `frontend/`.

## Related Topic Docs

- [`../../init-workflow.md`](../../init-workflow.md)
- [`db/STORAGE.md`](db/STORAGE.md)
- [`network/network-and-auth.md`](network/network-and-auth.md)

## When Editing Here Also Read

- Read [`../pipeline/README.md`](../pipeline/README.md) when storage or transport changes affect holdings orchestration.
- Read [`../services/README.md`](../services/README.md) when service-layer consumers depend on the contract you are changing.

