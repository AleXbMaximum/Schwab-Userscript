# Network And Auth

## Scope

This document describes external transport, auth, parser normalization, streamer lifecycle, and network-adjacent persistence rules.

## Owner Directory

`Dev/src/backend/core/network/`

## Recommended Read Order

1. [`../../README.md`](../../README.md)
2. [`README.md`](README.md)
3. [`../../../init-workflow.md`](../../../init-workflow.md)
4. [`../../pipeline/holdings-pipeline.md`](../../pipeline/holdings-pipeline.md)
5. [`../db/STORAGE.md`](../db/STORAGE.md)

## Architecture Split

### Holdings Pipeline Adapters

- [`types.ts`](types.ts)
- [`schwab/SchwabNetworkSource.ts`](schwab/SchwabNetworkSource.ts)
- per-endpoint REST modules under [`schwab/endpoints/`](schwab/endpoints/) (`balances.ts`, `holdings.ts`, `quotes.ts`, `options.ts`, `marketData.ts`, `news.ts`, `calendar.ts`, `indicesHistory.ts`, `symbol_quotes_history.ts`)
- shared transport infra under [`schwab/infra/`](schwab/infra/) (`auth.ts`, `httpUtils.ts`, `initContext.ts`)

These adapters provide holdings, quotes, balances, options, and streamer data to the holdings pipeline.

### Enrichment And Auxiliary Adapters

- Yahoo adapters in `yahoo/`
- Barron's fetchers in `barrons/` — `BarronsFetcher.ts` is now a thin coordinator over `transport.ts`, `urls.ts`, and `extractors.ts`
- LLM transport in [`llm/LLMClient.ts`](llm/LLMClient.ts): `LLMClient` is a type and `createLLMClient(config)` returns a client that exposes `complete(options)` and `completeStream(options)`. The factory dispatches into per-provider modules: [`llm/anthropicProvider.ts`](llm/anthropicProvider.ts), [`llm/geminiProvider.ts`](llm/geminiProvider.ts), [`llm/openaiProvider.ts`](llm/openaiProvider.ts).
- SSE stream parser in [`llm/sseParser.ts`](llm/sseParser.ts)
- News fan-out across [`../../services/news/newsFetchers.ts`](../../services/news/newsFetchers.ts), [`../../services/news/newsFetchHelpers.ts`](../../services/news/newsFetchHelpers.ts), and [`../../services/news/newsItemHelpers.ts`](../../services/news/newsItemHelpers.ts)

These sources are fail-soft. Optional source failures should not break the primary holdings runtime.

## Auth Startup Contract

Auth startup is intentionally split across the bootstrap phases documented in [`../../../init-workflow.md`](../../../init-workflow.md):

- Phase 1 starts `fetchAuthToken()` in parallel with DB, DOM, and init-context discovery.
- Phase 4 awaits the auth token, calls `setAuthToken()`, resolves account info, starts the header renderer, and renders the first view.
- Phase 5 connects the streamer and starts auth auto-refresh after first paint.

Key rules:

- `subscribeAuthToken()` listeners must be notified whenever the token changes.
- `refreshAuthToken()` deduplicates concurrent refreshes through a shared promise.
- visibility recovery is part of auth freshness; hidden tabs skip periodic refresh until visible again.

## REST Transport Rules

- `withTokenRefresh()` (defined in [`schwab/infra/httpUtils.ts`](schwab/infra/httpUtils.ts)) retries once on `401` plus `invalid_token`.
- Schwab endpoint modules under [`schwab/endpoints/`](schwab/endpoints/) keep required Schwab headers and correlators intact during refactors.
- Options chain fetching supports optional expiration narrowing without changing the default all-expirations behavior.
- Parser modules under [`schwab/parsing/`](schwab/parsing/) own unit conversion and sentinel cleanup. UI and pipeline layers should not compensate for raw payload quirks.

## Balances API

