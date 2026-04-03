# Schwaber

Schwaber is a browser userscript that augments Charles Schwab's positions experience with a richer in-page workspace for holdings analytics, portfolio risk review, options analysis, option-flow monitoring, AI-assisted research, and multi-source news.

The repository itself is named `Schwab-Userscript`, while the generated bundle and some runtime labels still use `AlexQuant` / `AlexHedgeFund`. In practice, these names refer to the same userscript surface in this repo.

## What You Get

| Area | What It Adds | Main Entry |
| --- | --- | --- |
| Holdings | Live position table, derived metrics, snapshots, configurable views | `HOLDINGS` |
| Portfolio | Exposure, scenarios, governance, rebalance ideas | `PORTFOLIO` |
| News | Multi-source market/news feed with filters and AI workspace | `NEWS` |
| Options | On-demand chain analysis, saved views, copy-out workflows | `OPTIONS` |
| Option Flow | Monitor-style dashboard, captures, signals, heatmaps | `OPTION_FLOW` |
| Visualize | Correlation, moving beta, overlay charts, portfolio bubbles | `VISUALIZE` |
| AI Analysis | Multi-stage research pipeline, history, report export | `AI_ANALYSIS` |

## Quick Start

### Requirements

- A modern Chromium or Firefox browser with a userscript manager such as Tampermonkey or Violentmonkey.
- An authenticated Schwab web session on the positions page: `https://client.schwab.com/app/accounts/positions/*`.
- Node.js and npm for local builds.

### Build The Userscript

```bash
cd Dev
npm install
npm run build
```

This emits the main production bundle at `Dev/.dist/AlexQuant.user.js`.

### Install The Bundle

1. Open your userscript manager.
2. Import or paste `Dev/.dist/AlexQuant.user.js`.
3. Save the script.
4. Open or refresh the Schwab positions page.
5. Verify that the Schwaber / AlexQuant UI shell appears and lands on the Holdings view.

## Daily Navigation Model

### Desktop Navigation

| Group | Views |
| --- | --- |
| Trade | Holdings, Portfolio, News |
| Analysis | Options, Option Flow, Visualize, AI Analysis |

### Mobile Navigation

- Direct tabs: Holdings, Portfolio, Options, Visualize
- More menu: Option Flow, AI Analysis, News

Holdings is the default landing page after initialization.

## System Shape

```text
Schwab positions page
	-> Dev/src/AlexQuant.ts
			-> frontend/components/DataPipelineCoordinator.ts
			-> backend/pipeline/BackendOrchestrator.ts
			-> frontend/RenderEngine.ts

Runtime layers
	backend/  transport, persistence, orchestration, computation, services
	frontend/ pages, components, charts, settings panels
	shared/   cross-layer types, table columns, logging, utilities
```

The codebase already keeps its deep architectural docs close to the source. The root README is meant to get you moving quickly, then hand you off to the authoritative near-source docs.

## Repository Layout

```text
.
├── README.md
├── USERGUIDE.md
├── AGENTS.md
├── CLAUDE.md
├── .docs/
│   ├── devPlan/
│   ├── data corr/
│   ├── debug_log/
│   └── schwab_page_source_code/
└── Dev/
		├── package.json
		├── webpack.config.js
		├── .dist/
		└── src/
				├── AlexQuant.ts
				├── backend/
				├── frontend/
				└── shared/
```

## Documentation Map

### Start Here

- [USERGUIDE.md](USERGUIDE.md) - installation, navigation, pages, workflows, troubleshooting
- [Dev/src/README.md](Dev/src/README.md) - canonical architecture entry and reading routes

### Deep Technical Reading

- [Dev/src/init-workflow.md](Dev/src/init-workflow.md) - startup lifecycle from userscript load to first render
- [Dev/src/backend/pipeline/holdings-pipeline.md](Dev/src/backend/pipeline/holdings-pipeline.md) - holdings ingestion and derived-state flow
- [Dev/src/backend/services/ai/ai-workflow.md](Dev/src/backend/services/ai/ai-workflow.md) - AI pipeline stages, persistence, streaming, and search
- [Dev/src/frontend/ui-and-charting.md](Dev/src/frontend/ui-and-charting.md) - shared UI and charting conventions

### Critical Contributor Docs

- [.docs/devPlan/regulation/Timezone.md](.docs/devPlan/regulation/Timezone.md) - required pre-read before any time / timestamp / timezone work
- [Dev/src/backend/core/db/README.md](Dev/src/backend/core/db/README.md) - IndexedDB ownership and persistence boundaries
- [Dev/src/backend/core/network/README.md](Dev/src/backend/core/network/README.md) - transport and normalization boundary

## Development Workflow

Run all npm commands from `Dev/`.

| Command | Purpose |
| --- | --- |
| `npm run build` | Build the production userscript into `.dist/` |
| `npm run dev` | Watch-mode build for local iteration |
| `npm run lint` | Run ESLint across JS/TS sources |
| `npm run typecheck` | Run TypeScript without emitting output |
| `npm run test` | Run the Jest test script exposed by `package.json` |
| `npm run format` | Format supported source and doc files |

### Optional Local-Loader Loop

The webpack config also emits `Dev/.dist/AlexQuant.local-loader.user.js`.

Use it when you want a faster edit/build/refresh loop:

1. Run `cd Dev && npm run dev`.
2. Serve the `Dev/` directory at `http://127.0.0.1:5500`.
3. Install `Dev/.dist/AlexQuant.local-loader.user.js` in your userscript manager.
4. Open the Schwab positions page and iterate against the served bundle.

The local loader expects the bundle at `http://127.0.0.1:5500/.dist/AlexQuant.user.js`.

## Contributor Notes

- Near-source docs under `Dev/src/**/README.md` remain the source of truth for layer ownership and local design decisions.
- When you change a workflow, invariant, or schema, update the nearest local README and related topic doc in the same change.
- Before any time-related work, read [.docs/devPlan/regulation/Timezone.md](.docs/devPlan/regulation/Timezone.md).
- Research artifacts, captured upstream payloads, and planning material live under `.docs/`.

## Suggested Reading Paths

### If You Want To Use The Tool

1. Read [USERGUIDE.md](USERGUIDE.md).
2. Install the bundle.
3. Start with Holdings, then branch to Portfolio, Options, or News based on your workflow.

### If You Want To Contribute

1. Read [Dev/src/README.md](Dev/src/README.md).
2. Read [Dev/src/init-workflow.md](Dev/src/init-workflow.md).
3. Follow the relevant feature README from there.

### If You Want To Understand Architecture Quickly

1. Read [Dev/src/README.md](Dev/src/README.md).
2. Read [Dev/src/backend/README.md](Dev/src/backend/README.md), [Dev/src/frontend/README.md](Dev/src/frontend/README.md), and [Dev/src/shared/README.md](Dev/src/shared/README.md).
3. Dive into the relevant topic docs for the workflow you are touching.
