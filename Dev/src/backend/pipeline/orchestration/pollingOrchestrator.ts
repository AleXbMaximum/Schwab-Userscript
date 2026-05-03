import type {
  ChangeToken,
  HoldingsFrame,
} from "../../../shared/types/derived";
import type { Logger } from "../../../shared/log/Logger";
import type { TypedEventBus } from "../../../shared/utils/state/TypedEventBus";
import type { BackendEvents } from "./EventBus";
import type { PollingScheduler } from "./PollingScheduler";
import type { PhaseManager } from "./PhaseManager";
import type { BetaManager } from "../beta/BetaManager";
import type { HoldingsDataService } from "../HoldingsDataService";
import type { PipelineStatePersistor } from "../persistence/PipelineStatePersistor";
import type { AllBenchmarkBetaData } from "../beta/BetaService";
import type { ThreeFactorBundle } from "../../computation/beta/types";

import { fetchBalances } from "../../core/network/schwab/endpoints/balances";
import { fetchQuotes } from "../../core/network/schwab/endpoints/quotes";
import { INDEX_SYMBOLS_ARRAY } from "../indexSymbols";
import {
  type BackendContext,
  DEFAULT_BETA_RECALC_INTERVAL_MS,
  normalizeSymbolsUnique,
} from "./backendOrchestratorTypes";

export type SetupPollingDeps = {
  ctx: BackendContext;
  scheduler: PollingScheduler;
  phaseManager: PhaseManager;
  betaManager: BetaManager;
  holdingsDataService: HoldingsDataService;
  eventBus: TypedEventBus<BackendEvents>;
  persistor: PipelineStatePersistor;
  logger: Logger;
  fetchHoldingsTask: (() => Promise<any>) | null;
  setFetchQuotesTask: (task: () => Promise<any>) => void;
  setFetchBalancesTask: (task: () => Promise<any>) => void;
  getLatestFrame: () => HoldingsFrame | null;
  setLatestFrame: (frame: HoldingsFrame) => void;
  warmupForOvernight: () => void;
  withLatestBeta: (data: HoldingsFrame) => HoldingsFrame;
};

function computeHoldingsNextFetchAt(
  ctx: BackendContext,
  holdingsInterval: number,
): number {
  const hasStored = !!ctx.rawHoldings;
  const lastUpdateStr = ctx.lastUpdate;
  const lastUpdateMs =
    typeof lastUpdateStr === "string" ? Date.parse(lastUpdateStr) : NaN;
  if (!hasStored) return Date.now();
  if (Number.isFinite(lastUpdateMs)) {
    return Math.max(lastUpdateMs + holdingsInterval, Date.now());
  }
  return Date.now() + holdingsInterval;
}

function collectRebalanceTargetSymbols(ctx: BackendContext): string[] {
  const settings = ctx.settings || {};
  const targets = settings.rebalanceTargets;
  if (!targets || typeof targets !== "object") return [];
  return normalizeSymbolsUnique(Object.keys(targets));
}

