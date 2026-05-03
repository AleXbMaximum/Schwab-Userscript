import { ui_createElement } from "../components/core/builders/createElement";
import { DS_SPACING } from "../components/core/styles/theme";
import type { AccountOverviewMetrics } from "backend/computation/holdings/metrics/accountOverviewMetrics";
import { openAlexQuantDB } from "backend/core/db/core/AlexQuantDB";
import { KVStore } from "backend/core/db/core/KVStore";
import type { DataPipelineCoordinator } from "../components/DataPipelineCoordinator";
import type { BalancesSnapshot } from "../../backend/core/network/schwab/endpoints/balances";
import { newsService } from "backend/services/news/NewsService";
import { onLayoutModeChange, getLayoutMode } from "../components/core/behaviors/layoutMode";
import { onShareModeChange } from "shared/utils/domain/globalShareMode";
import { createSnapshotNewsSection } from "./snapshotNewsSection";
import { buildSnapshotMetricsDOM, patchSnapshotMetricsDOM } from "./metrics/metricsDOM";
import {
  buildSideTab,
  buildSlidePanel,
  showPanel,
  hidePanel,
  TAB_TOP,
  PANEL_WIDTH_VW,
  PANEL_MIN_WIDTH_PX,
  PANEL_MAX_WIDTH_PX,
} from "./panel/slidePanel";

// ── Constants ────────────────────────────────────────────────────────────
const KV_SIDE_STATE_KEY = "ui.floatingSnapshot.sideState";

type FloatingSnapshotResult = {
  element: HTMLElement;
  destroy: () => void;
};

export type TimelinePanelController = {
  element: HTMLElement;
  refresh: () => void;
  destroy: () => void;
};

export type FloatingSnapshotDeps = {
  createTimelinePanel: () => TimelinePanelController;
};

// ── Persisted state ──────────────────────────────────────────────────────
type SideState = { snapshot: boolean };

function savePref(key: string, value: unknown): void {
  void (async () => {
    try {
      const db = await openAlexQuantDB();
      const kv = new KVStore(db);
      await kv.set(key, value);
    } catch {
      /* silent */
    }
  })();
}

