export const APP_TIMEZONE = "America/Chicago";

const CT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const CT_HOUR_MINUTE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const CT_HOUR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  hour12: false,
});

const CT_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
});

// ---------------------------------------------------------------------------
// Schwab ET timestamp → UTC ISO
// ---------------------------------------------------------------------------

/** Returns the day-of-month of the nth Sunday in a given month (n=1 → first Sunday). */
function nthSundayOfMonth(year: number, month: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
  const firstSunday = firstDow === 0 ? 1 : 8 - firstDow;
  return firstSunday + (n - 1) * 7;
}

/**
 * True if the given ET date+hour falls inside Eastern Daylight Time
 * (2nd Sunday of March 02:00 → 1st Sunday of November 02:00).
 */
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
  // month === 11: DST ends 1st Sunday of November at 02:00
  const endDay = nthSundayOfMonth(year, 11, 1);
  if (day < endDay) return true;
  if (day > endDay) return false;
  return hour < 2;
}

/**
 * Parse a Schwab "HH:MM:SS AM/PM ET, MM/DD/YYYY" timestamp into a UTC ISO-8601 string.
 * Returns null when the input cannot be parsed.
 */
export function parseSchwabEtTimestampToUtcIso(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(
    /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)\s*(?:ET|EDT|EST),?\s*(\d{2})\/(\d{2})\/(\d{4})$/i,
  );
  if (!m) return null;

  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = parseInt(m[3], 10);
  const ap = m[4].toUpperCase();
  const month = parseInt(m[5], 10);
  const day = parseInt(m[6], 10);
  const year = parseInt(m[7], 10);

  if (ap === "PM" && h < 12) h += 12;
  else if (ap === "AM" && h === 12) h = 0;

  // EDT = UTC−4, EST = UTC−5
  const utcOffsetH = isEasternDst(year, month, day, h) ? 4 : 5;
  return new Date(
    Date.UTC(year, month - 1, day, h + utcOffsetH, min, sec),
  ).toISOString();
}

/**
 * Extract the CT date (YYYY-MM-DD) from a UTC ISO timestamp, Date, or epoch.
 * Returns null when the input is unparseable.
 */
export function formatDateCT(input: Date | string | number): string | null {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const parts = CT_DATE_FORMATTER.formatToParts(d);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (!year || !month || !day) return null;
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

function toTwoDigits(v: number): string {
  return String(v).padStart(2, "0");
}

function to24Hour(hour: number, dayPeriod?: string): number {
  const period = (dayPeriod ?? "").trim().toUpperCase();
  if (period === "AM") {
    return hour === 12 ? 0 : hour;
  }
  if (period === "PM") {
    return hour === 12 ? 12 : hour + 12;
  }
  return hour;
}

/**
 * Format any Date-like input into CT `HH:mm` (24h).
 * Returns empty string when input is invalid.
 */
export function formatHourMinuteCT(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";

  try {
    const parts = CT_HOUR_MINUTE_FORMATTER.formatToParts(d);
    const hourRaw = Number(parts.find((p) => p.type === "hour")?.value);
    const minuteRaw = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hourRaw) || !Number.isFinite(minuteRaw)) return "";
    const hour24 = ((hourRaw % 24) + 24) % 24;
    return `${toTwoDigits(hour24)}:${toTwoDigits(minuteRaw)}`;
  } catch {
    return "";
  }
}

/**
 * Extract hour-of-day in CT (0-23) from Date-like input.
 * Returns null when input is invalid.
 */
function getHourCT(input: Date | string | number): number | null {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;

  try {
    const raw = CT_HOUR_FORMATTER.format(d);
    const hour = Number.parseInt(raw, 10);
    if (!Number.isInteger(hour)) return null;
    return ((hour % 24) + 24) % 24;
  } catch {
    return null;
  }
}

function normalizeHour(hour: number): number {
  const n = Number.isFinite(hour) ? Math.floor(hour) : 0;
  return ((n % 24) + 24) % 24;
}

/**
 * True when a CT timestamp falls in [startHour, endHour), supporting midnight wrap.
 * Example: start=19, end=3 matches 7PM-3AM CT.
 */
