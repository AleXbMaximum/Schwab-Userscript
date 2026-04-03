import { generateUUID } from "shared/utils/uuid";
import type{ OptionsChainsResponse } from "shared/types/options";
import { computeWorkerPool } from "backend/computation/workers/ComputeWorkerPool";
import { throw401, withTokenRefresh } from "./httpUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

export type FetchOptionChainsParams = {
  expirationDates?: string[];
};

export function fetchOptionChains(
  symbol: string,
  token?: string | null,
  params: FetchOptionChainsParams = {},
): Promise<OptionsChainsResponse> {
  const upperSymbol = symbol.trim().toUpperCase();
  if (!upperSymbol) {
    return Promise.reject(new Error("Symbol is required"));
  }

  const span = log.span("fetchOptionChains", { symbol: upperSymbol });

  const query = new URLSearchParams();
  query.set("Symbol", upperSymbol);
  query.set("IncludeGreeks", "true");
  query.set("ExpirationTypes", "ALL");
  if (params.expirationDates && params.expirationDates.length > 0) {
    query.set("ExpirationDates", params.expirationDates.join(","));
  }

  const url = `https://ausgateway.schwab.com/api/is.CSOptionChainsWeb/v1/OptionChainsPort/OptionChains/chains?${query.toString()}`;

  const doRequest = async (bearerToken: string): Promise<unknown> => {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json;charset=UTF-8",
        Authorization: "Bearer " + bearerToken,
        "schwab-client-appid": "AD00007322",
        "schwab-client-channel": "IO",
        "schwab-client-correlid": generateUUID(),
        "schwab-chains-provider": "QuotePlant",
        "schwab-resource-version": "1.0",
        containerid: "RESEARCH_CHAINS",
        clienturl: `https://client.schwab.com/app/research/#/stocks/${upperSymbol}?tab=options`,
        includeadjusted: "false",
      },
    });

    if (response.status === 401) {
      await throw401(response);
    }

    return response.json() as Promise<unknown>;
  };

  return withTokenRefresh(doRequest, token)
    .then((d: unknown) => computeWorkerPool.parseOptionsChain(d))
    .then((result) => {
      span.end("ok", { expiryCount: result.expirations?.length ?? 0 }, "debug");
      return result;
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
