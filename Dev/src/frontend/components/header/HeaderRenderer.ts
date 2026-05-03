import { renderTotals, renderIndices } from "./headerWidgets";
import type { IndexSparklineGetter } from "./headerWidgets";
import type { AccountOverviewMetrics } from "backend/computation/holdings/metrics/accountOverviewMetrics";
import type{ QuoteItem } from "../../../shared/types/holdings";
import type { BalancesSnapshot } from "../../../backend/core/network/schwab/endpoints/balances";
import { IntradaySparklineStore } from "../../trade_holdings/holding_table/sparkline/IntradaySparklineStore";
import type { ChartDataService } from "../../../backend/core/network/chart/ChartDataService";
import {
  onShareModeChange,
  isShareMasked,
  shareScaleValue,
  getShareMode,
} from "shared/utils/domain/globalShareMode";

const INDEX_SYMBOLS = ["$SPX", "$COMPX", "$RUT", "$DJI"];

export class HeaderRenderer {
  private totalsContainer: HTMLElement;
  private indicesContainer: HTMLElement;

  private lastTotalsSignature: string | null = null;
  private lastIndicesSignature: string | null = null;

  private isRunning = false;
  private renderQueued = false;

  private latestBalances: BalancesSnapshot | null = null;
  private lastFrame: any = null;
  private unsubShareMode: (() => void) | null = null;

  /** Shared sparkline store for index symbols (also used by timeline overlay). */
  readonly indexSparklineStore: IntradaySparklineStore;
  /** Cache of latest netChangePercent per index symbol for sparkline color. */
  private indexChangePctMap = new Map<string, number>();

  constructor(
    uiElements: {
      totalsContainer: HTMLElement;
      indicesContainer: HTMLElement;
    },
    chartDataService: ChartDataService,
  ) {
    this.totalsContainer = uiElements.totalsContainer;
    this.indicesContainer = uiElements.indicesContainer;

    this.indexSparklineStore = new IntradaySparklineStore(chartDataService);
    this.indexSparklineStore.setRefreshInterval(5 * 60 * 1000);
    this.indexSparklineStore.requestSymbols(INDEX_SYMBOLS);
    this.indexSparklineStore.onUpdate(() => {
      // Sparkline data arrived — force indices re-render on next opening event
      this.lastIndicesSignature = null;
      if (this.lastFrame) this.queueRender(this.lastFrame);
    });
  }

  start(): void {
    this.isRunning = true;
    // Re-render header when share mode changes (formatters produce different output)
    this.unsubShareMode = onShareModeChange(() => this.forceRerender());
  }

  stop(): void {
    this.isRunning = false;
    this.indexSparklineStore.dispose();
    if (this.unsubShareMode) {
      this.unsubShareMode();
      this.unsubShareMode = null;
    }
  }

  /** Invalidate caches and force a full re-render with latest data. */
  forceRerender(): void {
    this.lastTotalsSignature = null;
    this.lastIndicesSignature = null;
    if (this.lastFrame) this.queueRender(this.lastFrame);
  }

  queueRender(frame: any): void {
    this.lastFrame = frame;
    if (!this.isRunning || this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => this.renderHeader(this.lastFrame));
  }

  setBalances(snapshot: BalancesSnapshot): void {
    this.latestBalances = snapshot;
    if (this.lastFrame) {
      this.queueRender(this.lastFrame);
    }
  }

  private renderHeader(data: any): void {
    this.renderQueued = false;
    if (!this.isRunning || !data) return;

    // Use centralized overview from DataPipelineCoordinator
    const rawOverview: AccountOverviewMetrics | null = data.overview ?? null;

    if (rawOverview) {
      if (this.totalsContainer) {
        // Apply share mode: mask or scale portfolio values
        const masked = isShareMasked();
        const sv = shareScaleValue;
        const overview: AccountOverviewMetrics = masked
          ? rawOverview
          : {
              ...rawOverview,
              dayChangeDollar: sv(rawOverview.dayChangeDollar) as number,
              gainLossDollar: sv(rawOverview.gainLossDollar) as number,
              accountValue: sv(rawOverview.accountValue) as number,
              marketValue: sv(rawOverview.marketValue) as number,
              cashInvestments: sv(rawOverview.cashInvestments) as number,
              marginBalance: sv(rawOverview.marginBalance) as number,
            };

        const shareMode = getShareMode();
        const totalsSignature = JSON.stringify({
          shareMode,
          dayChangeDollar: overview.dayChangeDollar,
          dayChangePercent: overview.dayChangePercent,
          gainLossDollar: overview.gainLossDollar,
          gainLossPercent: overview.gainLossPercent,
          accountValue: overview.accountValue,
          cashInvestments: overview.cashInvestments,
        });

        if (totalsSignature !== this.lastTotalsSignature) {
          this.lastTotalsSignature = totalsSignature;
          this.totalsContainer.innerHTML = "";
          if (masked) {
            // Show masked placeholder instead of real values
            const maskedOverview: AccountOverviewMetrics = {
              ...rawOverview,
              dayChangeDollar: 0,
              gainLossDollar: 0,
              accountValue: 0,
              marketValue: 0,
              cashInvestments: 0,
            };
            this.totalsContainer.appendChild(renderTotals(maskedOverview, true));
          } else {
            this.totalsContainer.appendChild(renderTotals(overview));
          }
        }
      }
    }

    if (this.indicesContainer && data.quotesBySymbol) {
      const order = INDEX_SYMBOLS;
      const quotesArray = order
        .map((s) => data.quotesBySymbol?.[s])
        .filter(Boolean) as QuoteItem[];

      // Update changePct cache from live quotes and inject previousClose into sparkline store
      for (const q of quotesArray) {
        const sym = q.reference?.symbol;
        const pct = q.quote?.netChangePercent;
        if (sym && typeof pct === "number") {
          this.indexChangePctMap.set(sym, pct);
        }
        // Derive previousClose from live quote (lastPrice - netChange)
        const lastPrice = q.quote?.lastPrice;
        const netChange = q.quote?.netChange;
        if (
          sym &&
          typeof lastPrice === "number" &&
          typeof netChange === "number" &&
          lastPrice > 0
        ) {
          const prevClose = lastPrice - netChange;
          if (prevClose > 0) {
            this.indexSparklineStore.setPreviousClose(sym, prevClose);
          }
        }
      }

      const indicesSignature = JSON.stringify(
        quotesArray.map((q: any) => [
          q.reference?.symbol,
          q.quote?.lastPrice ?? null,
          q.quote?.netChange ?? null,
          q.quote?.netChangePercent ?? null,
        ]),
      );

      if (indicesSignature !== this.lastIndicesSignature) {
        this.lastIndicesSignature = indicesSignature;
        const getSparkline: IndexSparklineGetter = (symbol) => {
          const d = this.indexSparklineStore.get(symbol);
          if (!d) return null;
          return {
            data: d,
            changePct: this.indexChangePctMap.get(symbol) ?? 0,
          };
        };
        this.indicesContainer.innerHTML = "";
        this.indicesContainer.appendChild(
          renderIndices(quotesArray, getSparkline),
        );
      }
    }
  }

}
