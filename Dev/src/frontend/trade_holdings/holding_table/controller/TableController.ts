import type { HoldingsTableColumnId } from "../../../../shared/holdingsTableColumns";
import {
  DEFAULT_HOLDINGS_TABLE_COLUMN_ORDER,
  normalizeHoldingsTableColumnOrder,
} from "../../../../shared/holdingsTableColumns";
import { BASE_INDEX_BY_ID } from "../table/columnMetadata";
import type {
  RowRenderData,
  SortState,
  TableActionsConfig,
  TableUpdateContext,
} from "../types";
import { createTableHeaderBindings } from "./tableHeader";
import { patchSummaryActionCell } from "./summaryActions";
import { FlashAnimator } from "../render/FlashAnimator";
import { TableReconciler } from "../render/TableReconciler";
import { ColumnWidthCalculator } from "../utils/ColumnWidthCalculator";
import { IntradaySparklineStore } from "../sparkline/IntradaySparklineStore";
import type { ChartDataService } from "../../../../backend/core/network/chart/ChartDataService";
import {
  buildVirtualRows,
} from "../table/buildVirtualRows";
import { getShareMode } from "shared/utils/globalShareMode";
import type { VirtualRowBuilderConfig } from "../table/types";
import { SparklineManager } from "../sparkline/SparklineManager";

export interface TableControllerOptions {
  chartDataService: ChartDataService;
  columnOrder?: unknown;
  onSortChange?: (sortState: SortState) => void;
  onColumnOrderChange?: (newOrder: HoldingsTableColumnId[]) => void;
  actionsConfig?: TableActionsConfig;
}

export interface TableController {
  table: HTMLTableElement;
  update: (ctx: TableUpdateContext) => void;
  exportJson: () => any;
  destroy: () => void;
  /** Access the intraday sparkline store for configuration (e.g. refresh interval). */
  sparklineStore: IntradaySparklineStore;
}

