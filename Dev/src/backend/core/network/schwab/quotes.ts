import { generateUUID } from "shared/utils/uuid";
import type{ QuotesResponse } from "shared/types/holdings";
import { isOptionSymbol } from "shared/utils/holdingsKeys";
import { computeWorkerPool } from "backend/computation/workers/ComputeWorkerPool";
import { throw401, withTokenRefresh } from "./httpUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

export function fetchQuotes(
  symbols: string[],
  token?: string | null,
): Promise<QuotesResponse> {
  const equitySymbols = symbols.filter((s) => !isOptionSymbol(s));

  const skippedOptions = symbols.length - equitySymbols.length;
  if (skippedOptions > 0) {
    log.debug("fetchQuotes.optionsSkipped", { count: skippedOptions });
  }

  if (equitySymbols.length === 0) {
    return Promise.resolve({ quotes: [] });
  }

  const span = log.span("fetchQuotes", { symbolCount: equitySymbols.length });

  const url = `https://ausgateway.schwab.com/api/is.ResearchExperience/v1/quote?symbols=${encodeURIComponent(
    equitySymbols.join(","),
  )}&requesttype=basic`;

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
    .then((d: unknown) => computeWorkerPool.parseQuotes(d))
    .then((result) => {
      span.end("ok", { quoteCount: result.quotes.length }, "debug");
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
