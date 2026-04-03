import type { RowRenderData, TableUpdateContext } from "../types";
import { buildGroupRow, buildHoldingsRow, buildTickerSummaryRow } from "./rowFactories";
import { sortTickerBlocks } from "./sortHelpers";
import type { VirtualRowBuilderConfig } from "./types";

export const buildVirtualRows = (
  ctx: TableUpdateContext,
  config: VirtualRowBuilderConfig,
  cache?: Map<string, RowRenderData>,
): RowRenderData[] => {
  const { displayColumnIds, expandedUnderlyings } = config;
  const currentSortState = config.getCurrentSortState();
  const hierarchy = ctx.hierarchy;
  if (!hierarchy) return [];

  const touchedUnderlyings = cache
    ? new Set<string>(ctx.changeToken?.touchedUnderlyingKeys ?? [])
    : null;

  const byUnderlying = ctx.derived?.byUnderlying ?? {};
  const totalAbsBetaNotional =
    ctx.derived?.portfolioAgg?.totalAbsBetaNotionalDol ?? 0;
  let totalBetaNotional = 0;
  for (const uk in byUnderlying) {
    totalBetaNotional += byUnderlying[uk].betaNotionalDol ?? 0;
  }

  const virtualRows: RowRenderData[] = [];

  for (const assetClass of hierarchy.assetClasses) {
    const groupKey = `group:${assetClass.groupName}`;
    const isMajorGroup = /Equity|ETF|Cash|Total Account/i.test(
      assetClass.groupName,
    );

    const groupTouched =
      !touchedUnderlyings ||
      assetClass.tickers.some((t) => touchedUnderlyings.has(t.underlyingKey));

    if (!groupTouched && cache?.has(groupKey)) {
      virtualRows.push(cache.get(groupKey)!);
    } else {
      let groupBetaNotional = 0;
      let groupAbsBetaNotional = 0;
      for (const ticker of assetClass.tickers) {
        const agg = byUnderlying[ticker.underlyingKey];
        const bn = agg?.betaNotionalDol ?? 0;
        groupBetaNotional += bn;
        groupAbsBetaNotional += Math.abs(bn);
      }
      const groupTotals = {
        ...assetClass.totals,
        betaNotionalDol: groupBetaNotional,
        betaNotionalConcentrationPct:
          totalAbsBetaNotional > 0
            ? groupAbsBetaNotional / totalAbsBetaNotional
            : null,
      };

      virtualRows.push({
        ...buildGroupRow(assetClass.groupName, groupTotals, displayColumnIds),
        isMajorGroup,
      });
    }

    // Pre-build all summary rows (from cache or fresh) before sorting
    const summaryMap = new Map<string, RowRenderData>();
    for (const ticker of assetClass.tickers) {
      const key = `parent:${ticker.underlyingKey}`;
      const isTouched =
        !touchedUnderlyings || touchedUnderlyings.has(ticker.underlyingKey);
      if (!isTouched && cache?.has(key)) {
        summaryMap.set(ticker.underlyingKey, cache.get(key)!);
      } else {
        summaryMap.set(
          ticker.underlyingKey,
          buildTickerSummaryRow(ticker, ctx, config),
        );
      }
    }

    let tickers = [...assetClass.tickers];
    if (currentSortState.colId) {
      tickers = sortTickerBlocks(tickers, currentSortState, summaryMap);
    }

    for (const ticker of tickers) {
      const isTouched =
        !touchedUnderlyings || touchedUnderlyings.has(ticker.underlyingKey);

      virtualRows.push(summaryMap.get(ticker.underlyingKey)!);

      if (expandedUnderlyings.has(ticker.underlyingKey)) {
        if (!isTouched && cache) {
          for (const pos of ticker.holdings) {
            const cachedChild = cache.get(`child:${pos.holdingsKey}`);
            if (cachedChild) virtualRows.push(cachedChild);
          }
        } else {
          for (const pos of ticker.holdings) {
            const childRow = buildHoldingsRow(
              pos,
              ticker.underlyingKey,
              ctx,
              config,
            );
            virtualRows.push(childRow);
          }
        }
      }
    }
  }

  // Grand total always rebuilt (aggregates may change with any update)
  const grandTotalKey = "group:Total Account";
  const grandTotals = {
    ...hierarchy.grandTotal,
    betaNotionalDol: totalBetaNotional,
    betaNotionalConcentrationPct: totalAbsBetaNotional > 0 ? 1 : null,
  };

  virtualRows.push({
    ...buildGroupRow("Total Account", grandTotals, displayColumnIds),
    key: grandTotalKey,
    isMajorGroup: true,
  });

  return virtualRows;
};
