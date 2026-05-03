import {
  formatPct,
  formatSignedCurrencyLocale,
} from "shared/utils/format/formatters";
import type { SnapshotMetricDef } from "./timelineTypes";
import { APP_TIMEZONE } from "../../../shared/utils/time";
import { isShareMasked, SHARE_MASKED_TEXT } from "shared/utils/domain/globalShareMode";

export const signedCurrency = (v: number, decimals = 0): string =>
  formatSignedCurrencyLocale(v, { decimals });

function signedNumber(v: number, decimals = 2, suffix = ""): string {
  if (!Number.isFinite(v)) return "-";
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toFixed(decimals)}${suffix}`;
}

export function formatMetricValue(
  metric: SnapshotMetricDef,
  value: number,
  forAxis = false,
): string {
  if (!Number.isFinite(value)) return "-";

  switch (metric.kind) {
    case "percent":
      return formatPct(value, {
        decimals: forAxis ? 1 : 2,
        showSign: true,
      });
    case "beta":
      return signedNumber(value, forAxis ? 1 : 2);
    default:
      if (isShareMasked()) return SHARE_MASKED_TEXT;
      return signedCurrency(
        value,
        forAxis ? 0 : Math.abs(value) >= 1000 ? 0 : 2,
      );
  }
}

export function formatTimeLabel(
  ts: number,
  rangeDurationMs: number,
  dateOnly = false,
): string {
  const date = new Date(ts);
  if (dateOnly) {
    return date.toLocaleDateString("en-US", {
      timeZone: APP_TIMEZONE,
      month: "short",
      day: "numeric",
    });
  }
  if (rangeDurationMs > 24 * 60 * 60 * 1000) {
    return (
      date.toLocaleDateString("en-US", {
        timeZone: APP_TIMEZONE,
        month: "short",
        day: "numeric",
      }) +
      " " +
      date.toLocaleTimeString("en-US", {
        timeZone: APP_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
  }
  return date.toLocaleTimeString("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
