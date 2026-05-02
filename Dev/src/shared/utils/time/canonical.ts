/*
 * Canonical time conversion helpers.
 *
 * IMPORTANT FOR AGENTS:
 * 1. Read `.docs/devPlan/regulation/Timezone.md` before modifying this file.
 * 2. Internal instants must be UTC epoch ms — convert at ingress / egress only.
 * 3. Business date keys are explicit `ct` / `et` / `app` strings, not instants.
 *
 * Schwaber has no Rust peer; the API is a TS-only port of AlexQuant's
 * `core/utils/time/canonical.ts` (intended to be behaviorally aligned with
 * AlexQuant's Rust canonical lib).
 */

export const DEFAULT_APP_TIMEZONE = "America/Chicago";
export const CT_TIMEZONE = "America/Chicago";
export const ET_TIMEZONE = "America/New_York";

type DateKeyKind = "ct" | "et" | "app";
type ExternalTimeFormat =
  | "iso8601_utc"
  | "epoch_seconds"
  | "ct_date_key"
  | "et_date_key"
  | "app_date_key";
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_STRING_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/i;

const TIMEZONE_ALIASES: Record<string, string> = {
  "US/Central": CT_TIMEZONE,
  CST6CDT: CT_TIMEZONE,
  "US/Eastern": ET_TIMEZONE,
  EST5EDT: ET_TIMEZONE,
  "US/Mountain": "America/Denver",
  MST7MDT: "America/Denver",
  "US/Pacific": "America/Los_Angeles",
  PST8PDT: "America/Los_Angeles",
  GMT: "UTC",
};

let _appTimezone = detectAppTimezone();
export let APP_TIMEZONE = _appTimezone;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US",
): Intl.DateTimeFormat {
  const key = JSON.stringify([locale, timeZone, options]);
  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    formatterCache.set(key, cached);
  }
  return cached;
}

function zoneForDateKey(kind: DateKeyKind): string {
  switch (kind) {
    case "ct":
      return CT_TIMEZONE;
    case "et":
      return ET_TIMEZONE;
    case "app":
      return APP_TIMEZONE;
  }
}

function getDateParts(
  utcMs: number,
  timeZone: string,
): { year: string; month: string; day: string } | null {
  if (!Number.isFinite(utcMs)) return null;
  const parts = getFormatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(utcMs));
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function getTimeParts(
  utcMs: number,
  timeZone: string,
): {
  hour: number;
  minute: number;
  second: number;
  weekdayShort: string | null;
} | null {
  if (!Number.isFinite(utcMs)) return null;
  const parts = getFormatter(timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  const second = Number(parts.find((p) => p.type === "second")?.value);
  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? null;
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  )
    return null;
  return { hour, minute, second, weekdayShort };
}

export function canonicalizeTimezoneId(
  raw: string | null | undefined,
): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const candidate = TIMEZONE_ALIASES[trimmed] ?? trimmed;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: candidate })
      .resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export function detectAppTimezone(): string {
  if (typeof Intl === "undefined") {
    throw new Error("Unable to detect app timezone: Intl is unavailable");
  }
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const canonical = canonicalizeTimezoneId(resolved);
  if (!canonical) {
    throw new Error(
      `Unable to detect app timezone from OS value: ${String(resolved ?? "")}`,
    );
  }
  return canonical;
}

export function setAppTimezone(raw: string | null | undefined): string {
  const next = canonicalizeTimezoneId(raw);
  if (!next) {
    throw new TypeError(`Invalid app timezone: ${String(raw ?? "")}`);
  }
  _appTimezone = next;
  APP_TIMEZONE = _appTimezone;
  return _appTimezone;
}

export function getAppTimezone(): string {
  return _appTimezone;
}