export function createTableController(
  options?: TableControllerOptions,
): TableController {
  const expandedUnderlyings = new Set<string>();

  const tbl = document.createElement("table");
  tbl.className = "ios-table";

  const orderedColumnIds = normalizeHoldingsTableColumnOrder(
    options?.columnOrder ?? DEFAULT_HOLDINGS_TABLE_COLUMN_ORDER,
  );

  let displayColumnIds = orderedColumnIds as HoldingsTableColumnId[];
  if (!displayColumnIds.includes("symbol")) displayColumnIds.push("symbol");
  displayColumnIds = [
    "symbol",
    ...(displayColumnIds.filter(
      (id) => id !== "symbol",
    ) as HoldingsTableColumnId[]),
  ];
  if (displayColumnIds.length === 0) displayColumnIds = ["symbol"];

  const displayBaseIndices = displayColumnIds.map(
    (id) => BASE_INDEX_BY_ID.get(id) ?? 0,
  );
  const neededBaseIndicesSet = new Set(displayBaseIndices);
  const actionsConfig = options?.actionsConfig;
  let currentSortState: SortState = { colId: null, asc: true };

  const headerBindings = createTableHeaderBindings({
    table: tbl,
    displayColumnIds,
    actionsConfig,
    onSortChange: (sortState) => {
      currentSortState = sortState;
      options?.onSortChange?.(sortState);
    },
    onColumnOrderChange: options?.onColumnOrderChange,
  });
  const {
    cols,
    headerRow,
    tbody,
    columnCount,
    symbolColumnIndex,
    setSortState,
  } = headerBindings;

  // Delegated click handler for summary row expand/collapse (replaces per-row onclick)
  tbody.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("a") || target.closest("button")) return;
    const tr = target.closest("tr");
    if (!tr) return;
    const underKey = tr.getAttribute("data-underlying");
    if (!underKey) return;
    if (expandedUnderlyings.has(underKey)) {
      expandedUnderlyings.delete(underKey);
    } else {
      expandedUnderlyings.add(underKey);
    }
    update(lastCtx!);
  });

  const flashAnimator = new FlashAnimator();
  const columnWidthCalculator = new ColumnWidthCalculator({
    columnIds: displayColumnIds,
    colElements: cols,
    headerRow,
    tbody,
  });
  const reconciler = new TableReconciler({
    tbody,
    columnIds: displayColumnIds,
    columnWidthCalculator,
    flashAnimator,
    hasStickyActions: !!actionsConfig,
  });

  let _lastVirtualRows: RowRenderData[] = [];
  let lastCtx: TableUpdateContext | undefined;

  // ── Sparkline management ───────────────────────────────────────
  const sparklineManager = new SparklineManager({
    chartDataService: options!.chartDataService,
    tbl,
    tbody,
    columnWidthCalculator,
    symbolColumnIndex,
  });

  // Incremental virtualRows cache (#11)
  let prevVirtualRowsByKey = new Map<string, RowRenderData>();
  let prevSortStateKey = "";
  let prevExpandedSnapshot = "";
  let prevShareModeKey = "";

  const virtualRowBuilderConfig: VirtualRowBuilderConfig = {
    displayColumnIds,
    displayBaseIndices,
    neededBaseIndicesSet,
    expandedUnderlyings,
    getCurrentSortState: () => currentSortState,
  };

  const update = (ctx: TableUpdateContext) => {
    lastCtx = ctx;

    if (ctx.sortState?.colId !== undefined) {
      currentSortState = ctx.sortState;
      setSortState(currentSortState);
    }

    // Determine if incremental path can be used (#11)
    const sortKey = `${currentSortState.colId ?? ""}:${currentSortState.asc}`;
    const expandKey = [...expandedUnderlyings].sort().join(",");
    const shareModeKey = getShareMode();
    const ct = ctx.changeToken;
    const useCache =
      ct &&
      !ct.fullRebuild &&
      prevVirtualRowsByKey.size > 0 &&
      sortKey === prevSortStateKey &&
      expandKey === prevExpandedSnapshot &&
      shareModeKey === prevShareModeKey;
    const needsSummarySymbolLayoutRecompute =
      sparklineManager.shouldRecomputeSummarySymbolLayout(ct ?? undefined);

    const virtualRows = buildVirtualRows(
      ctx,
      virtualRowBuilderConfig,
      useCache ? prevVirtualRowsByKey : undefined,
    );

    // Update cache
    prevVirtualRowsByKey.clear();
    for (const row of virtualRows) {
      prevVirtualRowsByKey.set(row.key, row);
    }
    prevSortStateKey = sortKey;
    prevExpandedSnapshot = expandKey;
    prevShareModeKey = shareModeKey;

    _lastVirtualRows = virtualRows;

    const patchedKeys = reconciler.reconcile(virtualRows);

    if (needsSummarySymbolLayoutRecompute) {
      sparklineManager.computeAndApplySummaryLayout(
        virtualRows,
        ct ?? undefined,
      );
    }
    // Symbol-column max is reset per frame inside reconcile(), so the
    // summary contribution must be re-pushed every update even when the
    // slot widths themselves did not change.
    sparklineManager.applySymbolColumnContribution();

    // Only process patched summary rows for action button creation.
    // Sticky-right and data-underlying are now handled by the reconciler's patchRow.
    // Expand/collapse click is handled by the delegated tbody handler.
    if (actionsConfig) {
      for (const key of patchedKeys) {
        const rowData = prevVirtualRowsByKey.get(key);
        if (!rowData?.isSummary) continue;
        const tr = reconciler.getRowElement(key);
        if (!tr) continue;
        const underKey = rowData.linkTarget ?? "";
        if (!underKey) continue;

        const actionCell = tr.cells[columnCount];
        if (actionCell) {
          patchSummaryActionCell(actionCell, underKey, actionsConfig);
        }
      }
    }

    // ── Sparkline: queue symbol fetches and paint available data ─────────
    sparklineManager.updateSparklines(virtualRows, ct ?? undefined);
  };

  const exportJson = () => {
    const hierarchy = lastCtx?.hierarchy;
    if (!hierarchy) return null;

    return {
      asOfTs: hierarchy.asOfTs,
      grandTotal: hierarchy.grandTotal,
      assetClasses: hierarchy.assetClasses.map((ac: any) => ({
        groupName: ac.groupName,
        totals: ac.totals,
        tickers: ac.tickers.map((ticker: any) => ({
          underlyingKey: ticker.underlyingKey,
          underlyingPrice: ticker.underlyingPrice,
          assetBadges: ticker.assetBadges,
          aggregated: {
            totalDeltaShares: ticker.aggregated.totalDeltaShares,
            totalGammaSharesPerDol: ticker.aggregated.totalGammaSharesPerDol,
            totalThetaPerDay: ticker.aggregated.totalThetaPerDay,
            totalVegaPerVolPoint: ticker.aggregated.totalVegaPerVolPoint,
            totalRhoPer1pctRate: ticker.aggregated.totalRhoPer1pctRate,
            totalMarginReqDol: ticker.aggregated.totalMarginReqDol,
            totalDayChangeDollar: ticker.aggregated.totalDayChangeDollar,
            totalGainLossDollar: ticker.aggregated.totalGainLossDollar,
            deltaNotionalDol: ticker.aggregated.deltaNotionalDol,
            betaNotionalDol:
              lastCtx?.derived?.byUnderlying?.[ticker.underlyingKey]
                ?.betaNotionalDol ?? null,
            betaNotionalConcentrationPct:
              lastCtx?.derived?.byUnderlying?.[ticker.underlyingKey]
                ?.betaNotionalConcentrationPct ?? null,
          },
          holdings: ticker.holdings.map((pos: any) => ({
            holdingsKey: pos.holdingsKey,
            kind: pos.kind,
            optionMeta: pos.optionMeta,
            symbol: pos.row?.symbol?.symbol ?? pos.row?.dataSymbol ?? null,
            qty: pos.row?.qty?.qty ?? pos.row?.qty?.val ?? null,
            marketValue: pos.row?.marketValue?.val ?? null,
            derived: pos.derived
              ? {
                  deltaShares: pos.derived.deltaShares,
                  gammaSharesPerDol: pos.derived.gammaSharesPerDol,
                  thetaPerDay: pos.derived.thetaPerDay,
                  vegaPerVolPoint: pos.derived.vegaPerVolPoint,
                  dte: pos.derived.dte,
                }
              : null,
            warnings: pos.warnings,
          })),
        })),
      })),
    };
  };

  const destroy = () => {
    flashAnimator.reset();
    columnWidthCalculator.destroy();
    reconciler.reset();
    sparklineManager.dispose();
  };

  return {
    table: tbl,
    update,
    exportJson,
    destroy,
    sparklineStore: sparklineManager.sparklineStore,
  };
}
