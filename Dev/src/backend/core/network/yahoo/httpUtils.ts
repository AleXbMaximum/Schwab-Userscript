import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 60);
  }
}

// GM.xmlHttpRequest type declaration (Tampermonkey TM4 API)
declare const GM: {
  xmlHttpRequest(details: {
    method: "GET" | "POST";
    url: string;
    headers?: Record<string, string>;
    data?: string;
    timeout?: number;
    onload?: (response: {
      status: number;
      statusText: string;
      responseText: string;
    }) => void;
    onerror?: (response: {
      status: number;
      statusText: string;
      responseText: string;
    }) => void;
    ontimeout?: () => void;
  }): { abort(): void };
};

export function gmGetWithHeaders(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 30_000,
): Promise<string> {
  const domain = extractDomain(url);
  log.debug("http.get", { domain });
  return new Promise((resolve, reject) => {
    GM.xmlHttpRequest({
      method: "GET",
      url,
      headers,
      timeout: timeoutMs,
      onload: (resp) => {
        if (resp.status >= 400) {
          log.warn("http.get", { domain, status: resp.status });
          reject(new Error(`HTTP ${resp.status}: ${url}`));
          return;
        }
        resolve(resp.responseText);
      },
      onerror: () => {
        log.warn("http.get", { domain, error: "network_error" });
        reject(new Error(`Network error fetching: ${url}`));
      },
      ontimeout: () => {
        log.warn("http.get", { domain, error: "timeout", timeoutMs });
        reject(new Error(`Timeout fetching: ${url}`));
      },
    });
  });
}

export function gmGet(url: string, timeoutMs = 30_000): Promise<string> {
  return gmGetWithHeaders(
    url,
    { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    timeoutMs,
  );
}
