# Shared

## Purpose

`shared/` contains cross-layer contracts and reusable primitives that must stay consistent between backend and frontend.

## Owns

- shared domain types in `types/`
- logging primitives in `log/`
- runtime metrics collection in `metrics/`
- settings normalization and refresh defaults in `settings/`
- general utilities in `utils/`

## Does Not Own

- runtime orchestration
- feature-specific page state
- transport adapters

## Subdirectory Map

| Subdir | Purpose |
| --- | --- |
| `types/` | cross-layer domain types: `core.ts` (AppContext, Settings, AI types), `holdings.ts`, `holdingsTableColumns.ts`, `marketData.ts`, `options.ts`, `streamer.ts`, `chartData.ts`, `derived.ts` |
| `log/` | logging entry: `core/LogService.ts` (consolidated `logService` singleton + `LogService` class), `Logger.ts`, `devTools.ts` |
| `metrics/` | runtime perf collection: `perfCollector.ts` |
| `settings/` | settings normalization (`settingsNormalization.ts`) and news-refresh defaults (`newsRefreshDefaults.ts`) |
| `utils/` | bucketed utilities (see below) |

### `utils/` buckets

| Bucket | Notable files |
| --- | --- |
| `async/` | concurrency helpers (debounce, retry, etc.) |
| `data/` | array, map, and object helpers |
| `dom/` | DOM helpers safe for shared use |
| `domain/` | domain-specific transformers (e.g. holdings/option helpers shared across layers) |
| `format/` | `formatters.ts`, `markdown.ts`, `numberNormalizer.ts`, `relativeTime.ts` |
| `math/` | numeric primitives shared across backend and frontend |
| `state/` | `StateRepository.ts`, `TypedEventBus.ts` (exports the `TypedEventBus<Events>` type and the `createEventBus<Events>()` factory), `eventEmitter.ts` |
| `time/` | `canonical.ts` — the canonical timezone API mandated by [`../../../.docs/devPlan/regulation/Timezone.md`](../../../.docs/devPlan/regulation/Timezone.md) |
| `time.ts` | legacy time helpers retained during the migration to `time/canonical.ts`; new code should import from the canonical module |

## Key Entry Files

- [`types/core.ts`](types/core.ts)
- [`types/holdingsTableColumns.ts`](types/holdingsTableColumns.ts)
- [`types/marketData.ts`](types/marketData.ts)
- [`log/core/LogService.ts`](log/core/LogService.ts)
- [`metrics/perfCollector.ts`](metrics/perfCollector.ts)
- [`settings/settingsNormalization.ts`](settings/settingsNormalization.ts)
- [`utils/format/formatters.ts`](utils/format/formatters.ts)
- [`utils/time/canonical.ts`](utils/time/canonical.ts)
- [`utils/state/TypedEventBus.ts`](utils/state/TypedEventBus.ts)

## Dependency Direction

`shared/` is imported by both backend and frontend and should stay acyclic. If a contract belongs to more than one layer, it belongs here instead of in a feature directory. Browser-only chart rendering helpers belong in `frontend/charts/`.

## Related Topic Docs

- [`../frontend/ui-and-charting.md`](../frontend/ui-and-charting.md)
- [`../backend/pipeline/holdings-pipeline.md`](../backend/pipeline/holdings-pipeline.md)
- [`../init-workflow.md`](../init-workflow.md)
- [`../../../.docs/devPlan/regulation/Timezone.md`](../../../.docs/devPlan/regulation/Timezone.md) — required pre-read before any time/timestamp/timezone change

## When Editing Here Also Read

- Read the nearest consumer README before changing a shared type or helper.
- Read [`../backend/core/db/STORAGE.md`](../backend/core/db/STORAGE.md) when a shared type is persisted.
- Read `Timezone.md` before touching anything in `utils/time/` or `utils/time.ts`.
