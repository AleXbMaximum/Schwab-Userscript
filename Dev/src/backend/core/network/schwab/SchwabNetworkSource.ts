import type { NetworkDataSource, StreamerUpdate } from "../types";
import type{ HoldingsResponse, QuotesResponse } from "shared/types/holdings";

import {
  fetchAccountInfo,
  fetchHoldings as fetchHoldingsApi,
} from "./holdings";
import { fetchQuotes as fetchQuotesApi } from "./quotes";
import { getAuthToken } from "./auth";
import { streamer } from "./streamer";
import {
  fetchIndicesHistory,
  type IndicesHistoryResponse,
  type IndicesHistoryRegion,
  type IndicesHistoryPeriod,
} from "./indicesHistory";
import {
  fetchCompanyMovers,
  type CompanyMover,
  type MoverRankingType,
} from "./marketData";
import {
  fetchSchwabNewsHeadlines,
  fetchSchwabNewsStory,
  fetchSchwabNewsSearch,
  type SchwabNewsHeadline,
  type SchwabNewsSearchResult,
} from "./news";
import {
  fetchCalendarEvents,
  fetchRatingChanges,
} from "./calendar";
import type {
  CalendarEvent,
  CalendarEventType,
  RatingChange,
} from "./parsing/calendarParser";

export class SchwabNetworkSource implements NetworkDataSource {
  async fetchHoldings(): Promise<HoldingsResponse> {
    const token = getAuthToken();
    const { accountId } = await fetchAccountInfo(token);
    return await fetchHoldingsApi(token, accountId);
  }

  async fetchQuotes(symbols: string[]): Promise<QuotesResponse> {
    const token = getAuthToken();
    return await fetchQuotesApi(symbols, token);
  }

  subscribeStreamer(
    onUpdate: (data: StreamerUpdate[]) => void,
    _onError?: (error: Error) => void,
  ): () => void {
    streamer.addListener(onUpdate);
    return () => {
      streamer.removeListener(onUpdate);
    };
  }

  // ── Extended Schwab API methods (not part of NetworkDataSource interface) ──

  async fetchIndicesHistory(params?: {
    region?: IndicesHistoryRegion;
    period?: IndicesHistoryPeriod;
  }): Promise<IndicesHistoryResponse> {
    const token = getAuthToken();
    return await fetchIndicesHistory(token, params);
  }

  async fetchCompanyMovers(params?: {
    exchange?: string;
    rankingType?: MoverRankingType;
    sector?: string;
  }): Promise<CompanyMover[]> {
    const token = getAuthToken();
    return await fetchCompanyMovers(token, params);
  }

  async fetchNewsHeadlines(opts?: {
    limit?: number;
    start?: number;
  }): Promise<SchwabNewsHeadline[]> {
    const token = getAuthToken();
    return await fetchSchwabNewsHeadlines(token, opts);
  }

  async fetchNewsStory(docKey: string): Promise<string> {
    return await fetchSchwabNewsStory(docKey);
  }

  async fetchNewsSearch(opts?: {
    rows?: number;
    start?: number;
    source?: string;
    keyword?: string;
  }): Promise<SchwabNewsSearchResult[]> {
    return await fetchSchwabNewsSearch(opts);
  }

  async fetchCalendarEvents(params?: {
    eventType?: CalendarEventType;
    activeDate?: string;
  }): Promise<CalendarEvent[]> {
    return await fetchCalendarEvents(params);
  }

  async fetchRatingChanges(): Promise<RatingChange[]> {
    return await fetchRatingChanges();
  }
}
