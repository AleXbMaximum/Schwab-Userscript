import type { HoldingsTableColumnId } from "../../../../shared/holdingsTableColumns";
import {
  formatCurrency,
  formatSignedCurrencyFull,
} from "../../formatters";
import { formatPct } from "shared/utils/formatters";
import {
  isShareMasked,
  shareScaleValue,
  SHARE_MASKED_TEXT,
} from "shared/utils/globalShareMode";
import { formatNumOrDash, formatPctOrDash } from "./shared";

export function formatGroupTotalsDisplayValues(
  name: string,
  totals: any | null,
  columnIds: HoldingsTableColumnId[],
): (string | null)[] {
  const masked = isShareMasked();
  const pv = (formatted: string): string =>
    masked ? SHARE_MASKED_TEXT : formatted;
  const sv = shareScaleValue;

  return columnIds.map((colId) => {
    if (colId === "symbol") return name ?? "";
    if (!totals) return "-";

    switch (colId) {
      case "dayChngPct":
        return formatPct(totals.dayChangePercent, { showSign: true });
      case "dayChngDol":
        return pv(formatSignedCurrencyFull(sv(totals.dayChangeDollar) as number));
      case "gainLossPct":
        return formatPct(totals.gainLossPercent, { showSign: true });
      case "gainLossDol":
        return pv(formatSignedCurrencyFull(sv(totals.gainLossDollar) as number));
      case "marketValue":
        return pv(
          formatCurrency(
            sv(
              totals.marketValue ??
                totals.marketValueLong ??
                totals.liquidationValue,
            ),
          ),
        );
      case "pctOfAcct":
        return formatPct(
          totals.percentageOfAccount ?? totals.pctOfAcct ?? totals.pctOfAccount,
          { decimals: 2 },
        );
      case "costBasis":
        return pv(formatCurrency(sv(totals.costBasis)));
      case "marginReq":
        return pv(formatCurrency(sv(totals.marginReqDol), { decimals: 2 }));
      case "deltaNotionalDol":
        return pv(formatSignedCurrencyFull(sv(totals.deltaNotionalDol) as number));
      case "betaNotionalDol":
        return pv(formatSignedCurrencyFull(sv(totals.betaNotionalDol) as number));
      case "gammaSharesPerDol":
        return formatNumOrDash(totals.gammaSharesPerDol, {
          decimals: 4,
          showSign: true,
        });
      case "absGammaSharesPerDol":
        return formatNumOrDash(totals.absGammaSharesPerDol, { decimals: 4 });
      case "thetaPerDay":
        return pv(
          formatNumOrDash(sv(totals.thetaPerDay), {
            decimals: 4,
            showSign: true,
          }),
        );
      case "vegaPerVolPoint":
        return pv(
          formatNumOrDash(sv(totals.vegaPerVolPoint), {
            decimals: 4,
            showSign: true,
          }),
        );
      case "absVegaPerVolPoint":
        return pv(
          formatNumOrDash(sv(totals.absVegaPerVolPoint), { decimals: 4 }),
        );
      case "rhoPer1pctRate":
        return pv(
          formatNumOrDash(sv(totals.rhoPer1pctRate), {
            decimals: 4,
            showSign: true,
          }),
        );
      case "pnlUp1PctDol":
        return pv(formatSignedCurrencyFull(sv(totals.pnlUp1PctDol) as number));
      case "pnlDn1PctDol":
        return pv(formatSignedCurrencyFull(sv(totals.pnlDn1PctDol) as number));
      case "convexityDol":
        return pv(
          formatCurrency(sv(totals.convexityDol), {
            decimals: 2,
            showSign: true,
          }) || "-",
        );
      case "carryPerVega":
        return formatNumOrDash(totals.carryPerVega, {
          decimals: 4,
          showSign: true,
        });
      case "carryPerGamma":
        return formatNumOrDash(totals.carryPerGamma, {
          decimals: 4,
          showSign: true,
        });
      case "deltaNotionalConcentrationPct":
        return formatPctOrDash(totals.deltaNotionalConcentrationPct, {
          decimals: 2,
          showSign: true,
        });
      case "betaNotionalConcentrationPct":
        return formatPctOrDash(totals.betaNotionalConcentrationPct, {
          decimals: 2,
          showSign: true,
        });
      case "vegaConcentrationPct":
        return formatPctOrDash(totals.vegaConcentrationPct, {
          decimals: 2,
          showSign: true,
        });
      case "priceChngPct":
        return formatPct(totals.priceChangePercent, { showSign: true });
      case "priceChngDol":
        return formatNumOrDash(totals.priceChangeDollar, {
          decimals: 2,
          showSign: true,
        });
      case "theta":
        return formatNumOrDash(totals.thetaPerDay, {
          decimals: 4,
          showSign: true,
        });
      case "vega":
        return formatNumOrDash(totals.vegaPerVolPoint, {
          decimals: 4,
          showSign: true,
        });
      case "rho":
        return formatNumOrDash(totals.rhoPer1pctRate, {
          decimals: 4,
          showSign: true,
        });
      default:
        return "-";
    }
  });
}
