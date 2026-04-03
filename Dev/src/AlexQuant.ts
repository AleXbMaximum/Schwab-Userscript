import {
  fetchAuthToken,
  setAuthToken,
  subscribeAuthToken,
  startAuthTokenAutoRefresh,
  stopAuthTokenAutoRefresh,
  startSessionKeepAlive,
  stopSessionKeepAlive,
} from "./backend/core/network/schwab/auth";
import { fetchAccountInfo } from "./backend/core/network/schwab/holdings";
import { readPageInitContext } from "./backend/core/network/schwab/initContext";
import { streamer } from "./backend/core/network/schwab/streamer";
import { ui_createMain } from "./frontend/components/mainContainer/MainContainer";
import { DataPipelineCoordinator } from "./frontend/components/DataPipelineCoordinator";
import { createFloatingSnapshot } from "./frontend/snapshot/FloatingSnapshot";
import { createAccountTimelinePanel } from "./frontend/snapshot/timeline/accountTimeline";
import { RenderEngine } from "./frontend/RenderEngine";
import {
  addGlobalStyle,
  addAnimationStyles,
  applyColorTheme,
} from "./frontend/components/core/ui_styles";
import { initLayoutMode, getLayoutMode } from "./frontend/components/core/layoutMode";
import { logService } from "./shared/log/core/LogService";
import { installLogDevTools } from "./shared/log/devTools";
import { storageOperator } from "./backend/core/setting/settingsStorage";
import { openAlexQuantDB } from "./backend/core/db/core/AlexQuantDB";
import { KVStore } from "./backend/core/db/core/KVStore";
import { newsService } from "./backend/services/news/NewsService";
import { getAIProviders } from "./backend/services/ai/config/getAIProviders";
import { MonitorController } from "./frontend/analysis_optionFlow/monitor/MonitorController";
import { AccountSnapshotRecorder } from "./backend/pipeline/snapshot/AccountSnapshotRecorder";
import type{
  AppContext,
  Settings,
} from "./shared/types/core";
import {
  defaultSettings,
  normalizeSettings,
} from "./shared/settings/settingsNormalization";

// Wire AI provider resolver so NewsService never imports ai/ directly.
newsService.setProviderResolver(getAIProviders);

type ViewName = string;

type StorageLike = {
  set: (key: string, value: unknown) => void;
  setToken: (token: string | null) => void;
  loadAll: () => Promise<unknown>;
};

type RenderEngineLike = {
  updateContext: (
    patch: Partial<AppContext> & Record<string, unknown>,
    options?: { rerender?: boolean },
  ) => void;
  changeView: (view: ViewName) => void;
};

function syncRecorderSettings(
  recorder: AccountSnapshotRecorder,
  settings: Record<string, any>,
  defaults: Record<string, any>,
): void {
  recorder.applySettings({
    intervalMs: settings.accountSnapshotIntervalMs ?? defaults.accountSnapshotIntervalMs,
    skipNightSession: settings.accountSnapshotRecordNight !== true,
    archiveThreshold: settings.accountSnapshotArchiveThreshold ?? defaults.accountSnapshotArchiveThreshold,
    autoArchiveEnabled: settings.accountSnapshotAutoArchive !== false,
    retentionDays: settings.accountSnapshotRetentionDays ?? defaults.accountSnapshotRetentionDays,
  });
}