export function isInCTHourWindow(
  input: Date | string | number,
  startHour: number,
  endHour: number,
): boolean {
  const hour = getHourCT(input);
  if (hour == null) return false;

  const start = normalizeHour(startHour);
  const end = normalizeHour(endHour);
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

/**
 * Day-of-week in CT (0 = Sunday, 6 = Saturday).
 * Returns null when input is invalid.
 */
export function getDayOfWeekCT(input: Date | string | number): number | null {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;

  try {
    const raw = CT_WEEKDAY_FORMATTER.format(d);
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return map[raw] ?? null;
  } catch {
    return null;
  }
}

/**
 * True when the CT timestamp falls on Saturday or Sunday.
 */
export function isWeekendCT(input: Date | string | number): boolean {
  const dow = getDayOfWeekCT(input);
  return dow === 0 || dow === 6;
}

/**
 * True when automated recording should be paused:
 * - Weekend (all day Saturday and Sunday in CT)
 * - Night session: Friday 7 PM CT → Sunday end (covered by weekend + night window)
 * - Weekday night session: 7 PM – 3 AM CT
 */
export function isMarketClosedCT(input: Date | string | number): boolean {
  if (isWeekendCT(input)) return true;
  if (isNYSEHolidayCT(input)) return true;
  return isInCTHourWindow(input, 19, 3);
}

// ---------------------------------------------------------------------------
// NYSE holiday calendar
// ---------------------------------------------------------------------------

/**
 * Returns the day-of-month for the nth occurrence of `weekday` in a month.
 * weekday: 0 = Sunday … 6 = Saturday.
 * n: 1-based from start; pass -1 for the last occurrence.
 */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number,
): number {
  if (n >= 1) {
    const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const firstOccurrence = ((weekday - firstDow + 7) % 7) + 1;
    return firstOccurrence + (n - 1) * 7;
  }
  // Last occurrence (n = -1)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay();
  return lastDay - ((lastDow - weekday + 7) % 7);
}

/**
 * Easter Sunday for a given year — Meeus / Jones / Butcher algorithm.
 */
function easterSundayDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * If a holiday falls on Saturday, returns the preceding Friday.
 * If it falls on Sunday, returns the following Monday.
 * Otherwise returns the same date unchanged.
 */
function observedHolidayDate(
  year: number,
  month: number,
  day: number,
): { month: number; day: number } {
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (dow === 6) {
    const d = new Date(Date.UTC(year, month - 1, day - 1));
    return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }
  if (dow === 0) {
    const d = new Date(Date.UTC(year, month - 1, day + 1));
    return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }
  return { month, day };
}

/**
 * Returns all NYSE-observed holiday dates (YYYY-MM-DD) for the given year.
 *
 * Covered: New Year's Day, MLK Jr. Day, Presidents' Day, Good Friday,
 * Memorial Day, Juneteenth, Independence Day, Labor Day,
 * Thanksgiving, Christmas Day.
 */
function nyseHolidayDatesForYear(year: number): string[] {
  const dates: string[] = [];

  function addFixed(month: number, day: number): void {
    const obs = observedHolidayDate(year, month, day);
    dates.push(`${year}-${toTwoDigits(obs.month)}-${toTwoDigits(obs.day)}`);
  }

  function addNth(month: number, weekday: number, n: number): void {
    const day = nthWeekdayOfMonth(year, month, weekday, n);
    dates.push(`${year}-${toTwoDigits(month)}-${toTwoDigits(day)}`);
  }

  addFixed(1, 1); // New Year's Day — Jan 1 (observed)
  addNth(1, 1, 3); // MLK Jr. Day — 3rd Monday of January
  addNth(2, 1, 3); // Presidents' Day — 3rd Monday of February

  // Good Friday — 2 days before Easter Sunday
  const easter = easterSundayDate(year);
  const gf = new Date(Date.UTC(year, easter.month - 1, easter.day - 2));
  dates.push(
    `${year}-${toTwoDigits(gf.getUTCMonth() + 1)}-${toTwoDigits(gf.getUTCDate())}`,
  );

  addNth(5, 1, -1); // Memorial Day — last Monday of May
  addFixed(6, 19); // Juneteenth — Jun 19 (observed)
  addFixed(7, 4); // Independence Day — Jul 4 (observed)
  addNth(9, 1, 1); // Labor Day — 1st Monday of September
  addNth(11, 4, 4); // Thanksgiving — 4th Thursday of November
  addFixed(12, 25); // Christmas Day — Dec 25 (observed)

  return dates;
}

