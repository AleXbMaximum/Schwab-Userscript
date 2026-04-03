# Schwaber User Guide

This guide explains how to install, navigate, and use the Schwaber / AlexQuant userscript on Charles Schwab positions pages.

## Scope

Use this document when you want to:

- install the userscript and confirm it is working
- understand how the UI is organized on desktop and mobile
- know which page to open for a specific task
- learn the main daily workflows without reading source-level architecture docs
- troubleshoot the most common setup and runtime problems

For source-oriented architectural reading, jump to [Dev/src/README.md](Dev/src/README.md).

## Before You Begin

### What This Project Is

Schwaber is an in-browser overlay and analysis workspace for the Schwab positions experience. It does not replace the Schwab site; it augments the positions page with additional analytics, views, and local persistence.

### What You Need

- A userscript manager such as Tampermonkey or Violentmonkey.
- A logged-in Schwab session.
- Access to the Schwab positions URL: `https://client.schwab.com/app/accounts/positions/*`.
- A built userscript bundle from this repository if you are installing locally.

### Important Expectations

- The tool is designed around the positions page and related account context.
- Some advanced surfaces depend on live auth/session state from Schwab.
- Some advanced features persist settings and history locally in IndexedDB.
- AI features require AI-provider configuration inside the app before they become useful.

## Install And First Launch

### Step 1: Build The Bundle

```bash
cd Dev
npm install
npm run build
```

Main output:

- `Dev/.dist/AlexQuant.user.js`

Optional developer output:

- `Dev/.dist/AlexQuant.local-loader.user.js`

### Step 2: Install The Userscript

1. Open your userscript manager.
2. Import or paste `Dev/.dist/AlexQuant.user.js`.
3. Save it.
4. Open the Schwab positions page.
5. Refresh if needed.

### Step 3: Confirm First Render

On a successful first render you should see the Schwaber / AlexQuant UI container and land on the Holdings view.

