import { ui_createElement } from "../core/createElement";
import { injectStylesheet } from "../core/ui_builders";
import { DS_COLORS, DS_TYPOGRAPHY, DS_SPACING, DS_RADIUS } from "../core/theme";
import { DataFetcher } from "../../../backend/services/ai/pipeline/DataFetcher";
import { chartDataService } from "../../../backend/core/network/chart/ChartDataService";
import type { BarronsDataBundle } from "../../../backend/core/network/barrons/types";
import { formatTimeAgo } from "shared/utils/time";
import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { KVStore } from "backend/core/db/core/KVStore";
import { renderPanelContent } from "./CompanyDataSections";

// ── CompanyDetailsPanel ─────────────────────────────────────────────────────
// Reusable modal that displays Barron's company info: profile, executives,
// financial ratios, key data, analyst consensus, and peers.
// Caches data in IndexedDB (KVStore) per symbol. On open, shows cached data
// immediately while fetching fresh data in the background.

const PANEL_ID = "alexquant-company-details-panel";
const CACHE_KEY_PREFIX = "barrons-cache:";

// ── IDB Cache helpers ───────────────────────────────────────────────────────

async function getCachedData(
  symbol: string,
): Promise<BarronsDataBundle | undefined> {
  try {
    const db = await openAlexQuantDB();
    const kv = new KVStore(db);
    return await kv.get<BarronsDataBundle>(`${CACHE_KEY_PREFIX}${symbol}`);
  } catch {
    return undefined;
  }
}

