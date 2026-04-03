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

- [`db/index.ts`](db/index.ts)
- [`network/index.ts`](network/index.ts)
- [`setting/settingsStorage.ts`](setting/settingsStorage.ts)

## Dependency Direction

`core/` may depend on `shared/`, browser APIs, and external services. Higher backend layers consume `core/`; `core/` should not import from `pipeline/`, `services/`, or `frontend/`.

## Related Topic Docs

- [`../../init-workflow.md`](../../init-workflow.md)
- [`db/STORAGE.md`](db/STORAGE.md)
- [`network/network-and-auth.md`](network/network-and-auth.md)

## When Editing Here Also Read

- Read [`../pipeline/README.md`](../pipeline/README.md) when storage or transport changes affect holdings orchestration.
- Read [`../services/README.md`](../services/README.md) when service-layer consumers depend on the contract you are changing.

