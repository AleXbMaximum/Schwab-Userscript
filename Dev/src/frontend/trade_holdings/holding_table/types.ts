import type{
  ChangeToken,
  DerivedState,
  HierarchicalHoldings,
  WarningState,
} from "shared/types/derived";
import type{ QuoteItem } from "shared/types/holdings";
import type { HoldingsTableColumnId } from "shared/holdingsTableColumns";

export type SortState = {
  colId: HoldingsTableColumnId | null;
  asc: boolean;
};

export type RowLinkKind = "stock" | "options";

export interface AssetBadges {
  hasEquity: boolean;
  buyPut: number;
  sellPut: number;
  buyCall: number;
  sellCall: number;
}

export interface RowRenderData {
  key: string;
  type: "group" | "data";
  values: Map<HoldingsTableColumnId, string>;
  isChild?: boolean;
  isSummary?: boolean;
  isShort?: boolean;
  groupName?: string;
  totals?: any;
  linkTarget?: string | null;
  linkKind?: RowLinkKind;
  assetBadges?: AssetBadges | null;
  badgeSignature?: string;
  isMajorGroup?: boolean;
}

export interface TableActionsConfig {
  onNews: (symbol: string) => void;
  onAIAnalysis?: (symbol: string) => void;
  onCompanyDetails?: (symbol: string) => void;
}

export type TableUpdateContext = {
  hierarchy: HierarchicalHoldings | null;
  derived?: DerivedState | null;
  warnings?: WarningState | null;
  changeToken?: ChangeToken | null;
  sortState?: SortState;
  quotesBySymbol?: Record<string, QuoteItem>;
};
