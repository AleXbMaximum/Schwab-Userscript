// ── Calendar HTML Parsing ─────────────────────────────────────────────────────
// Schwab wallst.com calendar and rating changes endpoints return HTML.
// These parsers extract structured data using DOMParser.

const sharedDOMParser = new DOMParser();

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalendarEventType =
  | "TodaysEvents"
  | "Earnings"
  | "Dividends"
  | "Splits"
  | "IPOs";

export interface CalendarEvent {
  date: string;
  company: string;
  symbol: string;
  eventType: string;
  detail: string;
}

export interface RatingChange {
  date: string;
  company: string;
  symbol: string;
  firm: string;
  action: string;
  rating: string;
  targetPrice: string;
}

// ── Parsers ───────────────────────────────────────────────────────────────────

export function parseCalendarHtml(html: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  try {
    const doc = sharedDOMParser.parseFromString(html, "text/html");
    const rows = doc.querySelectorAll("tr[data-symbol], .calendar-row, tr");

    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 3) continue;

      const symbol =
        row.getAttribute("data-symbol") ??
        cells[1]?.textContent?.trim() ??
        "";
      const company = cells[0]?.textContent?.trim() ?? "";
      const date = cells[2]?.textContent?.trim() ?? "";
      const eventType = cells[3]?.textContent?.trim() ?? "";
      const detail = cells[4]?.textContent?.trim() ?? "";

      if (!company && !symbol) continue;

      events.push({ date, company, symbol, eventType, detail });
    }
  } catch {
    // Fail-soft: return empty on parse error
  }
  return events;
}

export function parseRatingChangesHtml(html: string): RatingChange[] {
  const ratings: RatingChange[] = [];
  try {
    const doc = sharedDOMParser.parseFromString(html, "text/html");
    const rows = doc.querySelectorAll("tr[data-symbol], .rating-row, tr");

    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 4) continue;

      const company = cells[0]?.textContent?.trim() ?? "";
      const symbol =
        row.getAttribute("data-symbol") ??
        cells[1]?.textContent?.trim() ??
        "";
      const firm = cells[2]?.textContent?.trim() ?? "";
      const action = cells[3]?.textContent?.trim() ?? "";
      const rating = cells[4]?.textContent?.trim() ?? "";
      const targetPrice = cells[5]?.textContent?.trim() ?? "";
      const date = cells[6]?.textContent?.trim() ?? "";

      if (!company && !symbol) continue;

      ratings.push({ date, company, symbol, firm, action, rating, targetPrice });
    }
  } catch {
    // Fail-soft: return empty on parse error
  }
  return ratings;
}
