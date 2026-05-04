# Backend Core DB

## Purpose

`backend/core/db/` owns IndexedDB schema definition, store classes, and persistence conventions shared across settings, monitor snapshots, account history, and AI history.

## Owns

- database bootstrapping in `core/AlexQuantDB.ts`
- key-value storage in `core/KVStore.ts`
- account, capture, and AI store classes
- token-scoped versus global key conventions

## Does Not Own

- network fetch scheduling
- render-state reconciliation
- AI orchestration or holdings update logic

## Key Entry Files

- [`core/AlexQuantDB.ts`](core/AlexQuantDB.ts) - IndexedDB schema bootstrap
- [`core/KVStore.ts`](core/KVStore.ts) - key-value abstraction
- [`core/idbUtils.ts`](core/idbUtils.ts) - shared transaction helpers (`readTx`, `writeTx`, `writeTxResult`, `txPromise`); every store class in `account/`, `ai/`, and `capture/` is built on these
- [`core/dbStats.ts`](core/dbStats.ts) - per-store size and row-count probes
- [`STORAGE.md`](STORAGE.md)

## Store Classes

| Subfolder | Stores |
| --- | --- |
| `account/` | `AccountHistoryStore`, `AccountHistoryArchiveStore` (+ `accountHistoryTypes.ts`) |
| `ai/` | `AIAnalysisStore`, `MemoryStore` |
| `capture/` | `MonitorCaptureStore`, `CaptureSnapshotStore`, `CaptureStrikeStore`, `CaptureStrikeAggregateStore`, `CaptureLabelStore`, `TimestampCaptureStore` (+ `optionMonitorTypes.ts`) |

## Dependency Direction

Store classes may depend on browser IndexedDB APIs and `shared/` types. Consumers in `backend/pipeline/`, `backend/services/`, and some frontend pages read and write through these store classes, but schema ownership stays here.

## Related Topic Docs

- [`STORAGE.md`](STORAGE.md)
- [`../network/network-and-auth.md`](../network/network-and-auth.md)
- [`../../pipeline/holdings-pipeline.md`](../../pipeline/holdings-pipeline.md)
- [`../../services/ai/ai-workflow.md`](../../services/ai/ai-workflow.md)
- [`../../../init-workflow.md`](../../../init-workflow.md)

## When Editing Here Also Read

- Read [`STORAGE.md`](STORAGE.md) before changing store names, key paths, or indexes.
- Read [`../../services/ai/README.md`](../../services/ai/README.md) for AI persistence impacts.
- Read [`../../pipeline/README.md`](../../pipeline/README.md) for holdings and snapshot persistence impacts.

