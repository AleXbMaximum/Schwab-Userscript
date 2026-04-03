import type{ OptionsChainsResponse } from "shared/types/options";
import type { OptionCaptureMetaRow } from "backend/core/db/capture/optionMonitorTypes";
import { generateUUID } from "shared/utils/uuid";
import {
  formatHourMinuteCT,
  parseSchwabEtTimestampToUtcIso,
} from "shared/utils/time";

export function buildMetaRow(
  response: OptionsChainsResponse,
  symbol: string,
  capturedAtUtc: string,
): OptionCaptureMetaRow {
  // Normalise the Schwab ET timestamp ("HH:MM:SS AM/PM ET, MM/DD/YYYY") to a UTC
  // ISO-8601 string so every downstream query can use standard date comparisons.
  // Fall back to capturedAtUtc when parsing fails (e.g. unexpected format).
  const dataTimestamp =
    (response.currentDateTime
      ? parseSchwabEtTimestampToUtcIso(response.currentDateTime)
      : null) ?? capturedAtUtc;

  // Derive the display market time in CT from the data timestamp, not from the
  // moment we happened to fire the HTTP request.
  const marketTimeCT =
    formatHourMinuteCT(dataTimestamp) ||
    formatHourMinuteCT(capturedAtUtc) ||
    "00:00";

  return {
    openingId: generateUUID(),
    symbol,
    capturedAtUtc: capturedAtUtc,
    marketTimeCt: marketTimeCT,
    dataTimestamp: dataTimestamp,
    underlyingPrice: response.underlyingPrice,
    interestRate: response.interestRate,
    dividendYield: response.dividendYield,
    contractMultiplier: response.contractMultiplier,
    expirationsCount: response.expirations.length,
    isDelayed: response.isDelayed,
  };
}
