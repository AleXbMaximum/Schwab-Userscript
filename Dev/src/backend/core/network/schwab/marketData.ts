import { generateUUID } from "shared/utils/uuid";
import { throw401, withTokenRefresh } from "./httpUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

// ── Types ─────────────────────────────────────────────────────────────────────

export type MoverRankingType = "MostActive" | "PctGainers" | "PctLosers";

export interface CompanyMover {
  symbol: string;
  companyName: string;
  priceLast: number;
  priceChangePercent: number;
  volume: number;
  priceLow52Week: number;
  priceHigh52Week: number;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

const COMPANY_MOVERS_URL =
  "https://ausgateway.schwab.com/api/is.ResearchExperience/v1/companymovers";

export function fetchCompanyMovers(
  token?: string | null,
  params?: {
    exchange?: string;
    rankingType?: MoverRankingType;
    sector?: string;
  },
): Promise<CompanyMover[]> {
  const exchange = params?.exchange ?? "all";
  const rankingType = params?.rankingType ?? "MostActive";
  const sector = params?.sector ?? "all";
  const span = log.span("fetchCompanyMovers", {
    exchange,
    rankingType,
    sector,
  });

  const url =
    `${COMPANY_MOVERS_URL}?exchange=${encodeURIComponent(exchange)}` +
    `&rankingType=${encodeURIComponent(rankingType)}` +
    `&sector=${encodeURIComponent(sector)}`;

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
      },
    });

    if (response.status === 401) {
      await throw401(response);
    }

    return response.json() as Promise<unknown>;
  };

  return withTokenRefresh(doRequest, token)
    .then((data: unknown) => {
      const items = (Array.isArray(data) ? data : []) as CompanyMover[];
      span.end("ok", { moverCount: items.length }, "debug");
      return items;
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
