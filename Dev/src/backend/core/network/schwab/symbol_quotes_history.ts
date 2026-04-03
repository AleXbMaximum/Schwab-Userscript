import { generateUUID } from "shared/utils/uuid";
import { throw401, withTokenRefresh } from "./httpUtils";

export type SchwabPeriod =
  | "day"
  | "week"
  | "OneMonth"
  | "ThreeMonth"
  | "SixMonth"
  | "OneYear"
  | "ThreeYear"
  | "FiveYear";

export interface SchwabChartOptions {
  period?: SchwabPeriod;
  includeExtendedHours?: boolean;
}

export interface SchwabChartBar {
  lastPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  lastPriceDate: string;
}

export interface SchwabChartMeta {
  change: number;
  changePercent: number;
  previousClose: number;
  previousCloseDate: string;
}

export interface SchwabChartResult {
  meta: SchwabChartMeta | null;
  bars: SchwabChartBar[];
}

export function fetchSchwabChart(
  symbol: string,
  options?: SchwabChartOptions,
  token?: string | null,
): Promise<SchwabChartResult> {
  const period = options?.period ?? "day";
  const includeExtended = options?.includeExtendedHours ?? true;
  const url =
    `https://ausgateway.schwab.com/api/is.SharedResearchExperience/V1/symbol/quotes/history` +
    `?symbols=${encodeURIComponent(symbol)}` +
    `&period=${period}` +
    `&needExtendedHoursData=${includeExtended}`;

  const empty: SchwabChartResult = { meta: null, bars: [] };

  const doRequest = async (bearerToken: string): Promise<unknown> => {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + bearerToken,
        "Schwab-Client-Channel": "IO",
        "Schwab-Env": "PROD",
        "Schwab-Client-CorrelId": generateUUID(),
        "Schwab-Resource-Version": "2",
      },
    });

    if (response.status === 401) {
      await throw401(response);
    }

    return response.json() as Promise<unknown>;
  };

  return withTokenRefresh(doRequest, token)
    .then((payload: unknown) => parseSchwabChartResponse(payload))
    .catch(() => empty);
}

function parseSchwabChartResponse(payload: unknown): SchwabChartResult {
  const empty: SchwabChartResult = { meta: null, bars: [] };

  if (!payload || typeof payload !== "object") return empty;

  const root = payload as Record<string, unknown>;
  const stockChartArr = root["stockChart"];
  if (!Array.isArray(stockChartArr) || stockChartArr.length === 0) return empty;

  const chart = stockChartArr[0] as Record<string, unknown>;

  const meta: SchwabChartMeta = {
    change: typeof chart["change"] === "number" ? chart["change"] : 0,
    changePercent:
      typeof chart["changePercent"] === "number" ? chart["changePercent"] : 0,
    previousClose:
      typeof chart["previousClose"] === "number" ? chart["previousClose"] : 0,
    previousCloseDate:
      typeof chart["previousCloseDate"] === "string"
        ? chart["previousCloseDate"]
        : "",
  };

  const timeSeries = chart["timeSeries"];
  if (!Array.isArray(timeSeries)) return { meta, bars: [] };

  const bars: SchwabChartBar[] = [];
  for (const entry of timeSeries) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    const lastPrice = typeof e["lastPrice"] === "number" ? e["lastPrice"] : 0;
    if (lastPrice <= 0) continue;

    bars.push({
      lastPrice,
      openPrice: typeof e["openPrice"] === "number" ? e["openPrice"] : 0,
      highPrice: typeof e["highPrice"] === "number" ? e["highPrice"] : 0,
      lowPrice: typeof e["lowPrice"] === "number" ? e["lowPrice"] : 0,
      volume: typeof e["volume"] === "number" ? e["volume"] : 0,
      lastPriceDate:
        typeof e["lastPriceDate"] === "string" ? e["lastPriceDate"] : "",
    });
  }

  return { meta, bars };
}