const _nyseHolidayCache = new Map<number, Set<string>>();

/**
 * Returns true when the CT calendar date of `input` is an NYSE-observed holiday.
 */
export function isNYSEHolidayCT(input: Date | string | number): boolean {
  const dateCT = formatDateCT(input);
  if (!dateCT) return false;
  const year = Number(dateCT.slice(0, 4));
  if (!_nyseHolidayCache.has(year)) {
    _nyseHolidayCache.set(year, new Set(nyseHolidayDatesForYear(year)));
  }
  return (_nyseHolidayCache.get(year) as Set<string>).has(dateCT);
}

/** Market session phases (CT-based). */
export type MarketSession = "Pre-Mkt" | "Open" | "After-Hrs" | "Closed";

/**
 * Determine the current US-equity market session in CT.
 *  - Pre-Mkt:    3:00 AM – 8:30 AM CT
 *  - Open:       8:30 AM – 3:00 PM CT
 *  - After-Hrs:  3:00 PM – 7:00 PM CT
 *  - Closed:     7:00 PM – 3:00 AM CT, weekends
 */
export function getMarketSessionCT(
  input: Date | string | number = Date.now(),
): MarketSession {
  if (isWeekendCT(input)) return "Closed";
  if (isNYSEHolidayCT(input)) return "Closed";

  const hmStr = formatHourMinuteCT(input);
  if (!hmStr) return "Closed";
  const [hStr, mStr] = hmStr.split(":");
  const minutesSinceMidnight = Number(hStr) * 60 + Number(mStr);

  // 3:00 AM = 180,  8:30 AM = 510,  3:00 PM = 900,  7:00 PM = 1140
  if (minutesSinceMidnight < 180) return "Closed"; // 0:00 – 3:00
  if (minutesSinceMidnight < 510) return "Pre-Mkt"; // 3:00 – 8:30
  if (minutesSinceMidnight < 900) return "Open"; // 8:30 – 15:00
  if (minutesSinceMidnight < 1140) return "After-Hrs"; // 15:00 – 19:00
  return "Closed"; // 19:00 – 24:00
}


// ---------------------------------------------------------------------------
// Orchestrator phase resolution
// ---------------------------------------------------------------------------

/**
 * Granular orchestrator phases that drive data-fetch strategy, streamer
 * lifecycle, and polling behaviour in `BackendOrchestrator`.
 *
 * | Phase        | Fetch mode   | Schwab streamer | Polling      |
 * |--------------|-------------|-----------------|--------------|
 * | market       | single       | full            | continuous   |
 * | afterHours   | dual         | disabled        | continuous   |
 * | preMarket    | dual         | disabled        | continuous   |
 * | overnight    | dual (once)  | disabled        | paused       |
 * | closed       | none         | disabled        | paused       |
 */
export type OrchestratorPhase =
  | "market"
  | "afterHours"
  | "preMarket"
  | "overnight"
  | "closed";

/**
 * Returns true if the current time falls in the overnight price window:
 * 7 PM – 3 AM CT, Sunday through Thursday evenings only.
 *
 * Overnight windows (CT):
 *   Sun 19:00 → Mon 03:00
 *   Mon 19:00 → Tue 03:00
 *   Tue 19:00 → Wed 03:00
 *   Wed 19:00 → Thu 03:00
 *   Thu 19:00 → Fri 03:00
 *
 * Friday and Saturday evenings are excluded (no market the next day).
 */
export function isOvernightWindowCT(
  input: Date | string | number = Date.now(),
): boolean {
  const inHourWindow = isInCTHourWindow(input, 19, 3);
  if (!inHourWindow) return false;

  const dow = getDayOfWeekCT(input);
  if (dow === null) return false;

  const hmStr = formatHourMinuteCT(input);
  const hour = hmStr ? Number(hmStr.split(":")[0]) : null;
  if (hour === null) return false;

  if (hour >= 19) {
    // Evening side: allow Sun(0), Mon(1), Tue(2), Wed(3), Thu(4)
    return dow <= 4;
  }
  // Morning side (hour < 3): allow Mon(1), Tue(2), Wed(3), Thu(4), Fri(5)
  return dow >= 1 && dow <= 5;
}

