import type{ HoldingsResponse, QuotesResponse } from "shared/types/holdings";
import type{ StreamerUpdate } from "shared/types/streamer";

export type {
  StreamerUpdate,
} from "shared/types/streamer";

export type RawTableMeta = {
  source: string;
  receivedAt: number;
  [key: string]: unknown;
};

export type RawTableUpdate = {
  symbol: string;
  fields: Record<string, unknown>;
  meta?: Partial<RawTableMeta>;
};

export interface NetworkDataSource {
  fetchHoldings(): Promise<HoldingsResponse>;
  fetchQuotes(symbols: string[]): Promise<QuotesResponse>;
  subscribeStreamer(
    onUpdate: (data: StreamerUpdate[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
}
