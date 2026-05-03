import type { HoldingsTableColumnId } from "../../../../shared/types/holdingsTableColumns";
import type { shareScaleValue } from "shared/utils/domain/globalShareMode";
import { DASH, formatNumOrDash, formatPctOrDash } from "./shared";

export type SensitivityCellsContext = {
  s: ((i: number) => boolean) | null;
  derivedAny: any;
  isSummaryRow: boolean;
  summaryGamma: number | null;
  summaryTheta: number | null;
  summaryVega: number | null;
  summaryRho: number | null;
  pv: (formatted: string) => string;
  sv: typeof shareScaleValue;
  optionOnly: (colId: HoldingsTableColumnId, value: string) => string;
  suppressOnSummary: (colId: HoldingsTableColumnId, value: string) => string;
};

export function formatSensitivityCells(
  ctx: SensitivityCellsContext,
): string[] {
  const {
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
  } = ctx;

  return [
    /* 42 */ s?.(42)
      ? DASH
      : pv(
          formatNumOrDash(
            sv(
              isSummaryRow
                ? (derivedAny?.totalDeltaShares ?? derivedAny?.deltaShares)
                : derivedAny?.deltaShares,
            ),
            { decimals: 4, showSign: true },
          ),
        ),
    /* 43 */ s?.(43)
      ? DASH
      : optionOnly(
          "gammaSharesPerDol",
          pv(
            formatNumOrDash(
              sv(isSummaryRow ? summaryGamma : derivedAny?.gammaSharesPerDol),
              { decimals: 4, showSign: true },
            ),
          ),
        ),
    /* 44 */ s?.(44)
      ? DASH
      : optionOnly(
          "absGammaSharesPerDol",
          pv(
            formatNumOrDash(sv(derivedAny?.absGammaSharesPerDol), {
              decimals: 4,
            }),
          ),
        ),
    /* 45 */ s?.(45)
      ? DASH
      : optionOnly(
          "thetaPerDay",
          pv(
            formatNumOrDash(
              sv(isSummaryRow ? summaryTheta : derivedAny?.thetaPerDay),
              { decimals: 4, showSign: true },
            ),
          ),
        ),
    /* 46 */ s?.(46)
      ? DASH
      : optionOnly(
          "vegaPerVolPoint",
          pv(
            formatNumOrDash(
              sv(isSummaryRow ? summaryVega : derivedAny?.vegaPerVolPoint),
              { decimals: 4, showSign: true },
            ),
          ),
        ),
    /* 47 */ s?.(47)
      ? DASH
      : optionOnly(
          "absVegaPerVolPoint",
          pv(
            formatNumOrDash(sv(derivedAny?.absVegaPerVolPoint), {
              decimals: 4,
            }),
          ),
        ),
    /* 48 */ s?.(48)
      ? DASH
      : optionOnly(
          "rhoPer1pctRate",
          pv(
            formatNumOrDash(
              sv(isSummaryRow ? summaryRho : derivedAny?.rhoPer1pctRate),
              { decimals: 4, showSign: true },
            ),
          ),
        ),
    /* 49 */ s?.(49)
      ? DASH
      : suppressOnSummary(
          "marginUsageRatioPct",
          formatPctOrDash(derivedAny?.marginUsageRatioPct, {
            decimals: 2,
            showSign: true,
          }),
        ),
    /* 50 */ s?.(50)
      ? DASH
      : formatNumOrDash(derivedAny?.deltaSharesPerMargin, {
          decimals: 4,
          showSign: true,
        }),
    /* 51 */ s?.(51)
      ? DASH
      : formatNumOrDash(derivedAny?.deltaNotionalPerMargin, {
          decimals: 4,
          showSign: true,
        }),
    /* 52 */ s?.(52)
      ? DASH
      : optionOnly(
          "thetaPerMargin",
          formatNumOrDash(derivedAny?.thetaPerMargin, {
            decimals: 4,
            showSign: true,
          }),
        ),
    /* 53 */ s?.(53)
      ? DASH
      : optionOnly(
          "vegaPerMargin",
          formatNumOrDash(derivedAny?.vegaPerMargin, {
            decimals: 4,
            showSign: true,
          }),
        ),
    /* 54 */ s?.(54)
      ? DASH
      : optionOnly(
          "thetaOnMargin",
          formatNumOrDash(derivedAny?.thetaOnMargin, {
            decimals: 4,
            showSign: true,
          }),
        ),
    /* 55 */ s?.(55)
      ? DASH
      : optionOnly(
          "vegaOnMargin",
          formatNumOrDash(derivedAny?.vegaOnMargin, {
            decimals: 4,
            showSign: true,
          }),
        ),
    /* 56 */ s?.(56)
      ? DASH
      : optionOnly(
          "gammaOnMargin",
          formatNumOrDash(derivedAny?.gammaOnMargin, {
            decimals: 4,
            showSign: true,
          }),
        ),
    /* 57 */ s?.(57)
      ? DASH
      : optionOnly(
          "carryPerVega",
          formatNumOrDash(derivedAny?.carryPerVega, {
            decimals: 4,
            showSign: true,
          }),
        ),
    /* 58 */ s?.(58)
      ? DASH
      : optionOnly(
          "carryPerGamma",
          formatNumOrDash(derivedAny?.carryPerGamma, {
            decimals: 4,
            showSign: true,
          }),
        ),
  ];
}
