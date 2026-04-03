import type { MarketDataBundle } from "../types";
import type {
  BalanceSheetData,
  CashFlowData,
  FundamentalsData,
  IncomeStatementData,
  InsiderTransaction,
  NewsItem,
} from "shared/marketDataTypes";
import type { BarronsDataBundle } from "../../../core/network/barrons/types";
import { computeTechnicalIndicators } from "./technicals";
import { backfillFundamentalsFromBarrons } from "./dataPreprocessing";
import {
  fetchYahooNews,
  fetchYahooGlobalMacroNews,
} from "backend/core/network/yahoo/news";
import { gmGet } from "backend/core/network/yahoo/httpUtils";
import { fetchYahooQuoteSummaryAll } from "backend/core/network/yahoo/quoteSummary";
import { fetchBarronsData } from "backend/core/network/barrons/BarronsFetcher";
import type { ChartDataService } from "backend/core/network/chart/ChartDataService";

// ── Alpha Vantage: Optional enhancement ──────────────────────────────────────

async function fetchAlphaVantageFundamentals(
  symbol: string,
  apiKey: string,
): Promise<Partial<FundamentalsData>> {
  try {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
    const text = await gmGet(url);
    const d = JSON.parse(text) as any;
    if (!d || d["Note"] || d["Information"]) return {};
    return {
      sector: d.Sector ?? null,
      industry: d.Industry ?? null,
      beta: d.Beta ? parseFloat(d.Beta) : null,
      analystTargetPrice: d["AnalystTargetPrice"]
        ? parseFloat(d["AnalystTargetPrice"])
        : null,
    };
  } catch {
    return {};
  }
}

// ── DataFetcher class ─────────────────────────────────────────────────────────

export type DataFetcherConfig = {
  chartDataService: ChartDataService;
  alphaVantageKey?: string;
};

export class DataFetcher {
  private chartService: ChartDataService;
  private alphaVantageKey?: string;
  private quoteSummaryCache = new Map<
    string,
    { promise: Promise<any>; ts: number }
  >();
  private static readonly CACHE_TTL_MS = 5_000;

  constructor(config: DataFetcherConfig) {
    this.chartService = config.chartDataService;
    this.alphaVantageKey = config.alphaVantageKey;
  }

  /** Fetch everything in parallel and return a full MarketDataBundle */
  async fetchMarketData(symbol: string): Promise<MarketDataBundle> {
    const [chartResult, summaryResult, newsResult, macroResult, barronsResult] =
      await Promise.allSettled([
        this.chartService.fetch({
          symbol,
          interval: "1d",
          window: { kind: "range", range: "4mo" },
        }),
        fetchYahooQuoteSummaryAll(symbol),
        fetchYahooNews(symbol),
        fetchYahooGlobalMacroNews(),
        fetchBarronsData(symbol),
      ]);

    const chart =
      chartResult.status === "fulfilled"
        ? {
            bars: chartResult.value.bars,
            currentPrice: chartResult.value.meta.currentPrice,
          }
        : { bars: [], currentPrice: null };
    const summary =
      summaryResult.status === "fulfilled" ? summaryResult.value : null;
    const news: NewsItem[] =
      newsResult.status === "fulfilled" ? newsResult.value : [];
    const globalMacroNews: NewsItem[] =
      macroResult.status === "fulfilled" ? macroResult.value : [];
    const barrons: BarronsDataBundle | null =
      barronsResult.status === "fulfilled" ? barronsResult.value : null;

    let fundamentals: FundamentalsData = summary?.fundamentals ?? {};
    const balanceSheet: BalanceSheetData | null = summary?.balanceSheet ?? null;
    const cashFlow: CashFlowData | null = summary?.cashFlow ?? null;
    const incomeStatement: IncomeStatementData | null =
      summary?.incomeStatement ?? null;
    const insiderTransactions: InsiderTransaction[] | null =
      summary?.insiderTransactions ?? null;

    // Optional Alpha Vantage enrichment
    if (this.alphaVantageKey) {
      try {
        const avData = await fetchAlphaVantageFundamentals(
          symbol,
          this.alphaVantageKey,
        );
        fundamentals = { ...fundamentals, ...avData };
      } catch {
        // non-critical
      }
    }

    // Backfill missing fundamentals from Barrons data
    if (barrons) {
      backfillFundamentalsFromBarrons(fundamentals, barrons);
    }

    const technicals = computeTechnicalIndicators(chart.bars);

    // Determine data source
    const hasBarrons = barrons != null;
    const hasAlpha = !!this.alphaVantageKey;
    let dataSource: MarketDataBundle["dataSource"];
    if (hasBarrons && hasAlpha) dataSource = "mixed_barrons";
    else if (hasBarrons) dataSource = "yahoo_barrons";
    else if (hasAlpha) dataSource = "mixed";
    else dataSource = "yahoo_finance";

    return {
      symbol,
      currentPrice: chart.currentPrice,
      ohlcv90d: chart.bars,
      fundamentals,
      news,
      technicals,
      balanceSheet,
      cashFlow,
      incomeStatement,
      insiderTransactions,
      globalMacroNews,
      barrons,
      fetchedAt: new Date().toISOString(),
      dataSource,
    };
  }

  // ── Individual fetch methods (used by tool executor as fallback) ──────────

  private getCachedQuoteSummary(symbol: string): Promise<any> {
    const cached = this.quoteSummaryCache.get(symbol);
    if (cached && Date.now() - cached.ts < DataFetcher.CACHE_TTL_MS)
      return cached.promise;
    const promise = fetchYahooQuoteSummaryAll(symbol);
    this.quoteSummaryCache.set(symbol, { promise, ts: Date.now() });
    return promise;
  }

  async fetchBalanceSheet(symbol: string): Promise<BalanceSheetData> {
    try {
      const r = await this.getCachedQuoteSummary(symbol);
      return r.balanceSheet;
    } catch {
      return { quarters: [] };
    }
  }

  async fetchCashFlow(symbol: string): Promise<CashFlowData> {
    try {
      const r = await this.getCachedQuoteSummary(symbol);
      return r.cashFlow;
    } catch {
      return { quarters: [] };
    }
  }

  async fetchIncomeStatement(symbol: string): Promise<IncomeStatementData> {
    try {
      const r = await this.getCachedQuoteSummary(symbol);
      return r.incomeStatement;
    } catch {
      return { quarters: [] };
    }
  }

  async fetchInsiderTransactions(
    symbol: string,
  ): Promise<InsiderTransaction[]> {
    try {
      const r = await this.getCachedQuoteSummary(symbol);
      return r.insiderTransactions;
    } catch {
      return [];
    }
  }

  async fetchNews(symbol: string): Promise<NewsItem[]> {
    try {
      return await fetchYahooNews(symbol);
    } catch {
      return [];
    }
  }

  async fetchGlobalMacroNews(): Promise<NewsItem[]> {
    try {
      return await fetchYahooGlobalMacroNews();
    } catch {
      return [];
    }
  }

  async fetchBarronsData(symbol: string): Promise<BarronsDataBundle | null> {
    try {
      return await fetchBarronsData(symbol);
    } catch {
      return null;
    }
  }
}
