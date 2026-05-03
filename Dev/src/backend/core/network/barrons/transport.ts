import { gmGetWithHeaders } from "../yahoo/httpUtils";

export function fetchBarronsJson(
  url: string,
  symbol: string,
  timeoutMs = 30_000,
): Promise<any> {
  return gmGetWithHeaders(
    url,
    {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en,zh-CN;q=0.9,zh-TW;q=0.8,zh;q=0.7",
      Referer: `https://www.barrons.com/market-data/stocks/${symbol}`,
    },
    timeoutMs,
  ).then((text) => JSON.parse(text));
}

export function fetchBarronsHtml(
  url: string,
  timeoutMs = 30_000,
): Promise<string> {
  return gmGetWithHeaders(
    url,
    {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en,zh-CN;q=0.9,zh-TW;q=0.8,zh;q=0.7",
    },
    timeoutMs,
  );
}
