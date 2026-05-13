import type { Logger } from "../../../shared/log/Logger";
import type { PollingScheduler } from "./PollingScheduler";
import type { PhaseManager } from "./PhaseManager";
import type { HoldingsDataService } from "../HoldingsDataService";
import type { StreamerBridge } from "../bridges/StreamerBridge";
import type { OvernightBridge } from "../bridges/OvernightBridge";
import { isFeatureEnabled } from "../../../shared/settings/settingsNormalization";
import {
  type BackendContext,
  DEFAULT_BETA_RECALC_INTERVAL_MS,
} from "./backendOrchestratorTypes";

export type RouteSettingsUpdateDeps = {
  ctx: BackendContext;
  holdingsDataService: HoldingsDataService;
  scheduler: PollingScheduler;
  streamerBridge: StreamerBridge;
  overnightBridge: OvernightBridge;
  phaseManager: PhaseManager;
  logger: Logger;
  reregisterHoldings: () => void;
  reregisterQuotes: () => void;
  reregisterBalances: () => void;
};

export function routeSettingsUpdate(
  deps: RouteSettingsUpdateDeps,
  newSettings: Record<string, any>,
): void {
  const {
    ctx,
    holdingsDataService,
    scheduler,
    streamerBridge,
    overnightBridge,
    phaseManager,
    logger,
    reregisterHoldings,
    reregisterQuotes,
    reregisterBalances,
  } = deps;

  if (newSettings.warningRulesJson !== undefined) {
    holdingsDataService.setWarningRulesJson(
      newSettings.warningRulesJson ?? null,
    );
  }

  if (newSettings.isHoldingsRefreshing !== undefined) {
    if (newSettings.isHoldingsRefreshing === false) {
      scheduler.pauseSource("holdings");
    } else if (scheduler.hasSource("holdings")) {
      scheduler.resumeSource("holdings");
    } else {
      reregisterHoldings();
    }
  }

  if (newSettings.isQuotesRefreshing !== undefined) {
    if (newSettings.isQuotesRefreshing === false) {
      scheduler.pauseSource("quotes");
    } else if (scheduler.hasSource("quotes")) {
      scheduler.resumeSource("quotes");
    } else {
      reregisterQuotes();
    }
  }

  if (newSettings.holdingsRefreshInterval !== undefined) {
    scheduler.updateInterval(
      "holdings",
      newSettings.holdingsRefreshInterval || 10000,
    );
  }

  if (newSettings.quotesRefreshInterval !== undefined) {
    scheduler.updateInterval(
      "quotes",
      newSettings.quotesRefreshInterval || 15000,
    );
  }

  if (newSettings.enableBalances !== undefined) {
    if (!isFeatureEnabled(newSettings.enableBalances)) {
      scheduler.pauseSource("balances");
    } else if (scheduler.hasSource("balances")) {
      scheduler.resumeSource("balances");
    } else {
      reregisterBalances();
    }
  }

  if (newSettings.balancesRefreshInterval !== undefined) {
    scheduler.updateInterval(
      "balances",
      newSettings.balancesRefreshInterval || 1000,
    );
  }

  if (newSettings.enableStreamer !== undefined) {
    const enable = isFeatureEnabled(newSettings.enableStreamer);
    if (!phaseManager.usesStreamer() && enable) {
      logger.info(
        "enableStreamer requested but current phase does not use streamer — deferring",
        { phase: phaseManager.getPhase() },
      );
    } else {
      streamerBridge.setEnabled(enable);
      if (!enable) {
        streamerBridge.teardown();
      } else {
        streamerBridge.reconnect(ctx.authToken, ctx.customerId ?? null);
      }
    }
  }

  if (newSettings.enableOvernightPrice !== undefined) {
    overnightBridge.setEnabled(isFeatureEnabled(newSettings.enableOvernightPrice));
  }

  if (newSettings.betaRefreshIntervalMs !== undefined) {
    scheduler.updateInterval(
      "beta-recalc",
      newSettings.betaRefreshIntervalMs || DEFAULT_BETA_RECALC_INTERVAL_MS,
    );
  }
}
