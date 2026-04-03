import { fetchMarkitToken } from "./auth";
import { gmGetWithHeaders } from "../yahoo/httpUtils";
import {
  parseCalendarHtml,
  parseRatingChangesHtml,
  type CalendarEvent,
  type CalendarEventType,
  type RatingChange,
} from "./parsing/calendarParser";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

// ── Calendar Events (wallst.com — GM.xmlHttpRequest) ─────────────────────────

const CALENDAR_EVENTS_URL =
  "https://schwab.wallst.com/tradesource/Markets/Calendar/CalendarEventsModule";

export async function fetchCalendarEvents(
  params?: { eventType?: CalendarEventType; activeDate?: string },
): Promise<CalendarEvent[]> {
  const eventType = params?.eventType ?? "TodaysEvents";
  const activeDate = params?.activeDate ?? "";
  const span = log.span("fetchCalendarEvents", { eventType, activeDate });

  try {
    const markitToken = await fetchMarkitToken();
    const urlParams = new URLSearchParams({
      eventType,
      token: markitToken,
    });
    if (activeDate) urlParams.set("activeDate", activeDate);

    const url = `${CALENDAR_EVENTS_URL}?${urlParams.toString()}`;
    const html = await gmGetWithHeaders(url, { Accept: "text/html" }, 15_000);
    const events = parseCalendarHtml(html);
    span.end("ok", { eventCount: events.length }, "debug");
    return events;
  } catch (err) {
    span.end(
      "error",
      { error: (err as Error)?.message ?? String(err) },
      "error",
    );
    throw err;
  }
}

// ── Rating Changes (wallst.com — GM.xmlHttpRequest) ──────────────────────────

const RATING_CHANGES_URL =
  "https://schwab.wallst.com/tradesource/Markets/Calendar/RatingChanges";

export async function fetchRatingChanges(): Promise<RatingChange[]> {
  const span = log.span("fetchRatingChanges");

  try {
    const markitToken = await fetchMarkitToken();
    const url = `${RATING_CHANGES_URL}?token=${encodeURIComponent(markitToken)}`;
    const html = await gmGetWithHeaders(url, { Accept: "text/html" }, 15_000);
    const ratings = parseRatingChangesHtml(html);
    span.end("ok", { ratingCount: ratings.length }, "debug");
    return ratings;
  } catch (err) {
    span.end(
      "error",
      { error: (err as Error)?.message ?? String(err) },
      "error",
    );
    throw err;
  }
}
