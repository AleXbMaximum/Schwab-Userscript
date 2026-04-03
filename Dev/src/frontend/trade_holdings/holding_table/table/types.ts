import type { HoldingsTableColumnId } from "../../../../shared/holdingsTableColumns";

export interface VirtualRowBuilderConfig {
  displayColumnIds: HoldingsTableColumnId[];
  displayBaseIndices: number[];
  neededBaseIndicesSet: Set<number>;
  expandedUnderlyings: Set<string>;
  getCurrentSortState: () => {
    colId: HoldingsTableColumnId | null;
    asc: boolean;
  };
}
