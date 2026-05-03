import type{ DerivedMetricsRow, WarningCell } from "shared/types/derived";
import { isOption } from "../../../../shared/utils/domain/holdingsKeys";
import { toFiniteNumberOrNull as asNumberOrNull } from "../../../../backend/core/network/schwab/parsing/numberParsers";
import {
  formatOptionSymbol,
  formatCurrency,
  formatPlainOrDash,
  formatQty,
  normalizeSingleLine,
} from "./cellFormatters";
import { formatPct } from "shared/utils/format/formatters";
import { getVal } from "../utils/valueAccess";
import {
  DASH,
  formatGreek,
  formatIntOrDash,
  formatNumOrDash,
  formatPctOrDash,
} from "./shared";
import {
  DISPLAY_SYMBOL_ALIASES,
  computeMarginReqDisplay,
  extractSummaryTotals,
  makeColumnGates,
  makeShareModeHelpers,
} from "./holdingsRowContext";
import { formatSensitivityCells } from "./holdingsRowSensitivityCells";

export function formatHoldingsRowDisplayValues(
  d: any,
  isChild: boolean,
  derivedOverride: DerivedMetricsRow | null = null,
  warningOverride: WarningCell | null = null,
  neededIndices?: Set<number>,
): string[] {
  const skip = neededIndices ? (i: number) => !neededIndices.has(i) : null;

  let displaySymbol = d.symbol?.symbol || d.dataSymbol || "";
  displaySymbol = DISPLAY_SYMBOL_ALIASES[displaySymbol] ?? displaySymbol;
  const isOptionRow = isOption(d);

  if (isChild) {
    displaySymbol = isOptionRow ? formatOptionSymbol(displaySymbol) : "Equity";
  }

  const name = d.description?.lbl ?? d.name ?? "";

  const price =
    getVal(d, "price.price") ??
    getVal(d, "price.val") ??
    getVal(d, "lastPrice.val");

  const bid = getVal(d, "bid.val");
  const ask = getVal(d, "ask.val");
  const bidSize = getVal(d, "bidSize.val");
  const askSize = getVal(d, "askSize.val");
  const last = getVal(d, "lastPrice.val") ?? price;
  const lastSize = getVal(d, "lastSize.val");
  const open = getVal(d, "openPrice.val") ?? getVal(d, "open.val");

  const pctOfAcctVal = getVal(d, "pctOfAcct.val");
  const pctOfAcctLbl = d.pctOfAcct?.lbl;
  const pctOfAcctNum = asNumberOrNull(pctOfAcctVal);
  const pctOfAcctDisplay =
    pctOfAcctNum != null
      ? formatPct(pctOfAcctNum, { decimals: 2 })
      : pctOfAcctLbl != null
        ? normalizeSingleLine(pctOfAcctLbl)
        : DASH;

  const derived = derivedOverride ?? null;
  const warning = warningOverride ?? null;
  const warningText =
    warning?.level && warning.level !== "none"
      ? warning.text || warning.level
      : DASH;

  const derivedAny = derived as any;
  const isSummaryRow = !!(d as any)?.__isUnderlyingSummary;

  const marginReqDisplay = computeMarginReqDisplay(d, derivedAny, isSummaryRow);

  const peRatio = getVal(d, "peRatio.val");
  const divYield = getVal(d, "dividendYield.val") ?? getVal(d, "divYield.val");
  const openInterestDisplay = formatIntOrDash(getVal(d, "openInterest.val"));

  const totals = extractSummaryTotals(derivedAny, isSummaryRow);
  const summaryDelta = totals.delta;
  const summaryGamma = totals.gamma;
  const summaryTheta = totals.theta;
  const summaryVega = totals.vega;
  const summaryRho = totals.rho;
  const summaryMarketValue = totals.marketValue;
  const summaryCostBasis = totals.costBasis;

  const { summaryOnly, suppressOnSummary, optionOnly } = makeColumnGates(
    isSummaryRow,
    isOptionRow,
  );

  const s = skip;

  const { pv, sv } = makeShareModeHelpers();

  return [
    /* 0  */ s?.(0) ? DASH : displaySymbol,
    /* 1  */ s?.(1) ? DASH : formatPlainOrDash(name),
    /* 2  */ s?.(2) ? DASH : formatCurrency(price),
    /* 3  */ s?.(3) ? DASH : formatCurrency(bid),
    /* 4  */ s?.(4) ? DASH : formatCurrency(ask),
    /* 5  */ s?.(5) ? DASH : formatIntOrDash(bidSize),
    /* 6  */ s?.(6) ? DASH : formatIntOrDash(askSize),
    /* 7  */ s?.(7) ? DASH : formatCurrency(last),
    /* 8  */ s?.(8) ? DASH : formatIntOrDash(lastSize),
    /* 9  */ s?.(9) ? DASH : formatCurrency(open),
    /* 10 */ s?.(10) ? DASH : formatCurrency(getVal(d, "costBasis.cstPerShr")),
    /* 11 */ s?.(11)
      ? DASH
      : formatPctOrDash(getVal(d, "priceChngPrc.val"), { showSign: true }),
    /* 12 */ s?.(12)
      ? DASH
      : formatNumOrDash(getVal(d, "priceChng.val"), { showSign: true }),
    /* 13 */ s?.(13)
      ? DASH
      : isSummaryRow && derivedAny?.dayChangePercent != null
        ? formatPctOrDash(derivedAny.dayChangePercent, { showSign: true })
        : formatPctOrDash(getVal(d, "dayChngPerc.val"), { showSign: true }),
    /* 14 */ s?.(14)
      ? DASH
      : pv(
          isSummaryRow && derivedAny?.totalDayChangeDollar != null
            ? formatNumOrDash(sv(derivedAny.totalDayChangeDollar), {
                showSign: true,
              })
            : formatNumOrDash(sv(getVal(d, "dayChange.val") as number | null), {
                showSign: true,
              }),
        ),
    /* 15 */ s?.(15)
      ? DASH
      : pv(
          formatQty(
            sv(
              (getVal(d, "qty.qty") ??
                getVal(d, "qty.val") ??
                getVal(d, "qty.qtyBeforeSplt")) as number | null,
            ),
          ),
        ),
    /* 16 */ s?.(16)
      ? DASH
      : pv(
          isSummaryRow && derivedAny?.totalGainLossDollar != null
            ? formatNumOrDash(sv(derivedAny.totalGainLossDollar), {
                showSign: true,
              })
            : formatNumOrDash(
                sv(
                  (getVal(d, "gainLoss.gainLossDlr") ??
                    getVal(d, "gainLoss.val")) as number | null,
                ),
                { showSign: true },
              ),
        ),
    /* 17 */ s?.(17)
      ? DASH
      : isSummaryRow && derivedAny?.gainLossPercent != null
        ? formatPctOrDash(derivedAny.gainLossPercent, { showSign: true })
        : formatPctOrDash(getVal(d, "gainLoss.gainLossPct"), {
            showSign: true,
          }),
    /* 18 */ s?.(18)
      ? DASH
      : pv(
          isSummaryRow && summaryMarketValue != null
            ? formatCurrency(sv(summaryMarketValue))
            : formatCurrency(sv(getVal(d, "marketValue.val") as number | null)),
        ),
    /* 19 */ s?.(19) ? DASH : pctOfAcctDisplay,
    /* 20 */ s?.(20) ? DASH : marginReqDisplay,
    /* 21 */ s?.(21) ? DASH : d.ratings?.lbl || (isChild ? "-" : ""),
    /* 22 */ s?.(22)
      ? DASH
      : pv(
          isSummaryRow && summaryCostBasis != null
            ? formatCurrency(sv(summaryCostBasis))
            : formatCurrency(
                sv(getVal(d, "costBasis.cstBasis") as number | null),
              ),
        ),
    /* 23 */ s?.(23) ? DASH : peRatio != null ? formatNumOrDash(peRatio) : DASH,
    /* 24 */ s?.(24)
      ? DASH
      : divYield != null && divYield !== "N/A"
        ? formatPct(divYield, { decimals: 2 })
        : DASH,
    /* 25 */ s?.(25)
      ? DASH
      : (() => {
          const vv = getVal(d, "volume.val");
          return formatIntOrDash(
            typeof vv === "number" && Number.isFinite(vv) ? vv : null,
          );
        })(),
    /* 26 */ s?.(26)
      ? DASH
      : (() => {
          if (isSummaryRow && summaryDelta != null) return formatGreek(summaryDelta);
          if (!isOptionRow) return formatGreek(1);
          return formatGreek(getVal(d, "delta.val"));
        })(),
    /* 27 */ s?.(27)
      ? DASH
      : (() => {
          if (isSummaryRow && summaryGamma != null) return formatGreek(summaryGamma);
          if (!isOptionRow) return DASH;
          return formatGreek(getVal(d, "gamma.val"));
        })(),
    /* 28 */ s?.(28)
      ? DASH
      : (() => {
          if (isSummaryRow && summaryTheta != null) return formatGreek(summaryTheta);
          if (!isOptionRow) return DASH;
          return formatGreek(getVal(d, "theta.val"));
        })(),
    /* 29 */ s?.(29)
      ? DASH
      : (() => {
          if (isSummaryRow && summaryVega != null) return formatGreek(summaryVega);
          if (!isOptionRow) return DASH;
          return formatGreek(getVal(d, "vega.val"));
        })(),
    /* 30 */ s?.(30)
      ? DASH
      : (() => {
          if (isSummaryRow && summaryRho != null) return formatGreek(summaryRho);
          if (!isOptionRow) return DASH;
          return formatGreek(getVal(d, "rho.val"));
        })(),
    /* 31 */ s?.(31) ? DASH : openInterestDisplay,
    /* 32 */ s?.(32) ? DASH : d.reinvestDtl?.dividend || DASH,
    /* 33 */ s?.(33) ? DASH : formatCurrency(getVal(d, "dayLow.val")),
    /* 34 */ s?.(34) ? DASH : formatCurrency(getVal(d, "dayHigh.val")),
    /* 35 */ s?.(35)
      ? DASH
      : formatCurrency(getVal(d, "closePrice.val") ?? getVal(d, "close.val")),
    /* 36 */ s?.(36) ? DASH : formatCurrency(derivedAny?.mid, { decimals: 2 }),
    /* 37 */ s?.(37)
      ? DASH
      : formatCurrency(derivedAny?.spreadDol, { decimals: 2, showSign: true }),
    /* 38 */ s?.(38)
      ? DASH
      : formatPctOrDash(derivedAny?.spreadPct, {
          decimals: 2,
          showSign: true,
        }),
    /* 39 */ s?.(39)
      ? DASH
      : formatNumOrDash(derivedAny?.quoteImbalance, {
          decimals: 4,
          showSign: true,
        }),
    /* 40 */ s?.(40)
      ? DASH
      : formatCurrency(derivedAny?.dayRangeDol, { decimals: 2 }),
    /* 41 */ s?.(41)
      ? DASH
      : formatPctOrDash(derivedAny?.dayRangePct, {
          decimals: 2,
          showSign: true,
        }),
    ...formatSensitivityCells({
      s,
      derivedAny,
      isSummaryRow,
      summaryGamma,
      summaryTheta,
      summaryVega,
      summaryRho,
      pv,
      sv,
      optionOnly,
      suppressOnSummary,
    }),
    /* 59 */ s?.(59)
      ? DASH
      : summaryOnly(
          "carryToStress",
          formatNumOrDash(derivedAny?.carryToStress, {
            decimals: 4,
            showSign: true,
          }),
        ),
    /* 60 */ s?.(60)
      ? DASH
      : suppressOnSummary(
          "marginReqReason",
          formatPlainOrDash(derivedAny?.marginReqReason),
        ),
    /* 61 */ s?.(61)
      ? DASH
      : suppressOnSummary(
          "marginToUnderlyingNotional",
          formatPctOrDash(derivedAny?.marginToUnderlyingNotional, {
            decimals: 2,
            showSign: true,
          }),
        ),
    /* 62 */ s?.(62)
      ? DASH
      : pv(
          formatCurrency(sv(derivedAny?.deltaNotionalDol), {
            decimals: 2,
            showSign: true,
          }),
        ),
    /* 63 */ s?.(63)
      ? DASH
      : formatPctOrDash(derivedAny?.deltaNotionalConcentrationPct, {
          decimals: 2,
          showSign: true,
        }),
    /* 64 */ s?.(64)
      ? DASH
      : pv(
          formatCurrency(sv(derivedAny?.betaNotionalDol), {
            decimals: 2,
            showSign: true,
          }),
        ),
    /* 65 */ s?.(65)
      ? DASH
      : formatPctOrDash(derivedAny?.betaNotionalConcentrationPct, {
          decimals: 2,
          showSign: true,
        }),
    /* 66 */ s?.(66)
      ? DASH
      : optionOnly(
          "vegaConcentrationPct",
          formatPctOrDash(derivedAny?.vegaConcentrationPct, {
            decimals: 2,
            showSign: true,
          }),
        ),
    /* 67 */ s?.(67)
      ? DASH
      : optionOnly(
          "gammaDensityNearTerm",
          formatNumOrDash(derivedAny?.gammaDensityNearTerm, {
            decimals: 4,
            showSign: true,
          }),
        ),
    /* 68 */ s?.(68)
      ? DASH
      : optionOnly(
          "gammaDensityWeighted",
          formatNumOrDash(derivedAny?.gammaDensityWeighted, {
            decimals: 4,
            showSign: true,
          }),
        ),
    /* 69 */ s?.(69)
      ? DASH
      : pv(
          formatCurrency(
            sv(
              isSummaryRow
                ? (derivedAny?.uPnlUp1PctDol ?? derivedAny?.pnlUp1PctDol)
                : derivedAny?.pnlUp1PctDol,
            ),
            { decimals: 2, showSign: true },
          ),
        ),
    /* 70 */ s?.(70)
      ? DASH
      : pv(
          formatCurrency(
            sv(
              isSummaryRow
                ? (derivedAny?.uPnlDn1PctDol ?? derivedAny?.pnlDn1PctDol)
                : derivedAny?.pnlDn1PctDol,
            ),
            { decimals: 2, showSign: true },
          ),
        ),
    /* 71 */ s?.(71)
      ? DASH
      : pv(
          formatCurrency(sv(derivedAny?.convexityDol), {
            decimals: 2,
            showSign: true,
          }),
        ),
    /* 72 */ s?.(72) ? DASH : formatPlainOrDash(derivedAny?.underlying),
    /* 73 */ s?.(73) ? DASH : formatPlainOrDash(derivedAny?.expDate),
    /* 74 */ s?.(74) ? DASH : formatNumOrDash(derivedAny?.dte, { decimals: 0 }),
    /* 75 */ s?.(75)
      ? DASH
      : formatNumOrDash(derivedAny?.strike, { decimals: 2 }),
    /* 76 */ s?.(76) ? DASH : formatPlainOrDash(derivedAny?.callPut),
    /* 77 */ s?.(77)
      ? DASH
      : isSummaryRow
        ? "Summary"
        : formatPlainOrDash(derivedAny?.rowType),
    /* 78 */ s?.(78) ? DASH : formatCurrency(derivedAny?.__priceLow52W),
    /* 79 */ s?.(79) ? DASH : formatCurrency(derivedAny?.__priceHigh52W),
    /* 80 */ s?.(80) ? DASH : formatCurrency(derivedAny?.__overnightPrice),
    /* 81 */ s?.(81)
      ? DASH
      : formatNumOrDash(derivedAny?.__overnightChangeDollar, {
          decimals: 2,
          showSign: true,
        }),
    /* 82 */ s?.(82)
      ? DASH
      : formatPctOrDash(derivedAny?.__overnightChangePercent, {
          decimals: 2,
          showSign: true,
        }),
    /* 83 */ s?.(83) ? DASH : formatCurrency(derivedAny?.__afterHoursPrice),
    /* 84 */ s?.(84)
      ? DASH
      : formatNumOrDash(derivedAny?.__postMarketChg, {
          decimals: 2,
          showSign: true,
        }),
    /* 85 */ s?.(85)
      ? DASH
      : formatPctOrDash(derivedAny?.__postMarketChgPct, {
          decimals: 2,
          showSign: true,
        }),
    /* 86 */ s?.(86) ? DASH : formatPlainOrDash(derivedAny?.__assetType),
    /* 87 */ s?.(87) ? DASH : formatPlainOrDash(derivedAny?.__exchangeName),
    /* 88 */ s?.(88) ? DASH : warningText,
    /* 89 */ s?.(89)
      ? DASH
      : !isSummaryRow && isOptionRow
        ? DASH
        : formatNumOrDash(derivedAny?.betaUltraShort, { decimals: 3 }),
    /* 90 */ s?.(90)
      ? DASH
      : !isSummaryRow && isOptionRow
        ? DASH
        : formatNumOrDash(derivedAny?.betaShort, { decimals: 3 }),
    /* 91 */ s?.(91)
      ? DASH
      : !isSummaryRow && isOptionRow
        ? DASH
        : formatNumOrDash(derivedAny?.betaMedium, { decimals: 3 }),
    /* 92 */ s?.(92)
      ? DASH
      : !isSummaryRow && isOptionRow
        ? DASH
        : formatNumOrDash(derivedAny?.betaLong, { decimals: 3 }),
  ];
}
