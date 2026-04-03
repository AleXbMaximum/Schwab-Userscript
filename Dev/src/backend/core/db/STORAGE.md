# AlexQuant Data Storage Architecture

## Scope

This document defines the IndexedDB schema, store responsibilities, record shapes, and persistence conventions used across settings, account history, monitor snapshots, options analysis snapshots, and AI history.

## Owner Directory

`Dev/src/backend/core/db/`

## Recommended Read Order

1. [`README.md`](README.md)
2. [`core/AlexQuantDB.ts`](core/AlexQuantDB.ts)
3. [`core/KVStore.ts`](core/KVStore.ts)
4. [`../network/network-and-auth.md`](../network/network-and-auth.md)
5. consumer docs such as [`../../pipeline/holdings-pipeline.md`](../../pipeline/holdings-pipeline.md) and [`../../services/ai/ai-workflow.md`](../../services/ai/ai-workflow.md)

## Related Local Docs

- [`README.md`](README.md)
- [`../README.md`](../README.md)
- [`../network/network-and-auth.md`](../network/network-and-auth.md)
- [`../../pipeline/holdings-pipeline.md`](../../pipeline/holdings-pipeline.md)
- [`../../services/ai/ai-workflow.md`](../../services/ai/ai-workflow.md)

All persistent data is stored in a single IndexedDB database. No localStorage is used.

## Database

| Property   | Value                                                        |
| ---------- | ------------------------------------------------------------ |
| Name       | `alexquant`                                                   |
| Version    | `9`                                                          |
| Connection | `openAlexQuantDB()` — lazy singleton, cached after first open |
| Source     | `Dev/src/backend/core/db/core/AlexQuantDB.ts`                 |

## Object Stores

```text
alexquant (v9)
├── kv                              — General key-value config/settings
├── account_snapshot_history          — Account Snapshot time-series
├── account_snapshot_history_archive  — Compacted long-term account history
├── monitor_openings                 — Monitor per-symbol snapshots
├── timestamp_openings               — User-saved analysis snapshots
├── opening_snapshots                — Meta + embedded expiry array
├── opening_strike_aggregates        — Per-strike GEX + OI
├── options_opening_strike_legs      — Per-strike option chain data
├── options_feature_labels           — ML feature labels
├── ai_analyses                      — AI analysis records
└── ai_memories                      — AI condensed memory entries
```

---

### `kv` — General Key-Value Store

Generic KV store for small config and settings data.

| Property    | Value                                       |
| ----------- | ------------------------------------------- |
| keyPath     | `key`                                       |
| Indexes     | _(none)_                                    |
| Store class | `KVStore` (`Dev/src/backend/core/db/core/KVStore.ts`) |

**Record shape:**

```typescript
{
  key: string;
  value: any;
  updatedAt: number;
}
```

**Keys in use:**

| Key pattern                     | Writer                         | Purpose                                                                                |
| ------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| `state.{key}.{token}`           | State Layer (`persistence.ts`) | Per-user app state (authToken, accountId, settings, lastUpdate, rawHoldings, betaData) |
| `ui.holdingsTableSort`          | `trade_holdings/page.ts`       | Holdings table sort column/direction                                                   |
| `monitor.settings`              | `monitor.ts`                   | Monitor configuration (enabled, symbols, intervals)                                    |
| `monitor.lastCycleAt`           | `monitor.ts`                   | Timestamp of last monitor refresh cycle                                                |
| `ui.movingBetaWatchlist`        | `MovingBetaChart.ts`           | Moving Beta chart watchlist ticker list                                                |
| `ui.movingBetaIndicators`       | `MovingBetaChart.ts`           | Moving Beta chart indicator ticker list                                                |
| `ui.crossAssetMatrixRowTickers` | `CorrelationBetaHeatmap.ts`    | Cross-Asset Matrix row ticker list                                                     |
| `ui.crossAssetMatrixColTickers` | `CorrelationBetaHeatmap.ts`    | Cross-Asset Matrix column ticker list                                                  |

