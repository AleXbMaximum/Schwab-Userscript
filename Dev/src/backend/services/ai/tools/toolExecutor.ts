import type { DataFetcher } from "../pipeline/DataFetcher";
import type { AIToolName, MarketDataBundle } from "../types";
import {
  formatBalanceSheet,
  formatBarronsAnalystData,
  formatBarronsNews,
  formatBarronsStatement,
  formatCashFlow,
  formatIncomeStatement,
  formatInsiderTransactions,
  formatNewsItems,
} from "../pipeline/formatters";

export const buildToolExecutor = (
  symbol: string,
  marketData: MarketDataBundle,
  fetcher: DataFetcher,
): Record<AIToolName, () => Promise<string>> => ({
  get_balance_sheet: async () => {
    const data =
      marketData.balanceSheet ??
      (await fetcher.fetchBalanceSheet(symbol));
    return formatBalanceSheet(data);
  },
  get_cash_flow: async () => {
    const data =
      marketData.cashFlow ?? (await fetcher.fetchCashFlow(symbol));
    return formatCashFlow(data);
  },
  get_income_statement: async () => {
    const data =
      marketData.incomeStatement ??
      (await fetcher.fetchIncomeStatement(symbol));
    return formatIncomeStatement(data);
  },
  get_insider_transactions: async () => {
    const data =
      marketData.insiderTransactions ??
      (await fetcher.fetchInsiderTransactions(symbol));
    return formatInsiderTransactions(data);
  },
  get_global_macro_news: async () => {
    const data =
      marketData.globalMacroNews ??
      (await fetcher.fetchGlobalMacroNews());
    return formatNewsItems(data, "global macro news");
  },
  get_barrons_news: async () => {
    const b =
      marketData.barrons ?? (await fetcher.fetchBarronsData(symbol));
    return b ? formatBarronsNews(b) : "Barron's news unavailable.";
  },
  get_barrons_ratings: async () => {
    const b =
      marketData.barrons ?? (await fetcher.fetchBarronsData(symbol));
    return b
      ? formatBarronsAnalystData(b)
      : "Barron's ratings unavailable.";
  },
  get_barrons_financials: async () => {
    const b =
      marketData.barrons ?? (await fetcher.fetchBarronsData(symbol));
    if (!b) return "Barron's financials unavailable.";
    const parts: string[] = [];
    parts.push(
      formatBarronsStatement(
        b.incomeStatement,
        "INCOME STATEMENT (Annual)",
      ),
    );
    parts.push(
      formatBarronsStatement(b.balanceSheet, "BALANCE SHEET (Annual)"),
    );
    parts.push(
      formatBarronsStatement(b.cashFlowStatement, "CASH FLOW (Annual)"),
    );
    parts.push(
      formatBarronsStatement(
        b.incomeStatementQ,
        "INCOME STATEMENT (Quarterly)",
      ),
    );
    parts.push(
      formatBarronsStatement(b.balanceSheetQ, "BALANCE SHEET (Quarterly)"),
    );
    parts.push(
      formatBarronsStatement(b.cashFlowStatementQ, "CASH FLOW (Quarterly)"),
    );
    return (
      parts.filter(Boolean).join("\n\n") ||
      "No Barron's financial statements."
    );
  },
});
