import type{ HoldingsResponse, HoldingsRow } from "../../../shared/types/holdings";
import {
  getHoldingsKey,
  getStreamingKey,
  getUnderlyingKey,
} from "../../../shared/utils/domain/holdingsKeys";
import type {
  HoldingsIndex,
  HoldingsIndexEntry,
  SymbolMap,
} from "./holdingsIndexTypes";

export type { HoldingsIndex, HoldingsIndexEntry, SymbolMap };

export class HoldingsIndexBuilder {
  buildHoldingsIndex(holdings: HoldingsResponse): HoldingsIndex {
    return this.buildIndexAndSymbolMap(holdings).index;
  }

  buildSymbolMap(holdings: HoldingsResponse): SymbolMap {
    return this.buildIndexAndSymbolMap(holdings).symbolMap;
  }

  /**
   * Single-pass construction of both HoldingsIndex and SymbolMap.
   * Avoids the redundant triple-nested iteration that occurs when
   * buildHoldingsIndex and buildSymbolMap are called separately.
   */
  buildIndexAndSymbolMap(holdings: HoldingsResponse): {
    index: HoldingsIndex;
    symbolMap: SymbolMap;
  } {
    const index: HoldingsIndex = new Map();
    const symbolMap: SymbolMap = new Map();

    if (!holdings?.accounts?.length) {
      return { index, symbolMap };
    }

    for (const account of holdings.accounts) {
      for (const group of account?.groupedPositions ?? []) {
        if (!group.holdingsRows) continue;

        for (const row of group.holdingsRows) {
          const parentSymbol = this.extractParentSymbol(row);

          this.indexRow(index, row, null);
          this.mapSymbol(symbolMap, row);

          if (row.childRows) {
            for (const child of row.childRows) {
              this.indexRow(index, child, parentSymbol);
              this.mapSymbol(symbolMap, child);
            }
          }
        }
      }
    }

    return { index, symbolMap };
  }

  private indexRow(
    index: HoldingsIndex,
    row: HoldingsRow,
    parentEquitySymbol: string | null,
  ): void {
    const holdingsKey = getHoldingsKey(row);
    if (!holdingsKey) return;

    const underlyingKey = getUnderlyingKey(row, parentEquitySymbol);

    index.set(holdingsKey, {
      row,
      parentEquitySymbol,
      underlyingKey: underlyingKey ?? null,
    });
  }

  private mapSymbol(symbolMap: SymbolMap, row: HoldingsRow): void {
    const streamingKey = getStreamingKey(row);
    if (streamingKey) {
      symbolMap.set(streamingKey, row);
    }
  }

  private extractParentSymbol(row: HoldingsRow): string | null {
    const resolvedSymbol =
      (row as any)?.symbol?.symbol ?? (row as any)?.dataSymbol ?? null;
    return typeof resolvedSymbol === "string" && resolvedSymbol.trim()
      ? resolvedSymbol.trim()
      : null;
  }
}
