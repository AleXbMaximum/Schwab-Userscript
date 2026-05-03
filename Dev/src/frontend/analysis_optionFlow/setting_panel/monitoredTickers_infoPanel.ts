import { ui_createElement } from "frontend/components/core/builders/createElement";
import { DS_TYPOGRAPHY } from "frontend/components/core/styles/theme";
import {
  collectDbStats,
  collectStoreDetails,
} from "backend/core/db/core/dbStats";
import type {
  DbStats,
  StoreStats,
  StoreDetails,
} from "backend/core/db/core/dbStats";

// ── Styles ──

const LABEL_STYLE = DS_TYPOGRAPHY.heading + " margin-bottom: 10px;";
const BADGE_BG = "var(--ax-bg-chip)";
const CELL_STYLE =
  "padding: 5px 10px; border-bottom: 1px solid var(--ax-border-subtle); font-size: 12px;";
const CELL_RIGHT =
  CELL_STYLE +
  " text-align: right; font-variant-numeric: tabular-nums; font-weight: 600;";

// ── Helpers ──

function badge(
  label: string,
  value: string,
  bg: string = BADGE_BG,
): HTMLElement {
  return ui_createElement("div", {
    styleString:
      `display: inline-flex; flex-direction: column; align-items: center;` +
      ` padding: 8px 14px; background: ${bg}; border-radius: 12px; min-width: 70px;` +
      ` border: 1px solid var(--ax-border-subtle);`,
    children: [
      ui_createElement("span", {
        text: value,
        styleString:
          "font-size: 15px; font-weight: 700; color: var(--ios-text-primary); font-variant-numeric: tabular-nums;",
      }),
      ui_createElement("span", {
        text: label,
        styleString:
          "font-size: 10px; color: var(--ios-text-secondary); margin-top: 3px; font-weight: 500;",
      }),
    ],
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const FRIENDLY_NAMES: Record<string, string> = {
  kv: "KV Config",
  account_snapshot_history: "Account Snapshot History",
  account_snapshot_history_archive: "Account Snapshot Archive",
  monitor_openings: "Monitor Snapshots",
  timestamp_openings: "Saved Snapshots",
  opening_snapshots: "Opening Snapshots",
  opening_strike_aggregates: "Strike Aggregates",
  options_opening_strike_legs: "Strike Legs",
  options_feature_labels: "Feature Labels",
};

// ── Panel ──

export function renderDatabaseInfoPanel(): HTMLElement & {
  cleanup?: () => void;
  refresh?: () => Promise<void>;
} {
  const panel = ui_createElement("div", {}) as HTMLElement & {
    cleanup?: () => void;
    refresh?: () => Promise<void>;
  };

  // Title row
  const titleRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; flex-wrap: wrap; " +
      LABEL_STYLE,
  });
  titleRow.appendChild(ui_createElement("span", { text: "Database Info" }));

  const BTN_STYLE =
    "padding: 3px 10px; font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-semibold); border-radius: var(--ax-radius-md); cursor: pointer;" +
    " border: 1px solid var(--ax-border);" +
    " background: var(--ax-bg-input); color: var(--ax-fg-2);" +
    " font-family: var(--ax-font-body); transition: all 0.15s;";

  const loadBtn = ui_createElement("button", {
    text: "Load",
    styleString: BTN_STYLE,
  });
  titleRow.appendChild(loadBtn);

  const copyBtn = ui_createElement("button", {
    text: "Copy",
    styleString: BTN_STYLE + " display: none;",
  });
  titleRow.appendChild(copyBtn);
  panel.appendChild(titleRow);

  // Placeholder (shown before first load)
  const placeholder = ui_createElement("div", {
    text: 'Click "Load" to view database statistics.',
    styleString:
      "color: var(--ios-text-secondary, #999); font-size: 12px; padding: 8px 0;",
  });
  panel.appendChild(placeholder);

  // Summary badges
  const summaryRow = ui_createElement("div", {
    styleString:
      "display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;",
  });
  panel.appendChild(summaryRow);

  // Table
  const tableWrap = ui_createElement("div", {
    styleString: "overflow-x: auto;",
  });
  const table = document.createElement("table");
  table.style.cssText =
    "border-collapse: collapse; font-size: 12px; font-family: var(--ios-font, inherit);";
  tableWrap.appendChild(table);
  panel.appendChild(tableWrap);

  // State
  let destroyed = false;
  let lastStats: DbStats | null = null;
  const detailCache = new Map<string, StoreDetails | null>();
  const expandedStores = new Set<string>();
  let storeRowRefs: {
    store: StoreStats;
    arrow: HTMLElement;
    detailRow: HTMLTableRowElement;
    detailCell: HTMLTableCellElement;
  }[] = [];

  // ── Load & render ──

  async function load(): Promise<void> {
    if (destroyed) return;
    loadBtn.textContent = "Loading...";
    loadBtn.style.opacity = "0.5";
    detailCache.clear();
    expandedStores.clear();

    try {
      const stats = await collectDbStats();
      if (destroyed) return;
      lastStats = stats;
      placeholder.style.display = "none";
      render(stats);
      await expandAllDetails();
      if (destroyed) return;
      copyBtn.style.display = "";
    } catch {
      if (destroyed) return;
      lastStats = null;
      summaryRow.innerHTML = "";
      summaryRow.appendChild(
        ui_createElement("span", {
          text: "Failed to load database stats.",
          styleString: "color: var(--ios-gray); font-size: 12px;",
        }),
      );
      table.innerHTML = "";
    } finally {
      loadBtn.textContent = "Load";
      loadBtn.style.opacity = "1";
    }
  }

  function render(stats: DbStats): void {
    storeRowRefs = [];

    // ── Summary badges ──
    summaryRow.innerHTML = "";
    summaryRow.appendChild(badge("DB Version", `v${stats.dbVersion}`));
    summaryRow.appendChild(
      badge(
        "Total Records",
        formatCount(stats.totalRecords),
        "rgba(0,122,255,0.08)",
      ),
    );

    if (stats.totalEstimatedSizeBytes != null) {
      summaryRow.appendChild(
        badge(
          "Est. DB Size",
          `~${formatBytes(stats.totalEstimatedSizeBytes)}`,
          "rgba(88,86,214,0.08)",
        ),
      );
    }
    if (stats.estimatedOriginUsageBytes != null) {
      summaryRow.appendChild(
        badge(
          "Origin Storage",
          formatBytes(stats.estimatedOriginUsageBytes),
          BADGE_BG,
        ),
      );
    }

    // ── Store table ──
    table.innerHTML = "";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const col of ["Store", "Records", "Est. Size"]) {
      const th = document.createElement("th");
      th.textContent = col;
      th.style.cssText =
        "text-align: left; padding: 6px 10px; font-size: 11px; font-weight: 600;" +
        " color: var(--ios-text-secondary); border-bottom: 1px solid var(--ax-border);";
      if (col !== "Store") th.style.textAlign = "right";
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (const store of stats.stores) {
      const mainRow = document.createElement("tr");
      mainRow.style.cursor = "pointer";
      mainRow.style.transition = "background 0.1s";
      mainRow.addEventListener("mouseenter", () => {
        mainRow.style.background = "var(--ax-bg-row-hover)";
      });
      mainRow.addEventListener("mouseleave", () => {
        mainRow.style.background = "";
      });

      // Col 1: toggle arrow + name
      const tdName = document.createElement("td");
      tdName.style.cssText = CELL_STYLE;
      const arrow = ui_createElement("span", {
        text: "\u25B8 ",
        styleString:
          "color: var(--ios-text-secondary); font-size: 10px; display: inline-block; width: 14px; transition: transform 0.15s;",
      });
      tdName.appendChild(arrow);
      const friendlyName = FRIENDLY_NAMES[store.name] ?? store.name;
      tdName.appendChild(
        ui_createElement("span", {
          text: friendlyName,
          styleString: "font-weight: 600; color: var(--ios-text-primary);",
        }),
      );
      tdName.appendChild(
        ui_createElement("span", {
          text: ` (${store.name})`,
          styleString: "color: var(--ios-text-secondary); font-size: 10px;",
        }),
      );
      mainRow.appendChild(tdName);

      // Col 2: record count
      const tdCount = document.createElement("td");
      tdCount.textContent = store.count.toLocaleString();
      tdCount.style.cssText = CELL_RIGHT + " color: var(--ios-text-primary);";
      mainRow.appendChild(tdCount);

      // Col 3: estimated size
      const tdSize = document.createElement("td");
      tdSize.textContent =
        store.estimatedSizeBytes != null
          ? `~${formatBytes(store.estimatedSizeBytes)}`
          : "--";
      tdSize.style.cssText = CELL_RIGHT + " color: var(--ios-text-secondary);";
      mainRow.appendChild(tdSize);

      tbody.appendChild(mainRow);

      // Detail row (hidden by default)
      const detailRow = document.createElement("tr");
      detailRow.style.display = "none";
      const detailCell = document.createElement("td");
      detailCell.colSpan = 3;
      detailCell.style.cssText =
        "padding: 0; border-bottom: 1px solid var(--ax-border-subtle);";
      detailRow.appendChild(detailCell);
      tbody.appendChild(detailRow);

      storeRowRefs.push({ store, arrow, detailRow, detailCell });

      // Toggle handler
      mainRow.addEventListener("click", () => {
        void toggleDetail(store, arrow, detailRow, detailCell);
      });
    }

    table.appendChild(tbody);
  }

  async function toggleDetail(
    store: StoreStats,
    arrow: HTMLElement,
    detailRow: HTMLTableRowElement,
    detailCell: HTMLTableCellElement,
  ): Promise<void> {
    if (expandedStores.has(store.name)) {
      // Collapse
      expandedStores.delete(store.name);
      detailRow.style.display = "none";
      arrow.style.transform = "";
      return;
    }

    // Expand
    expandedStores.add(store.name);
    detailRow.style.display = "";
    arrow.style.transform = "rotate(90deg)";

    if (!detailCache.has(store.name)) {
      detailCell.innerHTML = "";
      detailCell.appendChild(
        ui_createElement("span", {
          text: "Loading details...",
          styleString:
            "display: block; padding: 6px 10px 6px 32px; font-size: 11px; color: var(--ios-gray);",
        }),
      );

      const details = await collectStoreDetails(store.name);
      detailCache.set(store.name, details);
    }

    renderDetailContent(detailCell, detailCache.get(store.name) ?? null, store);
  }

  async function expandAllDetails(): Promise<void> {
    await Promise.all(
      storeRowRefs.map(async ({ store, arrow, detailRow, detailCell }) => {
        expandedStores.add(store.name);
        detailRow.style.display = "";
        arrow.style.transform = "rotate(90deg)";

        if (!detailCache.has(store.name)) {
          detailCell.innerHTML = "";
          detailCell.appendChild(
            ui_createElement("span", {
              text: "Loading...",
              styleString:
                "display: block; padding: 6px 10px 6px 32px; font-size: 11px; color: var(--ios-gray);",
            }),
          );
          const details = await collectStoreDetails(store.name);
          detailCache.set(store.name, details);
        }
        renderDetailContent(
          detailCell,
          detailCache.get(store.name) ?? null,
          store,
        );
      }),
    );
  }

  function renderDetailContent(
    container: HTMLTableCellElement,
    details: StoreDetails | null,
    store: StoreStats,
  ): void {
    container.innerHTML = "";

    if (!details || (details.groups.length === 0 && !details.dateRange)) {
      container.appendChild(
        ui_createElement("span", {
          text: store.count === 0 ? "Empty store." : "No breakdown available.",
          styleString:
            "display: block; padding: 4px 10px 4px 28px; font-size: 11px; color: var(--ios-gray);",
        }),
      );
      return;
    }

    const wrap = ui_createElement("div", {
      styleString: "padding: 2px 10px 4px 28px;",
    });

    // Date range (account snapshot history stores)
    if (details.dateRange) {
      const oldest = formatDateShort(details.dateRange.oldest);
      const newest = formatDateShort(details.dateRange.newest);
      wrap.appendChild(
        ui_createElement("div", {
          styleString:
            "font-size: 11px; color: var(--ios-text-secondary); margin-bottom: 2px;",
          text: `Range: ${oldest} \u2192 ${newest}`,
        }),
      );
    }

    // Groups — inline flow for high density
    if (details.groups.length > 0) {
      const flow = ui_createElement("div", {
        styleString:
          "display: flex; flex-wrap: wrap; gap: 1px 10px; font-size: 11px;",
      });

      for (const group of details.groups) {
        const val =
          details.groupUnit === "bytes"
            ? formatBytes(group.count)
            : group.count.toLocaleString();
        flow.appendChild(
          ui_createElement("span", {
            styleString: "white-space: nowrap; color: var(--ios-text-primary);",
            children: [
              ui_createElement("span", {
                text: group.key,
                styleString: "font-weight: 500;",
              }),
              ui_createElement("span", {
                text: ` ${val}`,
                styleString: "color: var(--ios-text-secondary);",
              }),
            ],
          }),
        );
      }

      wrap.appendChild(flow);
    }

    container.appendChild(wrap);
  }

  // ── Init ──

  loadBtn.addEventListener("click", () => {
    void load();
  });

  copyBtn.addEventListener("click", () => {
    if (!lastStats) return;
    const text = formatStatsReport(lastStats, detailCache);
    void navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1500);
    });
  });

  panel.cleanup = () => {
    destroyed = true;
  };
  panel.refresh = load;

  return panel;
}

