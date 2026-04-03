import type{ HoldingsRow } from "../../../shared/types/holdings";
import type{ HoldingsKey, UnderlyingKey } from "../../../shared/types/derived";

export type HoldingsIndexEntry = {
  row: HoldingsRow;
  parentEquitySymbol: string | null;
  underlyingKey: UnderlyingKey | null;
};

export type HoldingsIndex = Map<HoldingsKey, HoldingsIndexEntry>;

export type SymbolMap = Map<string, HoldingsRow>;
