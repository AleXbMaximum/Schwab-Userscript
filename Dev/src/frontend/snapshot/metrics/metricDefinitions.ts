import { ds_signColorRaw, DS_COLORS } from "../../components/core/theme";
import type { AccountOverviewMetrics } from "backend/computation/holdings/accountOverviewMetrics";
import {
  formatPct,
  formatCurrencyLocale as fmtCurrencyLocale,
  formatSignedCurrencyLocale,
} from "shared/utils/formatters";
import {
  isShareMasked,
  shareScaleValue,
  SHARE_MASKED_TEXT,
} from "shared/utils/globalShareMode";
import type { BalancesSnapshot } from "../../../backend/core/network/schwab/balances";

/** Format a portfolio value with share-mode masking/scaling. */
function fmtPV(v: number | null | undefined, decimals = 0): string {
  if (isShareMasked()) return SHARE_MASKED_TEXT;
  return fmtCurrencyLocale(shareScaleValue(v) as number, decimals);
}

/** Format a signed portfolio value with share-mode masking/scaling. */
function fmtSignedPV(v: number | null | undefined, decimals = 0): string {
  if (isShareMasked()) return SHARE_MASKED_TEXT;
  return formatSignedCurrencyLocale(shareScaleValue(v) as number, {
    decimals,
  });
}

export type MetricEntry = {
  label: string;
  valueFn: () => string;
  colorFn: () => string;
};

export function computePrimaryMetrics(ov: AccountOverviewMetrics): MetricEntry[] {
  return [
    {
      label: "Day:",
      valueFn: () => {
        if (isShareMasked()) return SHARE_MASKED_TEXT;
        return `${fmtSignedPV(ov.dayChangeDollar)} (${formatPct(ov.dayChangePercent, { decimals: 2 })})`;
      },
      colorFn: () => ds_signColorRaw(ov.dayChangeDollar),
    },
    {
      label: "Total:",
      valueFn: () => {
        if (isShareMasked()) return SHARE_MASKED_TEXT;
        return `${fmtSignedPV(ov.gainLossDollar)} (${formatPct(ov.gainLossPercent, { decimals: 2 })})`;
      },
      colorFn: () => ds_signColorRaw(ov.gainLossDollar),
    },
    {
      label: "Acc:",
      valueFn: () => fmtPV(ov.accountValue, 0),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "Mkt:",
      valueFn: () => fmtPV(ov.marketValue, 0),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "Cash:",
      valueFn: () => fmtPV(ov.cashInvestments, 0),
      colorFn: () =>
        ov.cashInvestments >= 0 ? "var(--ios-text-primary)" : DS_COLORS.negative,
    },
    {
      label: "Δ$:",
      valueFn: () => fmtPV(ov.absDeltaNotionalDol, 0),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "Short:",
      valueFn: () => fmtPV(ov.marketValueShort),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "Eq%:",
      valueFn: () => formatPct(ov.equityPercent, { decimals: 1 }),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "β:",
      valueFn: () => `${ov.beta.toFixed(2)}`,
      colorFn: () =>
        ov.beta > 1.4
          ? DS_COLORS.negative
          : ov.beta > 1.1
            ? DS_COLORS.neutral
            : "var(--ios-text-primary)",
    },
    {
      label: "θ:",
      valueFn: () => fmtPV(ov.thetaPerDay),
      colorFn: () => ds_signColorRaw(ov.thetaPerDay),
    },
    {
      label: "ν:",
      valueFn: () => fmtPV(ov.vegaPerVolPoint),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "ρ:",
      valueFn: () => fmtPV(ov.rhoPer1pctRate),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "↑1%:",
      valueFn: () => fmtPV(ov.uPnlUp1PctDol),
      colorFn: () => ds_signColorRaw(ov.uPnlUp1PctDol),
    },
    {
      label: "↓1%:",
      valueFn: () => fmtPV(ov.uPnlDn1PctDol),
      colorFn: () => ds_signColorRaw(ov.uPnlDn1PctDol),
    },
  ];
}

export function computeDetailMetrics(
  ov: AccountOverviewMetrics,
  b: BalancesSnapshot,
): MetricEntry[] {
  return [
    {
      label: "Long:",
      valueFn: () => fmtPV(ov.marketValueLong),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "BuyPwr:",
      valueFn: () => fmtPV(b.dayBuyPower, 0),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "MgnEq:",
      valueFn: () => fmtPV(b.marginEquity, 0),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "OptReq:",
      valueFn: () => fmtPV(b.optionRequirement, 0),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "Settled:",
      valueFn: () => fmtPV(b.settledFunds, 0),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "SMA:",
      valueFn: () => fmtPV(b.sma, 0),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "Borrow:",
      valueFn: () => fmtPV(b.cashBorrowing, 0),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "Wdraw:",
      valueFn: () => fmtPV(b.withdrawable, 0),
      colorFn: () => "var(--ios-text-primary)",
    },
    {
      label: "Int:",
      valueFn: () => fmtPV(b.mtdInterestOwed, 2),
      colorFn: () =>
        b.mtdInterestOwed > 0 ? DS_COLORS.negative : "var(--ios-text-primary)",
    },
    {
      label: "MgnRt:",
      valueFn: () => `${b.marginRate.toFixed(2)}%`,
      colorFn: () => "var(--ios-text-primary)",
    },
  ];
}