async function loadPref<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openAlexQuantDB();
    const kv = new KVStore(db);
    return await kv.get<T>(key);
  } catch {
    return undefined;
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  Main export
// ══════════════════════════════════════════════════════════════════════════

export function createFloatingSnapshot(
  headerController: DataPipelineCoordinator,
  _uiElements: Record<string, any>,
  deps: FloatingSnapshotDeps,
): FloatingSnapshotResult {
  let unsubscribe: (() => void) | null = null;
  let unsubscribeNews: (() => void) | null = null;
  let timelineCtrl: TimelinePanelController | null = null;
  const changeView =
    typeof _uiElements.changeView === "function"
      ? (_uiElements.changeView as (v: string) => void)
      : null;

  // ── Build Snapshot side tab + panel ──────────────────────────
  const snapshotTab = buildSideTab(
    "Snapshot",
    "var(--ios-blue, #007AFF)",
    TAB_TOP,
  );
  const snapshotSlide = buildSlidePanel("Snapshot");
  snapshotSlide.panel.style.display = "none";
  snapshotSlide.body.style.overflowY = "hidden";

  // ── Populate snapshot panel content (metrics + live chart + news) ──────
  const metricsWrap = ui_createElement("div", {
    styleString: `margin-bottom:${DS_SPACING.lg};`,
  });
  timelineCtrl = deps.createTimelinePanel();
  const newsSection = createSnapshotNewsSection(
    changeView ? () => changeView("NEWS") : undefined,
  );
  snapshotSlide.body.appendChild(metricsWrap);
  snapshotSlide.body.appendChild(timelineCtrl.element);
  snapshotSlide.body.appendChild(newsSection.element);

  // ── Toggle logic ──────────────────────────────────────────────
  let snapshotOpen = false;
  const persistState = () => {
    savePref(KV_SIDE_STATE_KEY, { snapshot: snapshotOpen } as SideState);
  };

  let snapshotHideTimer: ReturnType<typeof setTimeout> | null = null;
  const snapshotTimer = { ref: snapshotHideTimer };

  const syncLayout = () => {
    const isMobile = getLayoutMode() === "mobile";

    if (snapshotOpen) {
      showPanel(snapshotSlide.panel, snapshotTimer);
    } else {
      hidePanel(snapshotSlide.panel, snapshotTimer, () => snapshotOpen);
    }

    const mainContainer = _uiElements.container as HTMLElement | undefined;
    if (mainContainer) {
      if (isMobile) {
        mainContainer.style.width = "";
      } else {
        mainContainer.style.width = snapshotOpen
          ? `min(82vw, calc(100vw - clamp(${PANEL_MIN_WIDTH_PX}px, ${PANEL_WIDTH_VW}, ${PANEL_MAX_WIDTH_PX}px) - 10px))`
          : "82vw";
      }
    }

    snapshotSlide.panel.style.top = "0";
    snapshotSlide.panel.style.height = "auto";
    snapshotSlide.panel.style.maxHeight = "100vh";
    snapshotTab.tab.style.display = isMobile || snapshotOpen ? "none" : "flex";
  };

  const doToggleSnapshot = () => {
    snapshotOpen = !snapshotOpen;
    syncLayout();
    persistState();
    if (snapshotOpen) {
      requestAnimationFrame(() => {
        rebuildMetrics();
        timelineCtrl?.refresh();
        window.dispatchEvent(new Event("resize"));
      });
    }
  };

  snapshotTab.tab.addEventListener("click", doToggleSnapshot);
  snapshotSlide.closeBtn.addEventListener("click", doToggleSnapshot);

  const unsubMode = onLayoutModeChange((mode) => {
    if (mode === "mobile" && snapshotOpen) {
      snapshotOpen = false;
      persistState();
    }
    syncLayout();
  });

  // ── Mount to document.body ───────────────────────────────────
  const root = ui_createElement("div", {
    props: { id: "alexquant-floating-snapshot" },
    styleString: "display:none;",
  });
  document.body.appendChild(snapshotTab.tab);
  document.body.appendChild(snapshotSlide.panel);
  syncLayout();

  // ── News feed subscription ─────────────────────────────────────
  newsSection.update(newsService.getItems());
  unsubscribeNews = newsService.subscribe((items) => {
    newsSection.update(items);
  });

  // ── Data subscription ────────────────────────────────────────
  let lastOverview: AccountOverviewMetrics | null = null;
  let lastBalances: BalancesSnapshot | null = null;
  let metricsBuilt = false;
  let valueSpans: HTMLSpanElement[] = [];
  let detailValueSpans: HTMLSpanElement[] = [];
  let detailSection: HTMLElement | null = null;

  const rebuildMetrics = () => {
    if (!lastOverview) return;
    metricsWrap.innerHTML = "";
    const { element, primarySpans, detailSpans, detailWrap } =
      buildSnapshotMetricsDOM(lastOverview, metricsWrap, lastBalances);
    metricsWrap.appendChild(element);
    valueSpans = primarySpans;
    detailValueSpans = detailSpans;
    detailSection = detailWrap;
    metricsBuilt = true;
  };

  const patchMetrics = () => {
    if (!lastOverview || !metricsBuilt) return;
    patchSnapshotMetricsDOM(lastOverview, lastBalances, valueSpans, detailValueSpans);
  };

  const renderData = (data: any) => {
    if (!data) return;
    // Use centralized overview from DataPipelineCoordinator
    const overview: AccountOverviewMetrics | null = data.overview ?? null;
    if (overview) {
      lastOverview = overview;
      if (!metricsBuilt) {
        rebuildMetrics();
      } else {
        patchMetrics();
      }
    }
  };
  unsubscribe = headerController.subscribe(renderData);

  // Re-render metrics when share mode changes (mask/scale values)
  let unsubscribeShareMode: (() => void) | null = null;
  unsubscribeShareMode = onShareModeChange(() => {
    if (metricsBuilt) rebuildMetrics();
  });

  let unsubscribeBalances: (() => void) | null = null;
  const hadBalances = { value: false };
  unsubscribeBalances = headerController.subscribeToBalances(
    (snapshot: BalancesSnapshot) => {
      lastBalances = snapshot;
      if (!lastOverview) return;
      if (!hadBalances.value && !detailSection) {
        hadBalances.value = true;
        rebuildMetrics();
      } else {
        patchMetrics();
      }
    },
  );

  // ── Restore persisted state ──────────────────────────────────
  void (async () => {
    const saved = await loadPref<SideState>(KV_SIDE_STATE_KEY);
    if (saved?.snapshot) doToggleSnapshot();
  })();

  // ── Cleanup ──────────────────────────────────────────────────
  return {
    element: root,
    destroy: () => {
      unsubMode();
      if (snapshotTimer.ref) {
        clearTimeout(snapshotTimer.ref);
        snapshotTimer.ref = null;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (unsubscribeShareMode) {
        unsubscribeShareMode();
        unsubscribeShareMode = null;
      }
      if (unsubscribeBalances) {
        unsubscribeBalances();
        unsubscribeBalances = null;
      }
      if (unsubscribeNews) {
        unsubscribeNews();
        unsubscribeNews = null;
      }
      if (timelineCtrl) {
        timelineCtrl.destroy();
        timelineCtrl = null;
      }
      newsSection.destroy();
      snapshotTab.tab.remove();
      snapshotSlide.panel.remove();
      root.remove();
    },
  };
}