---

### `account_snapshot_history` — Account Snapshot Time-Series

Stores periodic snapshots of account metrics for the Snapshot chart.

| Property    | Value                                                               |
| ----------- | ------------------------------------------------------------------- |
| keyPath     | `ts`                                                                |
| Indexes     | _(none)_                                                            |
| Store class | `AccountHistoryStore` (`Dev/src/backend/core/db/account/AccountHistoryStore.ts`) |

**Record shape:**

```typescript
{
  ts: number; // Unix timestamp (ms)
  marketValue: number;
  dayPnL: number;
  totalPnL: number;
  // ... other account metrics
}
```

---

### `monitor_openings` — Monitor Per-Symbol Snapshots

Stores compact capture snapshots collected by the background monitor. Used for multi-day Snapshot analysis. Each symbol retains up to ~240 snapshots with time-based compaction (more recent = higher density).

| Property    | Value                                                               |
| ----------- | ------------------------------------------------------------------- |
| keyPath     | `[symbol, capturedAt]`                                              |
| Indexes     | `symbol` → `symbol`                                                 |
| Store class | `MonitorCaptureStore` (`Dev/src/backend/core/db/capture/MonitorCaptureStore.ts`) |

**Record shape:**

```typescript
{
  symbol: string; // e.g. "SPY"
  capturedAt: string; // ISO timestamp
  // ... compact capture summary fields
}
```

---

### `timestamp_openings` — User-Saved Analysis Snapshots

Stores full API responses that the user manually saves from the Options Analysis page for later comparison.

| Property    | Value                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| keyPath     | `[symbol, savedAt]`                                                     |
| Indexes     | `symbol` → `symbol`                                                     |
| Store class | `TimestampCaptureStore` (`Dev/src/backend/core/db/capture/TimestampCaptureStore.ts`) |

**Record shape:**

```typescript
{
  symbol: string;
  savedAt: string; // ISO timestamp
  version: number;
  dataTimestamp: string; // API response timestamp
  response: any; // Full API response object
  view: any; // Associated view state
}
```

---

### `opening_snapshots` — Capture Snapshots

One row per captured options capture snapshot with embedded expiry metrics array. Single-read access eliminates the need for meta↔expiry join.

| Property    | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| keyPath     | `openingId`                                                           |
| Indexes     | `symbolDataTs` → `[symbol, dataTimestamp]` (unique)                   |
|             | `symbolCaptured` → `[symbol, capturedAtUtc]`                          |
|             | `capturedAt` → `capturedAtUtc`                                        |
| Store class | `CaptureSnapshotStore` (`Dev/src/backend/core/db/capture/CaptureSnapshotStore.ts`) |

**Record shape** (`OptionCaptureSnapshotRow`):

```typescript
{
  openingId: string;            // UUID
  symbol: string;               // e.g. "SPY"
  capturedAtUtc: string;        // ISO timestamp (UTC)
  marketTimeCt: string;         // Central Time display string, e.g. "9:35"
  dataTimestamp: string;        // API-reported data timestamp
  underlyingPrice: number | null;
  interestRate: number | null;
  dividendYield: number | null;
  contractMultiplier: number;
  expirationsCount: number;
  isDelayed: boolean;
  expiryMetrics: EmbeddedExpiryMetrics[];  // Per-expiry aggregated metrics
}
```

**Convenience extractors** (exported from `CaptureSnapshotStore.ts`):

- `snapshotToMetaRow(snapshot)` → `OptionCaptureMetaRow` — extract meta fields
- `snapshotToExpiryRows(snapshot)` → `OptionCaptureExpiryMetricsRow[]` — expand embedded array back to standalone rows
- `buildSnapshotRow(meta, expiryRows)` → `OptionCaptureSnapshotRow` — build from ETL components

---

### `opening_strike_aggregates` — Strike Aggregates

