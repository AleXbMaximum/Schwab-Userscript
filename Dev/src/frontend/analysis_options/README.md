# Frontend Analysis Options

## Purpose

`frontend/analysis_options/` owns the on-demand options analysis page: symbol loading, chart orchestration, local view state, and saved view comparison flows.

## Owns

- page layout and controls in `page.ts`
- local state in `store/OptionsViewStore.ts`
- page-local chart orchestration (`chartOrchestrator.ts`) and pure computation (`computeDerivatives.ts`)
- focus strike overlay state in `focus/`
- saved view serialization, persistence, and types in `savedView/`
- view control presets and formatters in `controls/`
- options page types in `types.ts`

## Does Not Own

- Schwab options transport
- option analytics formulas
- option capture monitor ETL or store schema

## Key Entry Files

- [`page.ts`](page.ts) and helpers `pageHelpers.ts`, `pageTimestampActions.ts`
- [`chartOrchestrator.ts`](chartOrchestrator.ts)
- [`computeDerivatives.ts`](computeDerivatives.ts)
- [`store/OptionsViewStore.ts`](store/OptionsViewStore.ts)
- [`store/selectors.ts`](store/selectors.ts)
- [`focus/focusStrike.ts`](focus/focusStrike.ts)
- [`savedView/savedViewTypes.ts`](savedView/savedViewTypes.ts)
- [`types.ts`](types.ts)

## Directory Structure

```
analysis_options/
├── page.ts                       # Entry point, lifecycle, input bar
├── pageHelpers.ts                # Page-level helpers shared across page.ts
├── pageTimestampActions.ts       # Saved-view / timestamp action wiring
├── chartOrchestrator.ts          # Thin coordinator: compute → render → wire callbacks
├── computeDerivatives.ts         # Pure computation: all derived analytics from chain data
├── types.ts                      # UI types, component refs, view state shape
├── savedView/                    # Saved view serialization & persistence
│   ├── savedViewTypes.ts
│   ├── savedViewSerializer.ts
│   └── savedViewRepository.ts
├── store/                        # Pub-sub state management
│   ├── OptionsViewStore.ts
│   ├── filters.ts
│   └── selectors.ts
├── controls/                     # UI controls for view filters
│   ├── OptionsViewControls.ts
│   ├── controlPresets.ts
│   ├── controlFormatters.ts
│   ├── optionsControlHelpers.ts
│   ├── optionsControlStyles.ts
│   └── optionsLiquidityAdvanced.ts
├── focus/                        # Global focus-strike overlay state
│   ├── focusStrike.ts
│   └── focusStrikeOverlayPlugin.ts  # Chart.js plugin
└── components/                   # Chart and panel renderers
    ├── charts/                   # Custom canvas + Chart.js visualizations
    ├── panels/                   # Text/table info panels
    ├── SectionLayout.ts          # 3-column responsive grid
    ├── IVPanelHeader.ts          # IV metric/slice toggles
    ├── renderFrameController.ts  # RAF + ResizeObserver wrapper
    └── spotPricePlugin.ts        # Chart.js spot price overlay
```

Heatmap rendering for this page (and others) lives in [`../charts/types/HeatmapChart.ts`](../charts/types/HeatmapChart.ts) plus its split renderer/decorations/tooltip/interpolation modules under `charts/types/`.

## Dependency Direction

This page depends on backend network calls, frontend chart primitives, and saved view persistence stores. Keep domain calculations in backend or shared layers unless the behavior is purely presentational.

## Related Topic Docs

- [`../ui-and-charting.md`](../ui-and-charting.md)
- [`../../backend/core/network/network-and-auth.md`](../../backend/core/network/network-and-auth.md)
- [`../../backend/core/db/STORAGE.md`](../../backend/core/db/STORAGE.md)

## When Editing Here Also Read

- Read [`../../backend/core/network/README.md`](../../backend/core/network/README.md) before changing request shape or chain-loading semantics.
- Read [`../analysis_optionFlow/README.md`](../analysis_optionFlow/README.md) when a saved view or monitor contract is shared.