function formatStatsReport(
  stats: DbStats,
  details: Map<string, StoreDetails | null>,
): string {
  const lines: string[] = [];
  lines.push("Database Info Report");
  lines.push("=".repeat(64));
  lines.push(`DB Version: v${stats.dbVersion}`);
  lines.push(`Total Records: ${formatCount(stats.totalRecords)}`);
  if (stats.totalEstimatedSizeBytes != null) {
    lines.push(`Est. DB Size: ~${formatBytes(stats.totalEstimatedSizeBytes)}`);
  }
  if (stats.estimatedOriginUsageBytes != null) {
    lines.push(
      `Origin Storage: ${formatBytes(stats.estimatedOriginUsageBytes)}`,
    );
  }
  lines.push("");
  lines.push(
    "Store".padEnd(40) + "Records".padStart(10) + "Est. Size".padStart(14),
  );
  lines.push("-".repeat(64));
  for (const store of stats.stores) {
    const name = FRIENDLY_NAMES[store.name] ?? store.name;
    const count = store.count.toLocaleString();
    const size =
      store.estimatedSizeBytes != null
        ? `~${formatBytes(store.estimatedSizeBytes)}`
        : "--";
    lines.push(
      `* ${name} (${store.name})`.padEnd(40) +
        count.padStart(10) +
        size.padStart(14),
    );

    const det = details.get(store.name);
    if (det) {
      if (det.dateRange) {
        lines.push(
          `  Range: ${formatDateShort(det.dateRange.oldest)} \u2192 ${formatDateShort(det.dateRange.newest)}`,
        );
      }
      if (det.groups.length > 0) {
        const items = det.groups.map((g) => {
          const val =
            det.groupUnit === "bytes"
              ? formatBytes(g.count)
              : g.count.toLocaleString();
          return `${g.key} ${val}`;
        });
        lines.push(`  ${items.join(" \u00b7 ")}`);
      }
    }
  }
  return lines.join("\n");
}

function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}
