/**
 * Source-status indicator — a row of dots reflecting per-news-source health.
 *
 * Status mapping:
 *   green   last_success within 10 min, no last_error
 *   yellow  last_error present, but a recent success exists (transient)
 *   red     last_error present and no recent success
 *   gray    no row yet (source has not run since boot)
 *
 * Tooltip carries last_success / last_error as humanized strings.
 *
 * Inline-styled port of AlexQuant's `live-News/components/sourceStatusIndicator.ts`,
 * driven by Schwaber's `newsService.getSourceHealth()` instead of Rust IPC.
 */

import { ui_createElement } from "../../components/core/builders/createElement";
import { newsService } from "../../../backend/services/news/NewsService";
import type {
  NewsFetchSource,
  NewsSourceStateRow,
} from "../../../backend/services/news/NewsService";

const SOURCE_ORDER: NewsFetchSource[] = [
  "financialJuice",
  "yahooMacro",
  "yahooSymbol",
  "schwab",
  "barrons",
];

const POLL_MS = 10_000;
const RECENT_SUCCESS_WINDOW_MS = 10 * 60 * 1000;

type DotStatus = "green" | "yellow" | "red" | "gray";

function statusFor(row: NewsSourceStateRow | undefined): DotStatus {
  if (!row) return "gray";
  const now = Date.now();
  const success = row.lastSuccessAtUtcMs ?? 0;
  const recentSuccess = success > 0 && now - success < RECENT_SUCCESS_WINDOW_MS;
  if (row.lastError) {
    return recentSuccess ? "yellow" : "red";
  }
  return recentSuccess ? "green" : "gray";
}

function dotColor(status: DotStatus): string {
  switch (status) {
    case "green":
      return "var(--ios-green, #30d158)";
    case "yellow":
      return "var(--ios-orange, #d78100)";
    case "red":
      return "var(--ios-red, #d73126)";
    case "gray":
      return "var(--ios-text-secondary, #8e8e93)";
  }
}

function formatTimeAgo(utcMs: number): string {
  const diffMs = Math.max(0, Date.now() - utcMs);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function buildTooltip(row: NewsSourceStateRow | undefined): string {
  if (!row) return "Source: not yet polled";
  const lines: string[] = [row.label];
  if (row.lastSuccessAtUtcMs > 0) {
    lines.push(`✓ last success ${formatTimeAgo(row.lastSuccessAtUtcMs)}`);
  } else {
    lines.push("✗ no successful fetch yet");
  }
  if (row.lastError) {
    lines.push(`error: ${row.lastError.slice(0, 120)}`);
  }
  return lines.join("\n");
}

export interface SourceStatusIndicatorHandle {
  element: HTMLElement;
  cleanup: () => void;
  /** Force an immediate poll (call after a manual refresh). */
  refresh: () => void;
}

export function createSourceStatusIndicator(): SourceStatusIndicatorHandle {
  const wrap = ui_createElement("div", {
    className: "ax-news-source-status",
    styleString:
      "display: flex; align-items: center; gap: 5px; flex-shrink: 0;",
  });

  const dotById = new Map<NewsFetchSource, HTMLElement>();
  for (const sourceType of SOURCE_ORDER) {
    const dot = ui_createElement("span", {
      props: { title: `${sourceType}: pending` },
      styleString:
        "width: 8px; height: 8px; border-radius: 50%;" +
        " background: var(--ios-text-secondary, #8e8e93); transition: background 0.15s;",
    });
    dotById.set(sourceType, dot);
    wrap.appendChild(dot);
  }

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const apply = (rows: NewsSourceStateRow[]) => {
    const byType = new Map(rows.map((r) => [r.sourceType, r]));
    for (const sourceType of SOURCE_ORDER) {
      const dot = dotById.get(sourceType);
      if (!dot) continue;
      const row = byType.get(sourceType);
      const status = statusFor(row);
      dot.style.background = dotColor(status);
      dot.title = buildTooltip(row);
    }
  };

  const tick = (): void => {
    if (cancelled) return;
    try {
      apply(newsService.getSourceHealth());
    } catch {
      // News service may not be initialized yet.
    }
    if (!cancelled) {
      timer = setTimeout(tick, POLL_MS);
    }
  };

  tick();

  return {
    element: wrap,
    cleanup: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
    refresh: () => tick(),
  };
}