If you do not, go straight to [Troubleshooting](#troubleshooting).

## How The UI Is Organized

### Desktop Navigation

| Group | Pages | Best For |
| --- | --- | --- |
| Trade | Holdings, Portfolio, News | Daily account review, exposure checks, market context |
| Analysis | Options, Option Flow, Visualize, AI Analysis | Research, derivatives, monitoring, scenario work |

### Mobile Navigation

| Area | Pages |
| --- | --- |
| Direct tabs | Holdings, Portfolio, Options, Visualize |
| More menu | Option Flow, AI Analysis, News |

### Default Landing Page

The application initializes into Holdings first. That is the fastest way to confirm your account context, positions, and derived metrics are available.

## Which Page Should I Open?

| If you want to... | Open | Why |
| --- | --- | --- |
| review positions, P/L, Greeks, snapshots, or custom table views | Holdings | It is the core live operating surface |
| inspect exposure, rebalance ideas, or scenario/risk summaries | Portfolio | It aggregates portfolio-level views |
| scan headlines and immediately research them with AI | News | It combines feed filtering with a right-rail AI workspace |
| load a single symbol's options chain and study expiries, strikes, IV, or saved views | Options | It is the focused single-symbol analysis surface |
| watch option-flow style captures, signals, and dashboards | Option Flow | It is the monitoring/heatmap surface |
| explore correlation, moving beta, overlays, and bubble charts | Visualize | It is the best page for multi-symbol visual analysis |
| run a multi-stage AI analysis pipeline and store reports | AI Analysis | It is the long-form research surface |

## Page Guide

### Holdings

**Open it when** you want the fastest operational view of the account.

**What it focuses on**

- live holdings table and derived metrics
- configurable table views and local preferences
- account snapshot and history/timeline surfaces
- a natural first stop before you branch into Portfolio or Options

**Typical use cases**

- morning account scan
- after-hours check on key names
- spot-checking Greeks, concentration, beta, or warning fields
- comparing different table views for trading vs. long-horizon review

**Related technical docs**

- [Dev/src/frontend/trade_holdings/README.md](Dev/src/frontend/trade_holdings/README.md)
- [Dev/src/backend/pipeline/holdings-pipeline.md](Dev/src/backend/pipeline/holdings-pipeline.md)

### Portfolio

**Open it when** you want portfolio-level risk rather than single-row positions.

**What it focuses on**

- exposure panels
- scenario and stress-style summaries
- governance controls
- rebalance-oriented ideas and signals

**Typical use cases**

- review portfolio beta and Greeks concentration
- check whether a recent move changed your risk posture
- scan for rebalance ideas before trade planning

**Related technical docs**

- [Dev/src/frontend/trade_portfolio/README.md](Dev/src/frontend/trade_portfolio/README.md)
- [Dev/src/backend/computation/README.md](Dev/src/backend/computation/README.md)

### News

**Open it when** you want event context around your holdings or a filtered market/news stream.

**What it focuses on**

- source filters
- symbol filters
- search
- read-state management
- copy/export of filtered news sets
- right-rail AI workspace over selected or filtered articles

**Data sources surfaced by the repo**

- Schwab news
- Yahoo news/macros feeds
- Barron's fetchers
- Financial Juice feed support

**Typical use cases**

- scan only a specific symbol's headlines
- filter down to one source for a cleaner read
- select a set of stories and hand them to the AI workspace

**Related technical docs**

- [Dev/src/backend/services/news/README.md](Dev/src/backend/services/news/README.md)
- [Dev/src/frontend/README.md](Dev/src/frontend/README.md)

### Options

**Open it when** you want an on-demand chain view for a specific underlying.

**What it focuses on**

- symbol-driven chain loading
- expiries, strike windows, liquidity filters, and scope controls
- saved views and copy-out workflows
- page-local chart orchestration over computed options analytics

**Typical use cases**

- compare expiries before entering a trade
- focus on a strike cluster and inspect IV / exposure characteristics
- save a view state and revisit it later
- export a copy-out payload for external notes or comparison

**Related technical docs**

- [Dev/src/frontend/analysis_options/README.md](Dev/src/frontend/analysis_options/README.md)
- [Dev/src/backend/core/network/README.md](Dev/src/backend/core/network/README.md)

### Option Flow

**Open it when** you want a monitor-style derivatives dashboard rather than a one-off chain lookup.

**What it focuses on**

- monitor capture
- dashboard state and query engine
- option-flow charts and heatmaps
- local signals and panel-based monitoring

**Typical use cases**

- watch evolving flow behavior over a symbol universe
- inspect signals and heatmaps instead of a single symbol chain
- keep a persistent monitoring page open while moving between other views

**Related technical docs**

- [Dev/src/frontend/analysis_optionFlow/README.md](Dev/src/frontend/analysis_optionFlow/README.md)
- [Dev/src/backend/core/db/README.md](Dev/src/backend/core/db/README.md)

### Visualize

**Open it when** you want portfolio relationships rendered as charts rather than tables.

**What it focuses on**

- moving beta views
- correlation / beta heatmaps
- dual overlays and time series surfaces
- portfolio bubble charts

**Typical use cases**

- compare account names or symbols visually
- inspect rolling beta behavior
- scan correlation clusters before portfolio changes

**Related technical docs**

- [Dev/src/frontend/analysis_visualize/README.md](Dev/src/frontend/analysis_visualize/README.md)
- [Dev/src/frontend/ui-and-charting.md](Dev/src/frontend/ui-and-charting.md)

### AI Analysis

**Open it when** you want a longer-form, multi-stage research workflow over a symbol or idea.

**What it focuses on**

- provider and model selection
- pipeline configuration
- staged execution and streamed results when enabled
- history, stored analyses, and report-style output

**Pipeline stages surfaced by the backend docs**

```text
fetching_data
  -> running_analysts
  -> running_debate
  -> running_trader
  -> running_risk
  -> finalizing
```

**Typical use cases**

- run a research pass before a new trade idea
- compare the AI report against your own market/news read
- store prior analyses and revisit decisions later

**Related technical docs**

- [Dev/src/frontend/analysis_ai/README.md](Dev/src/frontend/analysis_ai/README.md)
- [Dev/src/backend/services/ai/ai-workflow.md](Dev/src/backend/services/ai/ai-workflow.md)

## Suggested Daily Workflows

### 1. Morning Account Check

1. Open Holdings.
2. Scan overall table state, warnings, and any custom table view you rely on.
3. Jump to Portfolio if you want a portfolio-level read rather than single rows.
4. Open News for context on symbols that moved unexpectedly.

### 2. Research A Potential Options Trade

1. Start in Holdings or News to decide which symbol deserves attention.
2. Open Options for a focused symbol chain view.
3. Refine expiries, strikes, and liquidity windows.
4. If you want broader monitoring context, jump to Option Flow.
5. If you want a longer synthesis, finish in AI Analysis.

### 3. Risk Review Before Rebalancing

1. Open Portfolio for exposure, scenarios, and rebalance ideas.
2. Use Visualize to inspect correlation or rolling beta relationships.
3. Return to Holdings to review row-level details before deciding on changes.

### 4. Event-Driven Research Loop

1. Open News and filter down by symbol or source.
2. Select the stories that matter.
3. Use the AI workspace or AI Analysis page to synthesize what changed.
4. Cross-check exposures in Portfolio or chain details in Options.

## Settings, Persistence, And Data

### What Is Stored Locally

Based on the repo's storage and AI docs, the application persists several classes of local state in IndexedDB, including:

- settings and preferences
- saved options views
- monitor captures / dashboard state
- account snapshot and history data
- AI analysis history and AI memory records

Clearing browser site data or IndexedDB can remove these local artifacts.

### What Usually Requires Configuration

- AI providers and models on the AI Analysis surface
- news refresh and source settings
- per-page preferences and view settings

### What Usually Depends On Active Schwab Context

- account-aware holdings rendering
- option chain loading with current auth/session state
- certain live or refreshed portfolio/news/account computations

## Troubleshooting

### The UI Does Not Appear

Check the following:

1. The userscript is enabled in your script manager.
2. You are on the Schwab positions URL covered by the userscript match rule.
3. You refreshed after installing the script.
4. The build actually produced `Dev/.dist/AlexQuant.user.js`.

### The Options Page Says It Is Waiting For Auth Token

This usually means the page/session context was not ready or has expired.

Try:

1. Refresh the Schwab positions page.
2. Confirm you are fully logged in.
3. Return to Holdings first, then re-open Options.

### The Local Loader Fails With A Network Error

The local-loader workflow expects:

- `cd Dev && npm run dev` running in watch mode
- the `Dev/` directory served at `http://127.0.0.1:5500`
- the bundle available at `http://127.0.0.1:5500/.dist/AlexQuant.user.js`

If any of those are missing, the local-loader script cannot fetch the current bundle.

### News Is Empty Or AI Does Not Produce Useful Output

Check:

1. the source filters are not excluding everything
2. AI/provider settings are configured
3. you actually selected or filtered items when using the AI workspace
4. the current market/news sources are enabled in settings

### Data Looks Stale

Check:

1. whether the market/session context actually changed
2. whether your current page is still authenticated
3. whether you need to manually refresh the relevant surface
4. whether the issue is tied to a feature-specific setting or saved view state

## For Contributors And Power Users

If you want to go deeper than this guide:

- [README.md](README.md) - repo-level overview and development commands
- [Dev/src/README.md](Dev/src/README.md) - canonical architecture entry
- [Dev/src/init-workflow.md](Dev/src/init-workflow.md) - startup lifecycle
- [.docs/devPlan/regulation/Timezone.md](.docs/devPlan/regulation/Timezone.md) - required pre-read before time-related changes

## Summary

If you remember only one thing, remember this navigation model:

- Holdings is the operating center.
- Portfolio and Visualize are for risk and relationship views.
- Options and Option Flow are for derivatives analysis and monitoring.
- News and AI Analysis are for context, synthesis, and decision support.

Start with Holdings, branch based on the question you are trying to answer, and use the near-source docs when you need feature-level implementation depth.