async function setCachedData(
  symbol: string,
  data: BarronsDataBundle,
): Promise<void> {
  try {
    const db = await openAlexQuantDB();
    const kv = new KVStore(db);
    await kv.set(`${CACHE_KEY_PREFIX}${symbol}`, data);
  } catch {
    // Cache write failure is non-critical
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function openCompanyDetailsPanel(symbol: string): void {
  const existing = document.getElementById(PANEL_ID);
  if (existing) existing.remove();

  const overlay = ui_createElement("div", {
    props: { id: PANEL_ID },
    styleString:
      "position: fixed; inset: 0; z-index: var(--z-modal-backdrop, 100500); background: rgba(0,0,0,0.4);" +
      " display: flex; align-items: center; justify-content: center;" +
      " -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);",
  });

  const modal = ui_createElement("div", {
    styleString:
      "background: rgba(248,248,252,0.97); border-radius: 20px; width: min(880px, 94vw);" +
      " max-height: 85vh; display: flex; flex-direction: column; overflow: hidden;" +
      " box-shadow: var(--ios-shadow), 0 0 0 1px rgba(255,255,255,0.5);" +
      " transform: scale(0.95); opacity: 0; transition: transform 0.3s cubic-bezier(.2,.9,.3,1), opacity 0.25s ease;",
  });

  // Header row
  const header = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; padding: 16px 24px;" +
      " border-bottom: 1px solid var(--ios-border); flex-shrink: 0;" +
      " background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.3));",
  });
  header.appendChild(
    ui_createElement("span", {
      text: "COMPANY",
      styleString: DS_TYPOGRAPHY.metricLabel + " margin-right: 10px;",
    }),
  );

  const titleEl = ui_createElement("span", {
    text: symbol,
    styleString:
      "font-size: 18px; font-weight: 700; color: var(--ios-text-primary);" +
      " flex: 1; letter-spacing: -0.3px;",
  });
  header.appendChild(titleEl);

  // Timestamp badge (shows cached data age) + refresh status indicator
  const statusArea = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; margin-right: 12px;",
  });

  const timestampBadge = ui_createElement("span", {
    text: "",
    styleString:
      DS_TYPOGRAPHY.caption +
      ` background: ${DS_COLORS.bgSubtle}; padding: 2px 8px; border-radius: ${DS_RADIUS.xs};` +
      " white-space: nowrap;",
  });
  statusArea.appendChild(timestampBadge);

  // Small inline spinner for background refresh
  const refreshIndicator = ui_createElement("div", {
    styleString:
      "width: 14px; height: 14px; border: 1.5px solid var(--ios-border);" +
      ` border-top-color: ${DS_COLORS.info}; border-radius: ${DS_RADIUS.full};` +
      " animation: alexquant-spin 0.8s linear infinite; display: none; flex-shrink: 0;",
  });
  statusArea.appendChild(refreshIndicator);

  header.appendChild(statusArea);

  const closeBtn = ui_createElement("button", {
    text: "\u00d7",
    styleString:
      "background: rgba(0,0,0,0.05); border: none; font-size: 18px; cursor: pointer;" +
      ` color: var(--ios-text-secondary); width: 28px; height: 28px; border-radius: ${DS_RADIUS.full};` +
      " display: flex; align-items: center; justify-content: center; line-height: 1;" +
      " transition: background 0.15s;",
  }) as HTMLButtonElement;
  header.appendChild(closeBtn);

  // Scrollable content area
  const contentArea = ui_createElement("div", {
    styleString:
      `flex: 1; overflow-y: auto; padding: ${DS_SPACING["2xl"]} ${DS_SPACING["3xl"]};` +
      " display: flex; flex-direction: column; gap: 8px;",
  });

  // Inject spinner keyframes if not already present
  injectStylesheet(
    "alexquant-spin-kf",
    "@keyframes alexquant-spin{to{transform:rotate(360deg)}}",
  );

  modal.appendChild(header);
  modal.appendChild(contentArea);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    modal.style.transform = "scale(1)";
    modal.style.opacity = "1";
  });

  const closeModal = () => {
    modal.style.transform = "scale(0.95)";
    modal.style.opacity = "0";
    setTimeout(() => overlay.remove(), 300);
  };

  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e: MouseEvent) => {
    if (e.target === overlay) closeModal();
  });

  // ── Helper: render data into contentArea ────────────────────────────
  const renderData = (data: BarronsDataBundle) => {
    contentArea.innerHTML = "";

    // Update header title with company name
    if (data.companyDetails?.name) {
      titleEl.textContent = `${symbol} — ${data.companyDetails.name}`;
    }

    // Update timestamp badge
    if (data.fetchedAt) {
      timestampBadge.textContent = `fetched ${formatTimeAgo(data.fetchedAt, { includeJustNow: false })}`;
      timestampBadge.style.display = "";
    }

    contentArea.appendChild(renderPanelContent(data));

    // Footer
    contentArea.appendChild(
      ui_createElement("div", {
        text: `Data from Barron's · fetched ${formatTimeAgo(data.fetchedAt, { includeJustNow: false })}`,
        styleString:
          DS_TYPOGRAPHY.caption +
          " text-align: center; margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--ios-border);",
      }),
    );
  };

  const showLoading = () => {
    contentArea.innerHTML = "";
    contentArea.appendChild(
      ui_createElement("div", {
        styleString:
          "display: flex; flex-direction: column; align-items: center; justify-content: center;" +
          " padding: 48px 24px; gap: 12px;",
        children: [
          ui_createElement("div", {
            styleString:
              "width: 24px; height: 24px; border: 2px solid var(--ios-border);" +
              ` border-top-color: ${DS_COLORS.info}; border-radius: ${DS_RADIUS.full};` +
              " animation: alexquant-spin 0.8s linear infinite;",
          }),
          ui_createElement("span", {
            text: "Loading company details…",
            styleString: DS_TYPOGRAPHY.caption,
          }),
        ],
      }),
    );
  };

  // ── Cache-first fetch flow ──────────────────────────────────────────
  void (async () => {
    let hasCachedRender = false;

    // 1. Try to show cached data immediately
    const cached = await getCachedData(symbol);
    if (cached) {
      renderData(cached);
      hasCachedRender = true;
    } else {
      showLoading();
    }

    // 2. Background fetch fresh data
    refreshIndicator.style.display = "";
    try {
      const fetcher = new DataFetcher({ chartDataService });
      const freshData = await fetcher.fetchBarronsData(symbol);

      refreshIndicator.style.display = "none";

      if (freshData) {
        // Save to cache
        await setCachedData(symbol, freshData);
        // Re-render with fresh data
        renderData(freshData);
      } else if (!hasCachedRender) {
        // No fresh data and no cache — show empty state
        contentArea.innerHTML = "";
        contentArea.appendChild(
          ui_createElement("div", {
            text: "No Barron's data available for this symbol.",
            styleString:
              "font-size: 13px; color: var(--ios-text-secondary); text-align: center; padding: 24px;",
          }),
        );
      }
      // If freshData is null but we have cached render, just keep showing cached data
    } catch (err) {
      refreshIndicator.style.display = "none";

      if (!hasCachedRender) {
        // No cache and fetch failed — show error
        contentArea.innerHTML = "";
        contentArea.appendChild(
          ui_createElement("div", {
            text: `Failed to load: ${err instanceof Error ? err.message : String(err)}`,
            styleString: `font-size: 13px; color: ${DS_COLORS.negative}; text-align: center; padding: 24px;`,
          }),
        );
      } else {
        // Has cached data — show a small transient error toast in the header area
        const errorToast = ui_createElement("span", {
          text: "refresh failed",
          styleString:
            `font-size: 9px; color: ${DS_COLORS.negative}; background: ${DS_COLORS.bgNegative};` +
            ` padding: 2px 6px; border-radius: ${DS_RADIUS.xs}; white-space: nowrap;`,
        });
        statusArea.appendChild(errorToast);
        setTimeout(() => errorToast.remove(), 5000);
      }
    }
  })();
}