(function () {
  "use strict";

  if (window.top && window.top !== window.self) return;

  const w = window as any;
  if (w.__SCHWABER_INITIALIZED__) {
    try {
      const logDup = logService.namespace("main");
      logDup.warn("AlexQuant already initialized; skipping duplicate run");
    } catch {}
    return;
  }
  w.__SCHWABER_INITIALIZED__ = true;

  installLogDevTools();
  const log = logService.namespace("main");

  const waitForDomReady = async () => {
    if (document.readyState !== "loading") return;
    await new Promise<void>((resolve) =>
      document.addEventListener("DOMContentLoaded", () => resolve(), {
        once: true,
      }),
    );
  };

  const waitForInitContext = async (timeoutMs = 2000) => {
    // Fast path: context already available (most common)
    try {
      const initCtx = readPageInitContext();
      if (initCtx.asn) return initCtx;
    } catch {}

    // MutationObserver-based wait: resolves instantly when the template element appears or gets content
    return new Promise<ReturnType<typeof readPageInitContext>>((resolve) => {
      let resolved = false;
      const tryResolve = () => {
        if (resolved) return;
        try {
          const initCtx = readPageInitContext();
          if (initCtx.asn) {
            resolved = true;
            observer.disconnect();
            clearTimeout(timer);
            resolve(initCtx);
            return;
          }
          const upsEl = document.getElementById("ups-user-context");
          if (upsEl && (upsEl.textContent || "").trim().length > 0) {
            resolved = true;
            observer.disconnect();
            clearTimeout(timer);
            resolve(initCtx);
            return;
          }
        } catch {}
      };

      // Observe document for template script insertion / content changes
      const observer = new MutationObserver(() => tryResolve());
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      // Timeout fallback: return whatever we have after timeoutMs
      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        observer.disconnect();
        try {
          resolve(readPageInitContext());
        } catch {
          resolve({
            asn: null,
            customerId: null,
            cip: null,
            upsUserContext: null,
            userContext: null,
          } as any);
        }
      }, timeoutMs);

      // Check once more in case content arrived between fast-path and observer setup
      tryResolve();
    });
  };

  const maskTail = (v: string | null | undefined, keep = 4) => {
    if (!v) return null;
    const s = String(v);
    if (s.length <= keep) return "*".repeat(s.length);
    return "*".repeat(s.length - keep) + s.slice(-keep);
  };

  const syncNewsRefreshIntervals = (settings: Settings) => {
    newsService.updateRefreshIntervals({
      yahooMacroMs:
        settings.newsYahooMacroEnabled === false
          ? 0
          : settings.newsYahooMacroRefreshInterval,
      yahooSymbolMs:
        settings.newsYahooSymbolEnabled === false
          ? 0
          : settings.newsYahooSymbolRefreshInterval,
      barronsMs:
        settings.newsBarronsEnabled === false
          ? 0
          : settings.newsBarronsRefreshInterval,
      financialJuiceMs:
        settings.newsFinancialJuiceEnabled === false
          ? 0
          : settings.newsFinancialJuiceRefreshInterval,
      schwabMs:
        settings.newsSchwabEnabled === false
          ? 0
          : settings.newsSchwabRefreshInterval,
    });
  };

  let renderEngine: RenderEngineLike | null = null;
  let storage: (StorageLike & { set?: any; getToken?: () => unknown }) | null =
    null;
  let headerController: DataPipelineCoordinator | null = null;
  let floatingSnapshot: { element: HTMLElement; destroy: () => void } | null =
    null;
  const monitorController = new MonitorController();
  const accountSnapshotRecorder = new AccountSnapshotRecorder(
    defaultSettings.accountSnapshotIntervalMs,
    !defaultSettings.accountSnapshotRecordNight,
    defaultSettings.accountSnapshotArchiveThreshold,
    defaultSettings.accountSnapshotAutoArchive,
    defaultSettings.accountSnapshotRetentionDays,
  );

  const ctx: AppContext = {
    authToken: null,
    accountId: null,
    rawHoldings: null,
    settings: { ...defaultSettings },
    lastUpdate: "",
    onUpdateSettings: (newSettings, options) => {
      const nextSettings: Settings = {
        ...(ctx.settings as any),
        ...(newSettings as any),
      };

      const normalized = normalizeSettings(nextSettings);

      if (storage && typeof (storage as any).set === "function") {
        (storage as any).set("settings", normalized, { immediate: true });
      }
      const liveSettings = ctx.settings as Record<string, unknown>;
      for (const key of Object.keys(liveSettings)) {
        if (!(key in (normalized as Record<string, unknown>)))
          delete liveSettings[key];
      }
      Object.assign(liveSettings, normalized as Record<string, unknown>);
      ctx.settings = liveSettings as Settings;
      syncNewsRefreshIntervals(normalized);

      headerController?.updateSettings(newSettings as any);
      syncRecorderSettings(accountSnapshotRecorder, ctx.settings as any, defaultSettings as any);
      renderEngine?.updateContext(
        { settings: ctx.settings },
        { rerender: options?.rerender ?? true },
      );
    },
  };

  // Start non-critical services after the first Holdings render completes.
  const initDeferredFeatures = (
    customerId: string | null,
    uiElements: ReturnType<typeof ui_createMain>,
    monitorInitPromise: Promise<void>,
  ) => {
    log.info("[Phase 5] Deferred features starting");

    if (customerId) {
      log.info("[Phase 5] Streamer connecting", {
        customerId: maskTail(customerId, 6),
      });
      streamer.connect(ctx.authToken, customerId);
    } else {
      log.warn(
        "[Phase 5] CustomerId not found, streamer connecting with cookie fallback",
      );
      streamer.connect(ctx.authToken, null);
    }
    headerController!.connectStreamer(streamer);
    renderEngine?.updateContext({ streamer }, { rerender: false });
    log.info(
      "[Phase 5] Streamer connecting + subscriptions wired (WebSocket handshake async)",
    );

    startAuthTokenAutoRefresh({ intervalMs: 1_200_000 });
    log.info("[Phase 5] Auth auto-refresh started (interval: 20min)");

    startSessionKeepAlive();
    log.info("[Phase 5] Session keep-alive started (interval: 5min)");

    accountSnapshotRecorder.start(headerController!);
    headerController!.subscribeToBalances((snapshot) => {
      accountSnapshotRecorder.ingestBalances(snapshot);
    });
    log.info("[Phase 5] AccountSnapshotRecorder started (with balances feed)");

    if (getLayoutMode() !== "mobile") {
      const indexSparklineStore = headerController!.getIndexSparklineStore();
      const betaService = headerController!.getBetaService();
      floatingSnapshot = createFloatingSnapshot(headerController!, uiElements, {
        createTimelinePanel: () =>
          createAccountTimelinePanel({
            indexSparklineStore,
            betaService,
            onCapture: (cb) => accountSnapshotRecorder.onCapture(cb),
            offCapture: (cb) => accountSnapshotRecorder.offCapture(cb),
          }),
      });
      log.info(
        "[Phase 5] FloatingSnapshot created (newsService will start on first data)",
      );
    } else {
      log.info("[Phase 5] FloatingSnapshot skipped (mobile layout)");
    }

    monitorController.setAuthToken(ctx.authToken);
    log.info("[Phase 5] MonitorController awaiting pre-fired init...");
    void monitorInitPromise.then(() => {
      const enabled = monitorController.getSettings().enabled;
      log.info("[Phase 5] MonitorController initialized", { enabled });
      if (enabled) {
        void monitorController.start(true);
        log.info("[Phase 5] MonitorController started (cycle fire-and-forget)");
      }
      renderEngine?.updateContext({ monitorController }, { rerender: false });
    });

    log.info("[Phase 5] Deferred features dispatch complete");
  };

  const main = async () => {
    log.info("AlexQuant initializing...");

    log.info("[Phase 1] Parallel kickoff: CSS + DOM + Auth + DB");
    addGlobalStyle();
    addAnimationStyles();
    applyColorTheme("default");
    const layoutMode = initLayoutMode();
    log.debug(
      "[Phase 1] CSS injected + color theme applied + layoutMode=" + layoutMode,
    );

    // Kick off auth fetch before the DOM and DB awaits so startup stays parallel.
    log.debug("[Phase 1] fetchAuthToken fired (parallel)");
    const authTokenPromise = fetchAuthToken();

    await waitForDomReady();
    log.debug("[Phase 1] DOM ready");

    log.debug("[Phase 1] Awaiting initContext + openAlexQuantDB (parallel)");
    const [initCtx, db] = await Promise.all([
      waitForInitContext(2000),
      openAlexQuantDB(),
    ]);
    log.info("[Phase 1] Parallel kickoff complete", {
      hasAsn: !!initCtx.asn,
      dbReady: !!db,
    });

    log.debug("Init context resolved", {
      hasAsn: !!initCtx.asn,
      asn: maskTail(initCtx.asn, 4),
      hasCustomerId: !!initCtx.customerId,
      customerId: maskTail(initCtx.customerId, 6),
      cip: initCtx.cip ?? null,
    });

    log.info("[Phase 2+3] Storage hydration + UI skeleton (parallel)");

    const uiElements = ui_createMain({
      changeView: (view: ViewName) => renderEngine?.changeView(view),
      layoutMode,
    });
    log.debug("[Phase 3] Main container created");
    headerController = new DataPipelineCoordinator(
      ctx as any,
      uiElements as any,
    );
    log.debug("[Phase 3] DataPipelineCoordinator instantiated");
    renderEngine = new RenderEngine(
      uiElements.content,
      ctx as any,
      uiElements as any,
    ) as unknown as RenderEngineLike;
    log.info(
      "[Phase 3] UI skeleton ready (RenderEngine + DataPipelineCoordinator)",
    );

    // Pre-fire the monitor settings read so deferred startup only waits on the resolved promise.
    const monitorInitPromise = monitorController.init().catch((err) => {
      log.warn("[Phase 2+3] MonitorController pre-init failed (non-fatal)", {
        error: (err as Error)?.message ?? String(err),
      });
    });
    log.debug("[Phase 2+3] MonitorController.init() pre-fired (parallel)");

    const unsubscribeAuth = subscribeAuthToken((token: string | null) => {
      ctx.authToken = token;
      streamer.updateToken(token);
      monitorController.setAuthToken(token);
      renderEngine?.updateContext({ authToken: token }, { rerender: false });
    });

    window.addEventListener("beforeunload", () => {
      try {
        unsubscribeAuth();
      } catch {}
      try {
        stopAuthTokenAutoRefresh();
      } catch {}
      try {
        stopSessionKeepAlive();
      } catch {}
      try {
        headerController?.stop();
      } catch {}
      try {
        monitorController.destroy();
      } catch {}
      try {
        accountSnapshotRecorder.destroy();
      } catch {}
      try {
        floatingSnapshot?.destroy();
      } catch {}
    });

    log.info("[Phase 2] Storage hydration starting");
    try {
      const kvStore = new KVStore(db);

      storage = storageOperator(ctx as any, kvStore) as any;
      ctx.storage = storage as any;

      const tokenForStorage = initCtx.asn;
      if (tokenForStorage) {
        storage.setToken(tokenForStorage);
        const loadResult = await storage.loadAll();

        ctx.settings = {
          ...defaultSettings,
          ...(ctx.settings || {}),
        };

        ctx.settings = normalizeSettings(ctx.settings);

        try {
          if (typeof (storage as any).set === "function") {
            (storage as any).set("settings", ctx.settings, { immediate: true });
          }
          if (typeof (storage as any).saveItem === "function") {
            (storage as any).saveItem("settings");
          }

          const tokenNow = (storage as any).getToken
            ? (storage as any).getToken()
            : null;
          const runtime = (() => {
            const info: any = {
              href: (() => {
                try {
                  return window.location.href;
                } catch {
                  return null;
                }
              })(),
            };
            try {
              const uw = (globalThis as any)?.unsafeWindow;
              info.pageHref = uw?.location?.href ?? null;
            } catch {
              info.pageHref = null;
            }
            return info;
          })();

          log.info("Storage bootstrap saved settings", {
            token: tokenNow,
            runtime,
          });
        } catch {}

        log.info("Storage loaded", loadResult);
      } else {
        log.warn(
          "InitContext ASN missing; storage will be enabled after accountId is known",
        );
      }
    } catch (e) {
      const err = e as Error;
      log.error("Storage initialization failed", {
        error: err?.message ?? String(e),
      });
    }

    syncRecorderSettings(accountSnapshotRecorder, ctx.settings as any, defaultSettings as any);
    syncNewsRefreshIntervals(ctx.settings);
    renderEngine.updateContext({ settings: ctx.settings });
    log.info("[Phase 2] Storage hydration complete, settings synced");

    log.info("[Phase 4] Critical path: Auth → Account → First render");
    let accountId: string = "";
    let customerId: string | null = null;
    try {
      log.debug("[Phase 4] Awaiting auth token (started in Phase 1)");
      const token = await authTokenPromise;
      setAuthToken(token);
      log.info("[Phase 4] Auth token acquired + set");

      const cachedAccountId = ctx.accountId; // hydrated by Phase 2
      const cachedCustomerId = initCtx.customerId ?? null; // DOM-parsed in Phase 1
      const hasCachedAccount = !!cachedAccountId && !!cachedCustomerId;

      if (hasCachedAccount) {
        accountId = cachedAccountId;
        customerId = cachedCustomerId;
        ctx.customerId = customerId;
        log.info("[Phase 4] Account info from cache (warm reload)", {
          accountId: maskTail(accountId, 4),
          customerId: maskTail(customerId, 6),
        });
        void fetchAccountInfo(token)
          .then((fresh) => {
            if (fresh.accountId && fresh.accountId !== accountId) {
              log.warn("[Phase 4] Background verify: accountId changed!", {
                old: maskTail(accountId, 4),
                new: maskTail(fresh.accountId, 4),
              });
              ctx.accountId = fresh.accountId;
              renderEngine?.updateContext(
                { accountId: fresh.accountId },
                { rerender: false },
              );
            }
          })
          .catch((err) => {
            log.warn("[Phase 4] Background account verify failed", {
              error: (err as Error)?.message ?? String(err),
            });
          });
      } else {
        log.debug("[Phase 4] Fetching account info (cold start)");
        const info = await fetchAccountInfo(token);
        accountId = info.accountId;
        customerId = info.customerId;
        ctx.accountId = accountId;
        ctx.customerId = customerId;
        log.info("[Phase 4] Account info resolved (cold)", {
          accountId: maskTail(accountId, 4),
          customerId: maskTail(customerId, 6),
        });
      }

      if (
        storage &&
        typeof storage.getToken === "function" &&
        !storage.getToken() &&
        ctx.accountId
      ) {
        log.info(
          "[Phase 4] ASN was missing; re-loading storage with accountId token",
        );
        storage.setToken(ctx.accountId);
        const loadResult = await storage.loadAll();

        ctx.settings = normalizeSettings({
          ...defaultSettings,
          ...(ctx.settings || {}),
        } as Settings);
        syncNewsRefreshIntervals(ctx.settings);
        syncRecorderSettings(accountSnapshotRecorder, ctx.settings as any, defaultSettings as any);
        renderEngine?.updateContext(
          { settings: ctx.settings },
          { rerender: false },
        );

        try {
          if (typeof (storage as any).set === "function") {
            (storage as any).set("settings", ctx.settings, { immediate: true });
          }
        } catch {}

        log.info("Storage loaded after accountId token bootstrap", loadResult);
      }

      log.info("[Phase 4] Starting DataPipelineCoordinator");
      headerController!.start();
      renderEngine.updateContext({
        authToken: ctx.authToken,
        accountId: ctx.accountId,
        headerController: headerController,
      });
      renderEngine.changeView("HOLDINGS");
      log.info("[Phase 4] First render complete \u2014 HOLDINGS view active", {
        accountId: maskTail(accountId, 4),
      });
    } catch (err: unknown) {
      const e = err as { message?: string; stack?: string };
      const errorSpan = document.createElement("span");
      errorSpan.style.cssText = "color:red;padding:8px;display:block";
      errorSpan.textContent = `Init Error: ${e?.message ?? String(err)}`;
      uiElements.content.innerHTML = "";
      uiElements.content.appendChild(errorSpan);
      log.error("Init Error", {
        error: e?.message ?? String(err),
        stack: e?.stack,
      });
      return; // Abort: do not start Phase 5 deferred features
    }

    setTimeout(
      () => initDeferredFeatures(customerId, uiElements, monitorInitPromise),
      0,
    );
  };

  void main();
})();