export function assertEpochMs(value: number, fieldName = "timestamp"): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${fieldName} must be a finite epoch-ms number`);
  }
  const truncated = Math.trunc(value);
  if (truncated < -8_640_000_000_000_000 || truncated > 8_640_000_000_000_000) {
    throw new RangeError(`${fieldName} out of valid epoch-ms range`);
  }
  return truncated;
}

function parseFractionalMs(raw: string | undefined): number {
  const digits = String(raw ?? "").slice(0, 3).padEnd(3, "0");
  return digits ? Number(digits) : 0;
}

function parseOffsetMinutes(raw: string | undefined): number | null {
  if (!raw) return 0;
  if (raw === "Z" || raw === "z") return 0;
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function buildUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): number | null {
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  if (!Number.isFinite(utcMs)) return null;
  const date = new Date(utcMs);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }
  return utcMs;
}

export function isoStringToUtcMs(raw: string): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const match = ISO_STRING_RE.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] ? Number(match[4]) : 0;
  const minute = match[5] ? Number(match[5]) : 0;
  const second = match[6] ? Number(match[6]) : 0;
  const millisecond = parseFractionalMs(match[7]);
  const offsetMinutes = parseOffsetMinutes(match[8]);
  if (offsetMinutes == null) return null;

  const baseUtcMs = buildUtcMs(year, month, day, hour, minute, second, millisecond);
  if (baseUtcMs == null) return null;

  return baseUtcMs - offsetMinutes * 60_000;
}

function nthSundayOfMonth(year: number, month: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstSunday = firstDow === 0 ? 1 : 8 - firstDow;
  return firstSunday + (n - 1) * 7;
}

function isEasternDst(
  year: number,
  month: number,
  day: number,
  hour: number,
): boolean {
  if (month < 3 || month > 11) return false;
  if (month > 3 && month < 11) return true;
  if (month === 3) {
    const startDay = nthSundayOfMonth(year, 3, 2);
    if (day < startDay) return false;
    if (day > startDay) return true;
    return hour >= 2;
  }
  const endDay = nthSundayOfMonth(year, 11, 1);
  if (day < endDay) return true;
  if (day > endDay) return false;
  return hour < 2;
}

export function schwabEtStringToUtcMs(raw: string): number | null {
  const m = String(raw ?? "")
    .trim()
    .match(
      /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)\s*(ET|EDT|EST),?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/i,
    );
  if (!m) return null;

  const hour12 = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const second = parseInt(m[3], 10);
  const ampm = m[4].toUpperCase();
  const zoneToken = m[5].toUpperCase();
  const month = parseInt(m[6], 10);
  const day = parseInt(m[7], 10);
  const year = parseInt(m[8], 10);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() !== month - 1 ||
    dateCheck.getUTCDate() !== day
  ) {
    return null;
  }
  const hour24 =
    ampm === "AM"
      ? hour12 === 12
        ? 0
        : hour12
      : hour12 === 12
        ? 12
        : hour12 + 12;
  const utcOffsetHours =
    zoneToken === "EST"
      ? 5
      : zoneToken === "EDT"
        ? 4
        : isEasternDst(year, month, day, hour24)
          ? 4
          : 5;
  return Date.UTC(year, month - 1, day, hour24 + utcOffsetHours, minute, second);
}

export function yahooSecondsToUtcMs(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    throw new TypeError("yahooSeconds must be a finite number");
  }
  return assertEpochMs(Math.trunc(seconds) * 1000, "yahooSeconds");
}

export function utcMsToCtDateKey(utcMs: number): string | null {
  return utcMsToDateKey(utcMs, "ct");
}

export function utcMsToEtDateKey(utcMs: number): string | null {
  return utcMsToDateKey(utcMs, "et");
}

export function utcMsToAppDateKey(utcMs: number): string | null {
  return utcMsToDateKey(utcMs, "app");
}

export function utcMsToDateKey(
  utcMs: number,
  kind: DateKeyKind,
): string | null {
  const parts = getDateParts(assertEpochMs(utcMs), zoneForDateKey(kind));
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : null;
}

export function shiftDateKey(dateKey: string, days: number): string | null {
  const match = DATE_KEY_RE.exec(String(dateKey ?? "").trim());
  if (!match || !Number.isFinite(days)) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const inputCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    inputCheck.getUTCFullYear() !== year ||
    inputCheck.getUTCMonth() !== month - 1 ||
    inputCheck.getUTCDate() !== day
  ) {
    return null;
  }
  const shifted = new Date(Date.UTC(year, month - 1, day + Math.trunc(days)));
  if (Number.isNaN(shifted.getTime())) return null;
  const nextYear = shifted.getUTCFullYear();
  const nextMonth = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(shifted.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function formatUtcMsInZone(
  utcMs: number,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US",
): string {
  return getFormatter(timeZone, options, locale).format(
    new Date(assertEpochMs(utcMs)),
  );
}

export function formatUtcMsInAppZone(
  utcMs: number,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US",
): string {
  return formatUtcMsInZone(utcMs, APP_TIMEZONE, options, locale);
}

export function utcMsToExternalFormat(
  utcMs: number,
  format: ExternalTimeFormat,
): string | null {
  const ts = assertEpochMs(utcMs);
  switch (format) {
    case "iso8601_utc":
      return new Date(ts).toISOString();
    case "epoch_seconds":
      return String(Math.trunc(ts / 1000));
    case "ct_date_key":
      return utcMsToCtDateKey(ts);
    case "et_date_key":
      return utcMsToEtDateKey(ts);
    case "app_date_key":
      return utcMsToAppDateKey(ts);
  }
}

export function getZoneHour(utcMs: number, timeZone: string): number | null {
  return getTimeParts(assertEpochMs(utcMs), timeZone)?.hour ?? null;
}

export function getZoneWeekday(
  utcMs: number,
  timeZone: string,
): number | null {
  const weekday = getTimeParts(assertEpochMs(utcMs), timeZone)?.weekdayShort;
  if (!weekday) return null;
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? null;
}
