import type { HoldingsTableColumnId } from "../../../../shared/types/holdingsTableColumns";
import type { RowRenderData, TableUpdateContext } from "../types";
import { formatGroupTotalsDisplayValues as buildGroupDisplayValues } from "../formatting/groupTotalsFormatter";
import { getVal } from "../utils/valueAccess";
import { buildBadgeSignature } from "./assetBadges";
import { getRowValuesWithContext } from "./rowValues";
import type { VirtualRowBuilderConfig } from "./types";

export const buildTickerSummaryRow = (
  ticker: any,
  ctx: TableUpdateContext,
  config: VirtualRowBuilderConfig,
): RowRenderData => {
  const { displayColumnIds, displayBaseIndices, neededBaseIndicesSet } = config;
  const underKey = ticker.underlyingKey;
  const agg = ticker.aggregated;
  const equityRow = ticker.equityInfoRow;
  const underAgg = ctx.derived?.byUnderlying?.[underKey];
  const summaryDerived = {
    ...(agg ?? {}),
    betaNotionalDol: underAgg?.betaNotionalDol ?? null,
    betaNotionalConcentrationPct:
      underAgg?.betaNotionalConcentrationPct ?? null,
  };

  const priceVal = equityRow
    ? (getVal(equityRow as any, "lastPrice.val") ??
      getVal(equityRow as any, "price.price") ??
      getVal(equityRow as any, "price.val"))
    : (agg?.underlyingPrice ?? null);

  const syntheticRow = {
    __isUnderlyingSummary: true,
    __underlyingKey: underKey,
    __equityRow: equityRow ?? null,
    __summaryDerived: summaryDerived,
    symbol: { symbol: underKey },
    lastPrice: { val: priceVal },
    ...(equityRow
      ? {
          price: equityRow.price,
          bid: equityRow.bid,
          ask: equityRow.ask,
          bidSize: equityRow.bidSize,
          askSize: equityRow.askSize,
          lastSize: (equityRow as any).lastSize,
          description: equityRow.description,
          priceChng: equityRow.priceChng,
          priceChngPrc: equityRow.priceChngPrc,
          dayChange: equityRow.dayChange,
          dayChngPerc: equityRow.dayChngPerc,
          ratings: (equityRow as any).ratings,
          peRatio: (equityRow as any).peRatio,
          dividendYield: (equityRow as any).dividendYield,
          divYield: (equityRow as any).divYield,
          reinvestDtl: equityRow.reinvestDtl,
          dayLow: equityRow.dayLow,
          dayHigh: equityRow.dayHigh,
          closePrice: equityRow.closePrice,
          openPrice: equityRow.openPrice,
        }
      : {}),
  };

  const vals = getRowValuesWithContext(
    syntheticRow as any,
    false,
    null,
    ctx,
    neededBaseIndicesSet,
  );
  const values = new Map<HoldingsTableColumnId, string>();
  displayColumnIds.forEach((colId, idx) => {
    const baseIdx = displayBaseIndices[idx];
    values.set(colId, String(vals[baseIdx] ?? "-"));
  });

  const totalMv = agg?.totalMarketValue;
  const isSummaryShort = typeof totalMv === "number" && totalMv < 0;

  return {
    key: `parent:${underKey}`,
    type: "data",
    values,
    isSummary: true,
    isShort: isSummaryShort,
    linkTarget: underKey,
    linkKind: "stock",
    assetBadges: ticker.assetBadges,
    badgeSignature: buildBadgeSignature(ticker.assetBadges),
  };
};

export const buildHoldingsRow = (
  pos: any,
  parentSymbol: string,
  ctx: TableUpdateContext,
  config: VirtualRowBuilderConfig,
): RowRenderData => {
  const { displayColumnIds, displayBaseIndices, neededBaseIndicesSet } = config;
  const row = pos.row;
  const vals = getRowValuesWithContext(
    row,
    true,
    parentSymbol,
    ctx,
    neededBaseIndicesSet,
  );
  const values = new Map<HoldingsTableColumnId, string>();
  displayColumnIds.forEach((colId, idx) => {
    const baseIdx = displayBaseIndices[idx];
    values.set(colId, String(vals[baseIdx] ?? "-"));
  });

  const qty = getVal(row as any, "qty.qty") ?? getVal(row as any, "qty.val");
  const isShort = typeof qty === "number" && qty < 0;

  return {
    key: `child:${pos.holdingsKey}`,
    type: "data",
    values,
    isChild: true,
    isShort,
    linkTarget: parentSymbol,
    linkKind: pos.kind === "OPTION" ? "options" : "stock",
  };
};

export const buildGroupRow = (
  groupName: string,
  groupTotals: any,
  displayColumnIds: HoldingsTableColumnId[],
): RowRenderData => {
  const values = new Map<HoldingsTableColumnId, string>();
  const groupDisplayVals = buildGroupDisplayValues(
    groupName,
    groupTotals,
    displayColumnIds,
  );
  displayColumnIds.forEach((colId, idx) => {
    values.set(colId, String(groupDisplayVals[idx] ?? "-"));
  });

  return {
    key: `group:${groupName}`,
    type: "group",
    values,
    groupName,
    totals: groupTotals,
  };
};