[`schwab/endpoints/balances.ts`](schwab/endpoints/balances.ts) polls the balances snapshot used by the header and account-history features.

- registered under the `balances` scheduler key
- active during market, after-hours, and pre-market phases
- paused during overnight and closed phases
- normalized to a flat `BalancesSnapshot` before emission

## Streamer State Machine

[`schwab/streamer.ts`](schwab/streamer.ts) owns Schwab real-time streaming.

Key behaviors:

1. Connect, then login, then bootstrap subscriptions.
2. Queue subscriptions until login succeeds.
3. Track separate equity and option subscription sets.
4. Send only delta `SUBS` and `UNSUBS`.
5. Map numeric field IDs to normalized field names before notifying listeners.
6. Auto-reconnect uses exponential backoff and preserves subscription state across reconnects.
7. Visibility changes can trigger connection health checks.
8. Intentional disconnect disables reconnect behavior.

`StreamerBridge` in the pipeline layer adds lifecycle ownership, deduplicated listener wiring, and phase-aware reconnect behavior.

## Parser And Normalization Boundary

Parser files include:

- `schwab/parsing/holdingsParser.ts`
- `schwab/parsing/optionsParser.ts`
- `schwab/parsing/quotesParser.ts`
- `schwab/parsing/streamerParser.ts`
- `schwab/parsing/chartNormalizer.ts`
- `schwab/parsing/calendarParser.ts`
- `schwab/parsing/numberParsers.ts`

Rules:

- percent-point payloads are converted to ratios where the app expects ratios
- sentinel values are converted to `null` or omitted fields where appropriate
- normalization happens here, not in the UI

## Chart Data Service

[`chart/ChartDataService.ts`](chart/ChartDataService.ts) sits above Schwab and Yahoo chart adapters.

- Schwab is primary when interval coverage and symbol class allow it
- Yahoo is fallback and also the default for index symbols
- responses normalize to shared `OHLCVBar`-style contracts before consumers see them
- caching is keyed by symbol, interval, and time window

Consumers include beta calculation, intraday sparkline storage, and AI data fetching.

## Yahoo, Barron's, And News Fan-Out

- Yahoo adapters use `GM.xmlHttpRequest` with timeout and fail-soft handling.
- Barron's collection can return partial bundles instead of hard-failing enrichment.
- `NewsLifecycleCoordinator` owns news polling lifecycle and symbol-scope synchronization from holdings deltas.
- Symbol-scoped news fan-out is concurrency-limited and should remain decoupled from the page render lifecycle.

## Yahoo Overnight Streamer

The overnight streamer is a separate Yahoo WebSocket flow that updates dedicated overnight fields.

- enabled only when the relevant settings and phase conditions allow it
- subscribes only equity symbols
- writes dedicated overnight price and change fields
- coexists with warmup fetches and quote polling without replacing the normal regular-session field set

## Network-Adjacent Persistence

- Auth state and settings use token-scoped or global KV keys through the DB layer.
- Chart data caching is in-memory and owned by the chart service rather than IndexedDB.
- Holdings raw-state persistence is throttled; the pipeline can update in-memory state more frequently than it writes to disk.

## Critical Invariants

- Transport adapters must emit normalized shapes before data reaches orchestration or UI.
- Auto-refresh and reconnect paths must deduplicate concurrent work.
- Streamer enablement is phase-aware. Non-market phases must not leave stale full-field streamer writes active.
- Network-side persistence behavior must stay aligned with the DB schema documented in [`../db/STORAGE.md`](../db/STORAGE.md).

## Related Local Docs

- [`README.md`](README.md)
- [`../README.md`](../README.md)
- [`../db/STORAGE.md`](../db/STORAGE.md)
- [`../../pipeline/holdings-pipeline.md`](../../pipeline/holdings-pipeline.md)
- [`../../../init-workflow.md`](../../../init-workflow.md)

