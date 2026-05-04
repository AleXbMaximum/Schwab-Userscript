import type { OHLCVBar } from "shared/types/chartData";

type SanitizedBar = {
  date: string;
  close: number;
};

const REGULAR_SESSION_START_MINUTE = 9 * 60 + 30;
const REGULAR_SESSION_END_MINUTE = 16 * 60;
const ET_TIME_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function isRegularSessionBar(date: string): boolean {
  if (!date.includes("T")) return true;
  const dt = new Date(date);
  if (Number.isNaN(dt.getTime())) return false;

  let weekday = "";
  let hour = -1;
  let minute = -1;
  for (const part of ET_TIME_PARTS.formatToParts(dt)) {
    if (part.type === "weekday") weekday = part.value;
    if (part.type === "hour") hour = Number(part.value);
    if (part.type === "minute") minute = Number(part.value);
  }

  if (weekday === "Sat" || weekday === "Sun") return false;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const hhmm = hour * 60 + minute;
  return (
    hhmm >= REGULAR_SESSION_START_MINUTE && hhmm <= REGULAR_SESSION_END_MINUTE
  );
}

function normalizeBarDate(date: string): string {
  const tIdx = date.indexOf("T");
  if (tIdx < 0) return date;
  return date.slice(0, tIdx + 6);
}

function sanitize(
  bars: OHLCVBar[],
  normalizeKey: (date: string) => string,
): SanitizedBar[] {
  const dedup = new Map<string, SanitizedBar>();
  for (const bar of bars) {
    if (!bar?.date) continue;
    if (
      typeof bar.close !== "number" ||
      !Number.isFinite(bar.close) ||
      bar.close <= 0
    )
      continue;
    if (!isRegularSessionBar(bar.date)) continue;
    const key = normalizeKey(bar.date);
    dedup.set(key, { date: key, close: bar.close });
  }
  return Array.from(dedup.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

const identity = (s: string): string => s;

export function sanitizeBars(bars: OHLCVBar[]): SanitizedBar[] {
  return sanitize(bars, identity);
}

export function sanitizeAndNormalizeBars(bars: OHLCVBar[]): SanitizedBar[] {
  return sanitize(bars, normalizeBarDate);
}
