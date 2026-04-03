import { APP_TIMEZONE, getDayOfWeekCT } from "../../../shared/utils/time";
import type { TimeRange, ResolvedTimeRangeWindow } from "./timelineTypes";
import { ONE_DAY_MS } from "./timelineConstants";

const CT_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const CT_HOUR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  hour12: false,
});

const TODAY_WINDOW_START_HOUR_CT = 3;
const TODAY_WINDOW_START_MINUTE_CT = 0;
const TODAY_WINDOW_END_HOUR_CT = 19;
const TODAY_WINDOW_END_MINUTE_CT = 0;
const MARKET_OPEN_HOUR_CT = 8;
const MARKET_OPEN_MINUTE_CT = 30;
const MARKET_CLOSE_HOUR_CT = 15;
const MARKET_CLOSE_MINUTE_CT = 0;
const MIN_TIME_WINDOW_MS = 60_000;

type CtDateParts = {
  year: number;
  month: number;
  day: number;
};

function getCtDateParts(ts: number): CtDateParts | null {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return null;

  try {
    const parts = CT_DATE_PARTS_FORMATTER.formatToParts(date);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return null;
    }
    return { year, month, day };
  } catch {
    return null;
  }
}

function getCtHour(ts: number): number | null {
  try {
    const hour = Number.parseInt(CT_HOUR_FORMATTER.format(new Date(ts)), 10);
    return Number.isInteger(hour) ? hour : null;
  } catch {
    return null;
  }
}

function ctDateTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): number {
  const guess = Date.UTC(year, month - 1, day, hour + 6, minute);
  const actualHour = getCtHour(guess);
  return guess + (actualHour === hour ? 0 : -3_600_000);
}

function shiftCtDateByDays(ts: number, days: number): CtDateParts | null {
  return getCtDateParts(ts + days * ONE_DAY_MS);
}

export function resolveTimeRangeWindow(
  range: TimeRange,
  nowTs = Date.now(),
): ResolvedTimeRangeWindow {
  const baseNowTs = Number.isFinite(nowTs) ? nowTs : Date.now();
  let startTs = baseNowTs - range.durationMs;
  let endTs = baseNowTs;

  const ctParts = getCtDateParts(baseNowTs);
  if (range.anchor && ctParts) {
    switch (range.anchor) {
      case "todaySession": {
        const todaySessionStartTs = ctDateTimeToUtcMs(
          ctParts.year,
          ctParts.month,
          ctParts.day,
          TODAY_WINDOW_START_HOUR_CT,
          TODAY_WINDOW_START_MINUTE_CT,
        );
        const todaySessionEndTs = ctDateTimeToUtcMs(
          ctParts.year,
          ctParts.month,
          ctParts.day,
          TODAY_WINDOW_END_HOUR_CT,
          TODAY_WINDOW_END_MINUTE_CT,
        );
        startTs = todaySessionStartTs;
        endTs = Math.min(baseNowTs, todaySessionEndTs);
        if (endTs <= startTs) {
          endTs = Math.min(
            todaySessionEndTs,
            startTs + MIN_TIME_WINDOW_MS,
          );
        }
        break;
      }
      case "marketOpen": {
        const marketOpenTs = ctDateTimeToUtcMs(
          ctParts.year,
          ctParts.month,
          ctParts.day,
          MARKET_OPEN_HOUR_CT,
          MARKET_OPEN_MINUTE_CT,
        );
        const marketCloseTs = ctDateTimeToUtcMs(
          ctParts.year,
          ctParts.month,
          ctParts.day,
          MARKET_CLOSE_HOUR_CT,
          MARKET_CLOSE_MINUTE_CT,
        );
        startTs = marketOpenTs;
        endTs = Math.min(baseNowTs, marketCloseTs);
        if (endTs <= startTs) {
          endTs = Math.min(marketCloseTs, startTs + MIN_TIME_WINDOW_MS);
        }
        break;
      }
      case "weekToDate": {
        const dayOfWeek = getDayOfWeekCT(endTs);
        const daysFromMonday =
          dayOfWeek == null ? 0 : dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStartParts = shiftCtDateByDays(endTs, -daysFromMonday);
        if (weekStartParts) {
          startTs = ctDateTimeToUtcMs(
            weekStartParts.year,
            weekStartParts.month,
            weekStartParts.day,
            0,
            0,
          );
        }
        break;
      }
      case "monthToDate":
        startTs = ctDateTimeToUtcMs(ctParts.year, ctParts.month, 1, 0, 0);
        break;
      case "yearToDate":
        startTs = ctDateTimeToUtcMs(ctParts.year, 1, 1, 0, 0);
        break;
    }
  }

  if (!Number.isFinite(endTs)) {
    endTs = baseNowTs;
  }
  if (!Number.isFinite(startTs) || startTs >= endTs) {
    startTs = endTs - Math.max(range.durationMs, MIN_TIME_WINDOW_MS);
  }

  return {
    startTs,
    endTs,
    durationMs: Math.max(MIN_TIME_WINDOW_MS, endTs - startTs),
  };
}
