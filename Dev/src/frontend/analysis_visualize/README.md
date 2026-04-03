# Frontend Analysis — Visualize

## Purpose

`frontend/analysis_visualize/` owns holdings-driven visualization views such as moving beta, cross-asset matrices, overlay charts, and portfolio bubble charts.

## Directory Structure

```
analysis_visualize/
├── page.ts                              # Page orchestrator; 3-col grid layout
├── portfolio/                           # Portfolio-level bubble charts
│   ├── DayChangeBubble.ts               # Day P&L bubble chart
│   └── GainLossBubble.ts               # Gain/loss bubble chart
├── heatmap/                             # Cross-asset correlation/beta heatmap
│   ├── CorrelationBetaHeatmap.ts        # Main heatmap component
│   ├── AxisTickerManager.ts             # Drag-drop ticker selector UI
│   ├── HeatmapDataPipeline.ts           # Bar fetching + matrix computation
│   └── HeatmapStorage.ts               # IndexedDB persistence for ticker config
└── timeseries/                          # Time-series chart components
    ├── dual_overlay/
    │   └── DualTickerOverlay.ts         # Dual-axis price overlay chart
    └── moving_beta/
        ├── MovingBetaChart.ts           # Rolling beta/correlation line chart
        ├── MovingBetaControls.ts        # Axis section UI (watchlist/indicator chips)
        └── MovingBetaStorage.ts         # IndexedDB persistence for ticker config
```

## Owns

- Visualize page layout in `page.ts`
- All visualization components within subdirectories
- Page-local watchlist and matrix storage helpers

## Does Not Own

- Beta calculation formulas
- Global chart token ownership
- Holdings ingestion

## Dependency Direction

The visualize page consumes derived holdings and beta data from backend orchestration and uses frontend chart primitives for rendering. Keep model ownership outside this page.

## Related Topic Docs

- [`../ui-and-charting.md`](../ui-and-charting.md)
- [`../../backend/pipeline/holdings-pipeline.md`](../../backend/pipeline/holdings-pipeline.md)
- [`../../backend/core/db/STORAGE.md`](../../backend/core/db/STORAGE.md)

## When Editing Here Also Read

- Read [`../../backend/computation/README.md`](../../backend/computation/README.md) before changing how chart inputs are computed.
- Read [`../ui-and-charting.md`](../ui-and-charting.md) before changing shared chart rendering contracts or panel lifecycles.