Per-strike GEX + OI data in a single store. Used by both GEX and OI heatmap engines.

| Property    | Value                                                                               |
| ----------- | ----------------------------------------------------------------------------------- |
| keyPath     | `[openingId, strike]`                                                               |
| Indexes     | `openingId` → `openingId`                                                           |
| Store class | `CaptureStrikeAggregateStore` (`Dev/src/backend/core/db/capture/CaptureStrikeAggregateStore.ts`) |

**Record shape** (`OptionCaptureStrikeAggregateRow`):

```typescript
{
  openingId: string;
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
  callOI: number;
  putOI: number;
}
```

---

### `options_opening_strike_legs` — Per-Strike Option Chain Data

One row per individual option contract. Full chain data for deep analysis and GEX heatmaps.

| Property    | Value                                                             |
| ----------- | ----------------------------------------------------------------- |
| keyPath     | `[openingId, expiryLabel, strike, optionType]`                    |
| Indexes     | `openingId` → `openingId`                                         |
| Store class | `CaptureStrikeStore` (`Dev/src/backend/core/db/capture/CaptureStrikeStore.ts`) |

**Record shape** (`OptionCaptureStrikeLegRow`):

```typescript
{
  openingId: string;
  symbol: string;
  expiryLabel: string;
  dte: number;
  strike: number;
  optionType: "C" | "P";
  bid: number | null;
  ask: number | null;
  last: number | null;
  mark: number | null;
  vol: number | null;
  oi: number | null;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  intrinsic: number | null;
  extrinsic: number | null;
  theoVal: number | null;
  bidSize: number | null;
  askSize: number | null;
  spreadPct: number | null;
  midPrice: number | null;
  callGex: number | null;
  putGex: number | null;
  netGex: number | null;
}
```

---

### `options_feature_labels` — ML Feature Labels

Forward-looking return labels computed via backfill after subsequent captures arrive. Used for training/evaluation.

| Property    | Value                                                           |
| ----------- | --------------------------------------------------------------- |
| keyPath     | `[openingId, symbol]`                                           |
| Indexes     | `openingId` → `openingId`                                       |
| Store class | `CaptureLabelStore` (`Dev/src/backend/core/db/capture/CaptureLabelStore.ts`) |

**Record shape** (`OptionCaptureFeatureLabelRow`):

```typescript
{
  openingId: string;
  symbol: string;
  fwdRet10m: number | null; // Forward return at +10 min
  fwdRet30m: number | null;
  fwdRet60m: number | null;
  fwdAbsRet30m: number | null; // Absolute forward return
  fwdAbsRet60m: number | null;
  rv30m: number | null; // Realized volatility
  rv60m: number | null;
  moveExceedsImplied30m: boolean | null;
  sessionSegment: "open" | "mid" | "close" | null;
  eventFlag: string | null;
}
```

---

### `ai_analyses` — AI Analysis Records

Full AI analysis records including market data, agent outputs, and final decisions. One row per analysis run per symbol.

| Property    | Value                                                       |
| ----------- | ----------------------------------------------------------- |
| keyPath     | `[symbol, id]`                                              |
| Indexes     | `symbol` → `symbol`                                         |
|             | `requestedAt` → `requestedAt`                               |
| Store class | `AIAnalysisStore` (`Dev/src/backend/core/db/ai/AIAnalysisStore.ts`) |

**Record shape** (`AIAnalysisRecord`):

```typescript
{
  id: string;                          // UUID
  symbol: string;
  requestedAt: string;                 // ISO timestamp
  completedAt: string | null;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
  provider: string;                    // e.g. 'anthropic'
  model: string;                       // e.g. 'claude-opus-4-6'
  marketData: MarketDataBundle | null; // Full market context (OHLCV, fundamentals, news, etc.)
  stages: AIStageResult[];             // Array of agent outputs
  finalDecision: AIFinalDecision | null;
  totalTokensUsed: number;
  totalDurationMs: number;
  errorMessage?: string;
}
```

