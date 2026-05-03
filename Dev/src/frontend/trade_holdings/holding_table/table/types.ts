import type { HoldingsTableColumnId } from "../../../../shared/types/holdingsTableColumns";

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