export function setupPolling(deps: SetupPollingDeps): void {
  const {
    ctx,
    scheduler,
    phaseManager,
    betaManager,
    holdingsDataService,
    eventBus,
    persistor,
    logger,
    fetchHoldingsTask,
    setFetchQuotesTask,
    setFetchBalancesTask,
    getLatestFrame,
    setLatestFrame,
    warmupForOvernight,
    withLatestBeta,
  } = deps;

  const settings = ctx.settings || {};
  const holdingsInterval = settings.holdingsRefreshInterval || 10000;
  const quotesInterval = settings.quotesRefreshInterval || 15000;

  const holdingsNextFetchAt = computeHoldingsNextFetchAt(
    ctx,
    holdingsInterval,
  );
  const holdingsDelay = Math.max(0, holdingsNextFetchAt - Date.now());
  const shouldPoll = phaseManager.usesPolling();

  if (settings.isHoldingsRefreshing !== false) {
    scheduler.register({
      key: "holdings",
      intervalMs: holdingsInterval,
      initialDelayMs: shouldPoll ? holdingsDelay : undefined,
      fetcher: fetchHoldingsTask,
    });
  } else if (shouldPoll && fetchHoldingsTask) {
    fetchHoldingsTask();
  }

  const fetchQuotesTask = () => {
    const holdingSymbols = holdingsDataService.getTrackedSymbols();
    const rebalanceTargetSymbols = collectRebalanceTargetSymbols(ctx);
    const allSymbols = normalizeSymbolsUnique([
      ...INDEX_SYMBOLS_ARRAY,
      ...holdingSymbols,
      ...betaManager.getExtraBetaTickers(),
      ...rebalanceTargetSymbols,
    ]);
    return fetchQuotes(allSymbols, ctx.authToken).then((data: any) => {
      holdingsDataService.ingestQuotes(data);
      return data;
    });
  };
  setFetchQuotesTask(fetchQuotesTask);

  if (settings.isQuotesRefreshing !== false) {
    scheduler.register({
      key: "quotes",
      intervalMs: quotesInterval,
      fetcher: fetchQuotesTask,
    });
  } else if (shouldPoll) {
    fetchQuotesTask();
  }

  const balancesInterval = settings.balancesRefreshInterval || 1000;
  const fetchBalancesTask = () => {
    return fetchBalances(ctx.authToken, ctx.accountId!).then((snapshot) => {
      eventBus.emit("balances", snapshot);
      return snapshot;
    });
  };
  setFetchBalancesTask(fetchBalancesTask);

  if (shouldPoll) {
    scheduler.register({
      key: "balances",
      intervalMs: balancesInterval,
      initialDelayMs: 2000,
      fetcher: fetchBalancesTask,
    });
  } else {
    fetchBalancesTask();
  }

  if (!shouldPoll) {
    scheduler.pauseSource("holdings");
    scheduler.pauseSource("quotes");
    scheduler.pauseSource("balances");

    if (phaseManager.getPhase() === "overnight") {
      warmupForOvernight();
    }
  }

  const betaInterval =
    settings.betaRefreshIntervalMs || DEFAULT_BETA_RECALC_INTERVAL_MS;
  scheduler.register({
    key: "beta-recalc",
    intervalMs: betaInterval,
    initialDelayMs: 5000,
    fetcher: async () => {
      const opening = getLatestFrame();
      const byUnderlying = opening?.derived?.byUnderlying;
      const holdingSymbols = byUnderlying
        ? Object.keys(byUnderlying).filter(
            (s: string) =>
              !s.startsWith("$") && s.length > 0 && !s.includes(" "),
          )
        : [];
      return betaManager.computeAll(holdingSymbols);
    },
    onUpdate: (result: {
      allResults: AllBenchmarkBetaData;
      threeFactorResults: Map<string, ThreeFactorBundle>;
    }) => {
      betaManager.applyComputationResults(result);
      persistor.persistBetaData(betaManager.serializeForStorage());

      const currentFrame = getLatestFrame();
      if (currentFrame?.derived) {
        betaManager.enrichDerivedState(currentFrame.derived, null);
        const betaChangeToken: ChangeToken = {
          rawVersion: currentFrame.changeToken?.rawVersion ?? 0,
          derivedVersion:
            (currentFrame.changeToken?.derivedVersion ?? 0) + 1,
          touchedHoldingsKeys: [],
          touchedUnderlyingKeys: Object.keys(
            currentFrame.derived.byUnderlying ?? {},
          ),
          fullRebuild: true,
        };
        const updatedFrame: HoldingsFrame = {
          ...withLatestBeta(currentFrame),
          changeToken: betaChangeToken,
        };
        setLatestFrame(updatedFrame);
        eventBus.emit("holdings:frame", updatedFrame);
      }
    },
    onError: (err: Error) => {
      logger.error("betaRecalcFailed", { error: err.message });
    },
  });
}