---

### `ai_memories` — AI Condensed Memory Entries

Lightweight historical summaries extracted from completed analyses. Used as context for future analysis runs.

| Property    | Value                                               |
| ----------- | --------------------------------------------------- |
| keyPath     | `[symbol, id]`                                      |
| Indexes     | `symbol` → `symbol`                                 |
| Store class | `MemoryStore` (`Dev/src/backend/core/db/ai/MemoryStore.ts`) |

**Record shape** (`MemoryEntry`):

```typescript
{
  id: string;                          // Derived from AIAnalysisRecord.id
  symbol: string;
  date: string;                        // ISO timestamp
  action: string;                      // 'BUY' | 'SELL' | 'HOLD' | etc.
  conviction: number;                  // 0-10 confidence level
  summary: string;                     // Executive summary
  keyBullPoints: string[];
  keyBearPoints: string[];
  priceAtAnalysis?: number | null;
}
```

---

## Data Flow

```text
Schwab API
    │
    ▼
MonitorController  ──fetch + ETL──▶  IndexedDB
    │                                     │
    │        ┌──────────────┬─────────────┤
    │        ▼              ▼             ▼
    │   SnapshotETL    StrikeLegsETL   StrikeAggregateETL
    │   (meta+expiry)       │          (GEX + OI merged)
    │        │              ▼             │
    │        ▼         StrikeStore        ▼
    │   SnapshotStore              AggregateStore
    │        │
    │        ▼
    │   LabelBackfill ──▶ LabelStore
    │
    ├──snapshots──▶ MonitorCaptureStore
    │
    ├──metrics──▶ AccountHistoryStore / AccountHistoryArchiveStore
    │
    └──settings──▶ KVStore

User (save btn)   ──snapshots──▶ TimestampCaptureStore

State Layer       ──settings──▶ KVStore

BetaService       ──betaData──▶ KVStore  (via State Layer, hydrated on startup)

AI Pipeline       ──analyses──▶ AIAnalysisStore (ai_analyses)
                  ──memories──▶ MemoryStore (ai_memories)
```

## Critical Invariants

- Schema changes must stay aligned with `DB_VERSION` and the upgrade logic in `core/AlexQuantDB.ts`.
- Token-scoped versus global KV key conventions must remain stable unless all readers and writers migrate together.
- Store key paths and indexes are API surfaces for the rest of the app. Rename them only with a coordinated migration.
- Persistence should not become the normalization boundary. Transport and parser layers must still normalize before values are written here.

## Store Class Locations

| Store                         | File                                                |
| ----------------------------- | --------------------------------------------------- |
| `KVStore`                     | `Dev/src/backend/core/db/core/KVStore.ts`           |
| `AccountHistoryStore`         | `Dev/src/backend/core/db/account/AccountHistoryStore.ts` |
| `AccountHistoryArchiveStore`  | `Dev/src/backend/core/db/account/AccountHistoryArchiveStore.ts` |
| `MonitorCaptureStore`         | `Dev/src/backend/core/db/capture/MonitorCaptureStore.ts` |
| `TimestampCaptureStore`       | `Dev/src/backend/core/db/capture/TimestampCaptureStore.ts` |
| `CaptureSnapshotStore`        | `Dev/src/backend/core/db/capture/CaptureSnapshotStore.ts` |
| `CaptureStrikeAggregateStore` | `Dev/src/backend/core/db/capture/CaptureStrikeAggregateStore.ts` |
| `CaptureStrikeStore`          | `Dev/src/backend/core/db/capture/CaptureStrikeStore.ts` |
| `CaptureLabelStore`           | `Dev/src/backend/core/db/capture/CaptureLabelStore.ts` |
| `AIAnalysisStore`             | `Dev/src/backend/core/db/ai/AIAnalysisStore.ts`     |
| `MemoryStore`                 | `Dev/src/backend/core/db/ai/MemoryStore.ts`         |
