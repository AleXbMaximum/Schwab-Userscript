import { generateUUID } from "shared/utils/data/uuid";
import { throw401, withTokenRefresh } from "../infra/httpUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

// ── Types ─────────────────────────────────────────────────────────────────────

export type IndicesHistoryPeriod =
  | "day"
  | "week"
  | "OneMonth"
  | "ThreeMonth"
  | "SixMonth"
  | "OneYear";

export type IndicesHistoryRegion = "americas" | "europe" | "asia";

export interface IndexLastQuote {
  name: string;
  symbol: string;
  value: number;
  changePercent: number;
  marketStatus: string;
}

export interface IndexHistoryPoint {
  value: number;
  dateTime: string;
}

export interface IndexQuoteHistory {
  lastQuote: IndexLastQuote;
  quoteHistory: IndexHistoryPoint[];
}

export interface IndicesHistoryResponse {
  quotesHistory: IndexQuoteHistory[];
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

const INDICES_HISTORY_URL =
  "https://ausgateway.schwab.com/api/is.ResearchExperience/v1/markets/indices/history";

export function fetchIndicesHistory(
  token?: string | null,
  params?: { region?: IndicesHistoryRegion; period?: IndicesHistoryPeriod },
): Promise<IndicesHistoryResponse> {
  const region = params?.region ?? "americas";
  const period = params?.period ?? "day";
  const span = log.span("fetchIndicesHistory", { region, period });

  const url = `${INDICES_HISTORY_URL}?region=${encodeURIComponent(region)}&period=${encodeURIComponent(period)}`;

  const doRequest = async (bearerToken: string): Promise<unknown> => {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + bearerToken,
        correlatorid: generateUUID(),
        "schwab-client-correlid": generateUUID(),
        "schwab-client-appid": "AD00007322",
        "schwab-client-channel": "IO",
        "schwab-env": "PROD",
        "schwab-environment": "PROD",
        "schwab-resource-version": "2",
      },
    });

    if (response.status === 401) {
      await throw401(response);
    }

    return response.json() as Promise<unknown>;
  };

  return withTokenRefresh(doRequest, token)
    .then((data: unknown) => {
      const payload = data as IndicesHistoryResponse;
      const count = payload?.quotesHistory?.length ?? 0;
      span.end("ok", { indexCount: count }, "debug");
      return payload;
    })
    .catch((err) => {
      span.end(
        "error",
        { error: (err as Error)?.message ?? String(err) },
        "error",
      );
      throw err;
    });
}
