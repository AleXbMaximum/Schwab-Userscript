import type{ HoldingsRow } from "shared/types/holdings";
import { formatHoldingsRowDisplayValues } from "../formatting/holdingsRowFormatter";
import type { TableUpdateContext } from "../types";
import { getDerivedRow } from "./derivedRow";
import { getWarningCell } from "./warningCell";

const lookupQuoteData = (
  symbol: string | null | undefined,
  ctx: TableUpdateContext | undefined,
): any | null => {
  if (!symbol || !ctx?.quotesBySymbol) return null;
  return ctx.quotesBySymbol[symbol] ?? null;
};

const mergeQuoteFields = (derived: any, quoteItem: any): any => {
  if (!quoteItem) return derived;
  const q = quoteItem.quote;
  const ref = quoteItem.reference;
  const extra: any = {};
  if (q?.priceLow52W != null) extra.__priceLow52W = q.priceLow52W;
  if (q?.priceHigh52W != null) extra.__priceHigh52W = q.priceHigh52W;
  if (q?.__overnightPrice != null) extra.__overnightPrice = q.__overnightPrice;
  if (q?.__overnightChangeDollar != null)
    extra.__overnightChangeDollar = q.__overnightChangeDollar;
  if (q?.__overnightChangePercent != null)
    extra.__overnightChangePercent = q.__overnightChangePercent;
  if (q?.lastPrice != null) extra.__afterHoursPrice = q.lastPrice;
  if (q?.postMarketChange != null) extra.__postMarketChg = q.postMarketChange;
  if (q?.postMarketPercentChange != null)
    extra.__postMarketChgPct = q.postMarketPercentChange;
  if (ref?.assetType != null) extra.__assetType = ref.assetType;
  if (ref?.exchangeName != null) extra.__exchangeName = ref.exchangeName;
  return derived ? { ...derived, ...extra } : extra;
};

/**
 * Merge pre-computed beta fields from UnderlyingAggRow into the derived display object.
 * For per-row display: betaNotionalDol = row deltaNotionalDol × underlying shortBeta.
 * For summary rows: values already present via the underlyingAgg overlay.
 */
const mergeBetaFields = (
  derived: any,
  underlyingSym: string | null | undefined,
  ctx: TableUpdateContext | undefined,
): any => {
  if (!underlyingSym || !ctx?.derived) return derived;
  const agg = ctx.derived.byUnderlying?.[underlyingSym];
  if (!agg) return derived;

  const extra: any = {};
  if (agg.betaUltraShort != null) extra.betaUltraShort = agg.betaUltraShort;
  if (agg.betaWeek != null) extra.betaWeek = agg.betaWeek;
  if (agg.betaShort != null) extra.betaShort = agg.betaShort;
  if (agg.betaMedium != null) extra.betaMedium = agg.betaMedium;
  if (agg.betaLong != null) extra.betaLong = agg.betaLong;

  const deltaNotional = derived?.deltaNotionalDol;
  if (
    typeof deltaNotional === "number" &&
    Number.isFinite(deltaNotional) &&
    agg.betaShort != null
  ) {
    extra.betaNotionalDol = deltaNotional * agg.betaShort;
  }

  const totalAbsBeta = ctx.derived.portfolioAgg?.totalAbsBetaNotionalDol;
  if (
    extra.betaNotionalDol != null &&
    totalAbsBeta != null &&
    totalAbsBeta > 0
  ) {
    extra.betaNotionalConcentrationPct =
      Math.abs(extra.betaNotionalDol) / totalAbsBeta;
  }

  if (Object.keys(extra).length === 0) return derived;
  return derived ? { ...derived, ...extra } : extra;
};

export const getRowValuesWithContext = (
  row: HoldingsRow,
  isChild: boolean,
  parentEquitySymbol: string | null,
  ctx: TableUpdateContext | undefined,
  neededIndices?: Set<number>,
) => {
  const isSummaryRow = !!(row as any)?.__isUnderlyingSummary;

  if (isSummaryRow) {
    const summaryRow: any = row as any;
    const equityRow: HoldingsRow | null = summaryRow.__equityRow ?? null;
    const baseRowForDisplay: any = equityRow
      ? { ...(equityRow as any), __isUnderlyingSummary: true }
      : row;

    const underlyingAgg = summaryRow.__summaryDerived ?? null;
    const equityDerived = equityRow
      ? getDerivedRow(equityRow, ctx, null)
      : null;

    let derivedOverride = underlyingAgg
      ? { ...equityDerived, ...underlyingAgg }
      : (equityDerived ?? getDerivedRow(row, ctx, parentEquitySymbol));

    const quoteItem = lookupQuoteData(
      summaryRow.__underlyingKey ?? parentEquitySymbol,
      ctx,
    );
    derivedOverride = mergeQuoteFields(derivedOverride, quoteItem);

    const summarySymbol = summaryRow.__underlyingKey ?? parentEquitySymbol;
    derivedOverride = mergeBetaFields(derivedOverride, summarySymbol, ctx);

    const warningOverride =
      summaryRow.__equityWarning ??
      (equityRow
        ? getWarningCell(
            equityRow,
            summaryRow.__underlyingKey ?? parentEquitySymbol,
            ctx,
          )
        : getWarningCell(row, parentEquitySymbol, ctx));

    return formatHoldingsRowDisplayValues(
      baseRowForDisplay as any,
      false,
      derivedOverride,
      warningOverride,
      neededIndices,
    );
  }

  let derived = getDerivedRow(row, ctx, parentEquitySymbol);
  const warning = getWarningCell(row, parentEquitySymbol, ctx);

  const sym =
    row.symbol?.symbol || (row as any).dataSymbol || parentEquitySymbol;
  const quoteItem = lookupQuoteData(sym, ctx);
  derived = mergeQuoteFields(derived, quoteItem);
  const betaSym = parentEquitySymbol ?? sym;
  derived = mergeBetaFields(derived, betaSym, ctx);

  return formatHoldingsRowDisplayValues(
    row as any,
    isChild,
    derived,
    warning,
    neededIndices,
  );
};
