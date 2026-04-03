import { ui_createElement } from "../../../components/core/createElement";
import { SNAPSHOT_METRICS, TIME_RANGES } from "../timelineConstants";
import { SMA_OPTIONS } from "../timelinePrefs";
import {
  APP_TIMEZONE,
  getMarketSessionCT,
  type MarketSession,
} from "../../../../shared/utils/time";
import {
  DS_COLORS,
  DS_SPACING,
  DS_RADIUS,
  DS_LINE_HEIGHT,
} from "../../../components/core/theme";

// ── Shared pill token ──────────────────────────────────────────────
const PILL_BASE =
  `padding: ${DS_SPACING.sm} ${DS_SPACING.md};` +
  ` border: 1px solid ${DS_COLORS.border};` +
  ` border-radius: ${DS_RADIUS.sm};` +
  ` font-size: 12px; line-height: ${DS_LINE_HEIGHT.snug};` +
  ' font-family: var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);' +
  ` background: ${DS_COLORS.bgPanel};` +
  ` color: ${DS_COLORS.textPrimary};` +
  " white-space: nowrap;";

/** Muted variant for inactive secondary controls (SMA Off). */
const PILL_MUTED =
  `padding: ${DS_SPACING.sm} ${DS_SPACING.md};` +
  ` border: 1px solid ${DS_COLORS.border};` +
  ` border-radius: ${DS_RADIUS.sm};` +
  ` font-size: 12px; line-height: ${DS_LINE_HEIGHT.snug};` +
  ' font-family: var(--ios-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);' +
  ` background: ${DS_COLORS.bgPanel};` +
  ` color: ${DS_COLORS.muted};` +
  " white-space: nowrap;";

const SESSION_COLOR_MAP: Record<MarketSession, string> = {
  Open: "var(--ios-green, #20a945)",
  "Pre-Mkt": "var(--ios-orange, #D78100)",
  "After-Hrs": "var(--ios-orange, #D78100)",
  Closed: "var(--ios-red, #d73126)",
};

export type TimelineControlElements = {
  chartHeader: HTMLElement;
  metricSelect: HTMLSelectElement;
  timeRangeSelect: HTMLSelectElement;
  smaSelect: HTMLSelectElement;
  sma2Select: HTMLSelectElement;
  chartModeToggle: HTMLButtonElement;
  overlayWrap: HTMLElement;
  statusBar: HTMLElement;
  statusTextEl: HTMLElement;
  statusDot: HTMLElement;
  statusLabelEl: HTMLElement;
  pillsContainer: HTMLElement;
  metricSelectWrap: HTMLElement;
};

export function buildTimelineControls(): TimelineControlElements {
  // ── Root container: space-between for primary/secondary split ───
  const chartHeader = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; justify-content: flex-start;" +
      ` gap: ${DS_SPACING.sm}; flex-wrap: wrap;`,
  });

  // ── Status bar (unchanged) ─────────────────────────────────────
  const statusBar = ui_createElement("div", {
    styleString:
      `display: flex; align-items: center; gap: ${DS_SPACING.sm};` +
      ` font-size: 11px; color: ${DS_COLORS.muted}; white-space: nowrap;`,
  });
  const statusTextEl = ui_createElement("span", { text: "--" });
  const statusDot = ui_createElement("span", {
    styleString:
      "width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;" +
      " background: var(--ios-red, #d73126);",
  });
  statusBar.appendChild(statusTextEl);
  statusBar.appendChild(statusDot);
  const statusLabelEl = ui_createElement("span", {
    text: "",
    styleString: "font-size: 10px; font-weight: 600;",
  });
  statusBar.appendChild(statusLabelEl);

  // ── Pills container: two groups ────────────────────────────────
  const pillsContainer = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; justify-content: space-between;" +
      " flex-wrap: wrap; width: 100%;",
  });

  // ── Primary group: metric, timeRange, chartMode ────────────────
  const primaryGroup = ui_createElement("div", {
    styleString:
      `display: flex; align-items: center; gap: ${DS_SPACING.sm}; flex-wrap: wrap;`,
  });

  const metricSelectWrap = ui_createElement("div", {
    styleString: `display: flex; align-items: center; gap: ${DS_SPACING.sm};`,
  });
  const metricSelect = ui_createElement("select", {
    styleString: PILL_BASE,
  }) as HTMLSelectElement;
  for (const metric of SNAPSHOT_METRICS) {
    const option = document.createElement("option");
    option.value = metric.key;
    option.textContent = metric.label;
    metricSelect.appendChild(option);
  }
  metricSelectWrap.appendChild(metricSelect);

  const timeRangeSelect = ui_createElement("select", {
    styleString: PILL_BASE,
  }) as HTMLSelectElement;
  for (const range of TIME_RANGES) {
    const option = document.createElement("option");
    option.value = range.label;
    option.textContent = range.label;
    timeRangeSelect.appendChild(option);
  }

  const chartModeToggle = ui_createElement("button", {
    text: "Line",
    styleString:
      PILL_BASE + " cursor: pointer; min-width: 52px; text-align: center;",
  }) as HTMLButtonElement;

  const overlayWrap = ui_createElement("div", {
    styleString:
      `display: none; gap: ${DS_SPACING.sm}; align-items: center; flex-wrap: wrap;`,
  });

  primaryGroup.appendChild(metricSelectWrap);
  primaryGroup.appendChild(timeRangeSelect);
  primaryGroup.appendChild(chartModeToggle);
  primaryGroup.appendChild(overlayWrap);

  // ── Secondary group: SMA controls (muted when off) ─────────────
  const secondaryGroup = ui_createElement("div", {
    styleString:
      `display: flex; align-items: center; gap: ${DS_SPACING.sm};`,
  });

  const smaSelect = ui_createElement("select", {
    styleString: PILL_MUTED,
  }) as HTMLSelectElement;
  for (const period of SMA_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = String(period);
    opt.textContent = period === 0 ? "SMA Off" : `SMA${period}`;
    smaSelect.appendChild(opt);
  }

  const sma2Select = ui_createElement("select", {
    styleString: PILL_MUTED,
  }) as HTMLSelectElement;
  for (const period of SMA_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = String(period);
    opt.textContent = period === 0 ? "SMA2 Off" : `SMA${period}`;
    sma2Select.appendChild(opt);
  }

  secondaryGroup.appendChild(smaSelect);
  secondaryGroup.appendChild(sma2Select);

  // ── Assemble ───────────────────────────────────────────────────
  pillsContainer.appendChild(primaryGroup);
  pillsContainer.appendChild(secondaryGroup);
  chartHeader.appendChild(pillsContainer);

  return {
    chartHeader,
    metricSelect,
    timeRangeSelect,
    smaSelect,
    sma2Select,
    chartModeToggle,
    overlayWrap,
    statusBar,
    statusTextEl,
    statusDot,
    statusLabelEl,
    pillsContainer,
    metricSelectWrap,
  };
}

