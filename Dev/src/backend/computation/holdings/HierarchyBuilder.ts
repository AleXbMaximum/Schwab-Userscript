import type{ HoldingsGroup, HoldingsResponse } from "../../../shared/types/holdings";
import type{
  AssetClassBlock,
  DerivedState,
  HierarchicalHoldings,
  UnderlyingKey,
  WarningState,
} from "../../../shared/types/derived";
import type { HoldingsIndex } from "../../pipeline/ingestion/holdingsIndexTypes";
import {
  buildTickerBlock,
  processRow,
  type TickerBucket,
} from "./hierarchyRowBuilders";
import {
  computeGrandTotal,
  computeGroupTotals,
  mergeBrokerTotals,
} from "./hierarchyTotals";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("holdings");

export class HierarchyBuilder {
  buildHierarchy(
    holdings: HoldingsResponse,
    holdingsIndex: HoldingsIndex,
    derivedState: DerivedState,
    warningState?: WarningState | null,
  ): HierarchicalHoldings {
    const assetClasses: AssetClassBlock[] = [];

    for (const account of holdings.accounts ?? []) {
      for (const group of account?.groupedPositions ?? []) {
        const assetBlock = this.buildAssetClassBlock(
          group,
          holdingsIndex,
          derivedState,
          warningState,
        );
        if (assetBlock) {
          assetClasses.push(assetBlock);
        }
      }
    }

    const grandTotal = computeGrandTotal(assetClasses, derivedState);

    const totalTickers = assetClasses.reduce(
      (n, b) => n + b.tickers.length,
      0,
    );
    log.debug("hierarchy.build.done", () => ({
      assetClasses: assetClasses.length,
      tickers: totalTickers,
    }));

    return {
      asOfTs: derivedState.asOfTs ?? Date.now(),
      assetClasses,
      grandTotal,
    };
  }

  private buildAssetClassBlock(
    group: HoldingsGroup,
    _holdingsIndex: HoldingsIndex,
    derivedState: DerivedState,
    warningState?: WarningState | null,
  ): AssetClassBlock | null {
    const groupName = group.groupName ?? "Unknown";
    const holdingsRows = group.holdingsRows ?? [];

    const tickerMap = new Map<UnderlyingKey, TickerBucket>();

    for (const row of holdingsRows) {
      processRow(row, null, tickerMap);

      if (row.childRows?.length) {
        const parentSymbol = ((row as any)?.symbol?.symbol ??
          (row as any)?.dataSymbol ??
          null) as string | null;
        for (const child of row.childRows) {
          processRow(child, parentSymbol, tickerMap);
        }
      }
    }

    const tickers = Array.from(tickerMap.entries()).map(
      ([underlyingKey, bucket]) => {
        return buildTickerBlock(
          underlyingKey,
          bucket.equityInfoRow,
          bucket.positions,
          derivedState,
          warningState,
        );
      },
    );

    tickers.sort((a, b) => a.underlyingKey.localeCompare(b.underlyingKey));

    const computed = computeGroupTotals(tickers, derivedState);
    const totals =
      computed.holdingCount > 0
        ? computed
        : mergeBrokerTotals(computed, group.totals);

    return {
      groupName,
      totals,
      tickers,
    };
  }
}