/**
 * Resolve the current orchestrator phase from the wall-clock time.
 *
 * Mapping from `MarketSession`:
 *  - Open      → `market`
 *  - After-Hrs → `afterHours`
 *  - Pre-Mkt   → `preMarket`
 *  - Closed    → `overnight` when inside the overnight window (next trading
 *                 day exists), otherwise `closed` (weekends / holidays)
 */
export function resolveOrchestratorPhase(
  input: Date | string | number = Date.now(),
): OrchestratorPhase {
  const session = getMarketSessionCT(input);
  switch (session) {
    case "Open":
      return "market";
    case "After-Hrs":
      return "afterHours";
    case "Pre-Mkt":
      return "preMarket";
    case "Closed":
      return isOvernightWindowCT(input) ? "overnight" : "closed";
  }
}

/**
 * Parse market time text into minutes since midnight (CT).
 * Supports:
 *  - `HH:mm`
 *  - `HH:mm:ss`
 *  - `h:mm AM/PM`
 *  - `hh:mm:ss AM/PM`
 */
export function parseMarketTimeCTToMinutes(raw: string): number | null {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;

  const m = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (m) {
    const hourRaw = Number(m[1]);
    const minute = Number(m[2]);
    const period = m[4];
    if (!Number.isInteger(hourRaw) || !Number.isInteger(minute)) return null;
    if (minute < 0 || minute > 59) return null;

    if (period) {
      if (hourRaw < 1 || hourRaw > 12) return null;
      const h24 = to24Hour(hourRaw, period);
      return h24 * 60 + minute;
    }

    if (hourRaw < 0 || hourRaw > 23) return null;
    return hourRaw * 60 + minute;
  }

  // Fallback for non-standard strings.
  const formatted = formatHourMinuteCT(text);
  if (!formatted) return null;
  const [hStr, mStr] = formatted.split(":");
  const h = Number(hStr);
  const m2 = Number(mStr);
  if (!Number.isInteger(h) || !Number.isInteger(m2)) return null;
  return h * 60 + m2;
}

/**
 * Normalize market time text to CT `HH:mm` (24h) when parseable.
 * Returns original value if unparseable.
 */
export function normalizeMarketTimeCT(raw: string): string {
  const minutes = parseMarketTimeCTToMinutes(raw);
  if (minutes == null) return raw;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${toTwoDigits(hour)}:${toTwoDigits(minute)}`;
}

/**
 * Format a timestamp string to CT HH:MM:SS (24h).
 * Handles:
 *  - Schwab "HH:MM:SS AM/PM ET, MM/DD/YYYY" format (ET→CT is always -1h)
 *  - ISO / standard Date-parseable strings (via Intl with APP_TIMEZONE)
 *  - Returns the raw string if unparseable
 */
export function formatTimestampCT(ts: string): string {
  if (!ts) return "--";
  try {
    // Schwab "HH:MM:SS AM/PM ET, MM/DD/YYYY" format
    const schwab = ts.match(
      /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)\s*(?:ET|EDT|EST)/i,
    );
    if (schwab) {
      let h = parseInt(schwab[1], 10);
      const m = schwab[2];
      const s = schwab[3];
      const ap = schwab[4].toUpperCase();
      if (ap === "PM" && h < 12) h += 12;
      if (ap === "AM" && h === 12) h = 0;
      // ET → CT: always exactly -1 hour (both zones follow the same DST schedule)
      h = (h + 23) % 24;
      return `${String(h).padStart(2, "0")}:${m}:${s}`;
    }
    // Standard Date-parseable string → format in CT
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleTimeString("en-US", {
      timeZone: APP_TIMEZONE,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

// ---------------------------------------------------------------------------
// CT date helpers
// ---------------------------------------------------------------------------

/** Today's date in CT as YYYY-MM-DD. */
export function getTodayDateCT(): string {
  return formatDateCT(new Date()) ?? "";
}

/** Date offset by `days` from today in CT as YYYY-MM-DD. */
export function getDateOffsetCT(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDateCT(d) ?? "";
}

/** Convert minutes-since-midnight to HH:MM string. */
export function minutesToHHMM(totalMinutes: number): string {
  const mins = Math.max(0, Math.min(1439, Math.trunc(totalMinutes)));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// `formatTimeAgo` lives in shared/utils/format/relativeTime.ts — it is a pure
// duration formatter and has no timezone dependency.
export { formatTimeAgo, type FormatTimeAgoOptions } from "./format/relativeTime";