/** Format bucket resolution as a short human-readable string (e.g. "1m", "5m", "1h"). */
function formatBucketLabel(bucketMs: number): string {
  if (bucketMs >= 86_400_000) return `${bucketMs / 86_400_000}d`;
  if (bucketMs >= 3_600_000) return `${bucketMs / 3_600_000}h`;
  return `${bucketMs / 60_000}m`;
}

/** Update option labels in an SMA select to include bucket resolution (e.g. "SMA20 @5m"). */
export function updateSmaSelectLabels(
  select: HTMLSelectElement,
  bucketMs: number,
  isSecondary: boolean,
): void {
  const label = formatBucketLabel(bucketMs);
  const opts = select.options;
  for (let i = 0; i < opts.length; i++) {
    const period = Number(opts[i].value);
    if (period === 0) {
      opts[i].textContent = isSecondary ? "SMA2 Off" : "SMA Off";
    } else {
      opts[i].textContent = `SMA${period} @${label}`;
    }
  }
  syncSmaSelectStyle(select);
}

/** Toggle pill style between active/muted based on selected SMA period. */
export function syncSmaSelectStyle(select: HTMLSelectElement): void {
  const isOff = select.value === "0";
  select.style.cssText = isOff ? PILL_MUTED : PILL_BASE;
}

export function formatStatusTimestamp(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "--";

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIMEZONE,
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const mon = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    const hh = parts.find((p) => p.type === "hour")?.value;
    const mm = parts.find((p) => p.type === "minute")?.value;
    const ss = parts.find((p) => p.type === "second")?.value;
    if (mon && day && hh && mm && ss) {
      return `${mon}-${day} ${hh}:${mm}:${ss}`;
    }
  } catch {}

  const mon = d.toLocaleString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${mon}-${day} ${hh}:${mm}:${ss}`;
}

export function updateStatusBar(
  statusTextEl: HTMLElement,
  statusDot: HTMLElement,
  statusLabelEl: HTMLElement,
  plotPointsLength: number,
  latestTs: number | null,
): void {
  const nowTs = Date.now();
  const session = getMarketSessionCT(nowTs);
  const sessionColor = SESSION_COLOR_MAP[session] ?? "var(--ios-gray)";
  statusDot.style.background = sessionColor;
  statusLabelEl.style.color = sessionColor;

  if (plotPointsLength === 0) {
    statusTextEl.textContent = `${formatStatusTimestamp(nowTs)} · 0 pts`;
    statusLabelEl.textContent =
      session === "Closed" ? "Closed (last update --)" : session;
    return;
  }

  statusTextEl.textContent = `${formatStatusTimestamp(nowTs)} · ${plotPointsLength} pts`;
  statusLabelEl.textContent =
    session === "Closed"
      ? `Closed (last update ${formatStatusTimestamp(latestTs!)})`
      : session;
}
