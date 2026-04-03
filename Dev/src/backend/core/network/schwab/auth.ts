import { generateUUID } from "shared/utils/uuid";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("auth");

let _currentAuthToken: string | null = null;
let _refreshPromise: Promise<string> | null = null;
let _autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
let _visibilityHandler: (() => void) | null = null;

const _tokenListeners = new Set<(token: string | null) => void>();

function notifyTokenListeners(token: string | null): void {
  for (const listener of _tokenListeners) {
    listener(token);
  }
}

export function setAuthToken(token: string | null | undefined): void {
  if (_currentAuthToken === token) return;
  _currentAuthToken = token || null;
  notifyTokenListeners(_currentAuthToken);
}

export function getAuthToken(): string | null {
  return _currentAuthToken;
}

export function subscribeAuthToken(
  listener: (token: string | null) => void,
): () => void {
  if (typeof listener !== "function") {
    throw new TypeError("listener must be a function");
  }
  _tokenListeners.add(listener);
  return () => {
    _tokenListeners.delete(listener);
  };
}

export function fetchAuthToken(): Promise<string> {
  const span = log.span("fetchAuthToken");
  return fetch("https://client.schwab.com/api/auth/authorize/scope/api", {
    headers: { Accept: "application/json" },
  })
    .then((r) => r.json() as Promise<{ token: string }>)
    .then((j) => {
      span.end("ok", { hasToken: !!j.token }, "info");
      return j.token;
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

export async function refreshAuthToken(
  options: { force?: boolean } = {},
): Promise<string> {
  const { force = false } = options;

  if (!force && _refreshPromise) {
    log.debug("auth.refresh", { status: "deduped" });
    return _refreshPromise;
  }

  log.info("auth.refresh", { force });

  _refreshPromise = Promise.resolve()
    .then(() => fetchAuthToken())
    .then((token) => {
      if (!token) {
        throw new Error("authorize/scope/api returned empty token");
      }
      setAuthToken(token);
      log.info("auth.refresh", { status: "refreshed" });
      return token;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

export function startAuthTokenAutoRefresh(
  options: { intervalMs?: number } = {},
): () => void {
  const { intervalMs = 600_000 } = options;

  stopAuthTokenAutoRefresh();
  log.info("auth.autoRefresh.start", { intervalMs });

  let consecutiveFailures = 0;

  // Refresh token immediately when the tab becomes visible again,
  // covering the gap where auto-refresh skips while the tab is hidden.
  _visibilityHandler = () => {
    if (document.visibilityState === "visible") {
      refreshAuthToken().catch((err) => {
        log.warn("auth.visibility.refreshFail", {
          error: (err as Error)?.message ?? String(err),
        });
      });
    }
  };
  document.addEventListener("visibilitychange", _visibilityHandler);

  _autoRefreshTimer = setInterval(() => {
    try {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
    } catch {}

    refreshAuthToken(consecutiveFailures >= 2 ? { force: true } : {})
      .then(() => {
        consecutiveFailures = 0;
      })
      .catch((err) => {
        consecutiveFailures++;
        log.warn("auth.autoRefresh.fail", {
          error: (err as Error)?.message ?? String(err),
          consecutiveFailures,
        });
      });
  }, intervalMs);

  return stopAuthTokenAutoRefresh;
}

export function stopAuthTokenAutoRefresh(): void {
  if (_autoRefreshTimer) {
    clearInterval(_autoRefreshTimer);
    _autoRefreshTimer = null;
  }
  if (_visibilityHandler) {
    document.removeEventListener("visibilitychange", _visibilityHandler);
    _visibilityHandler = null;
  }
}

// ── Session Keep-Alive ────────────────────────────────────────────────────────
// Schwab HTTP session cookies (SchwabSession, SchwabClientAuth) expire
// independently of the API bearer token. Pinging the keep-alive endpoint
// prevents 302 redirects to the login page during long sessions.

const KEEP_ALIVE_URL = "https://client.schwab.com/KeepAlive/Nka.aspx";
const KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let _keepAliveVisibilityHandler: (() => void) | null = null;

async function pingSessionKeepAlive(): Promise<void> {
  try {
    const resp = await fetch(KEEP_ALIVE_URL, { credentials: "include" });
    if (!resp.ok) {
      log.warn("session-keep-alive", { status: resp.status });
    }
  } catch (e) {
    log.warn("session-keep-alive", {
      error: (e as Error)?.message ?? String(e),
    });
  }
}

export function startSessionKeepAlive(): () => void {
  stopSessionKeepAlive();
  log.info("session-keep-alive.start", { intervalMs: KEEP_ALIVE_INTERVAL_MS });

  pingSessionKeepAlive(); // immediate first ping

  _keepAliveTimer = setInterval(() => {
    try {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
    } catch {}
    pingSessionKeepAlive();
  }, KEEP_ALIVE_INTERVAL_MS);

  _keepAliveVisibilityHandler = () => {
    if (document.visibilityState === "visible") {
      pingSessionKeepAlive();
    }
  };
  document.addEventListener("visibilitychange", _keepAliveVisibilityHandler);

  return stopSessionKeepAlive;
}

export function stopSessionKeepAlive(): void {
  if (_keepAliveTimer) {
    clearInterval(_keepAliveTimer);
    _keepAliveTimer = null;
  }
  if (_keepAliveVisibilityHandler) {
    document.removeEventListener(
      "visibilitychange",
      _keepAliveVisibilityHandler,
    );
    _keepAliveVisibilityHandler = null;
  }
}

// ── Markit Token ──────────────────────────────────────────────────────────────
// Markit (IHS Markit / S&P Global) token is required for wallst.com endpoints
// (calendar, news story, news search). Fetched lazily on first use.

const MARKIT_TOKEN_URL =
  "https://ausgateway.schwab.com/api/is.ResearchExperience/v1/markets/markittokenbyaccid";

let _markitToken: string | null = null;
let _markitTokenPromise: Promise<string> | null = null;

export async function fetchMarkitToken(
  options?: { force?: boolean },
): Promise<string> {
  if (_markitTokenPromise && !options?.force) return _markitTokenPromise;

  _markitTokenPromise = (async () => {
    const span = log.span("fetchMarkitToken");
    const bearerToken = getAuthToken();
    if (!bearerToken) throw new Error("Missing auth token for Markit fetch");

    try {
      const resp = await fetch(MARKIT_TOKEN_URL, {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + bearerToken,
          correlatorid: generateUUID(),
          "schwab-client-correlid": generateUUID(),
          "schwab-client-appid": "AD00007322",
          "schwab-client-channel": "IO",
          "schwab-env": "PROD",
          "schwab-environment": "PROD",
        },
      });

      if (!resp.ok) {
        throw new Error(`Markit token fetch failed: ${resp.status}`);
      }

      const data = (await resp.json()) as { token?: string };
      _markitToken = data.token ?? null;
      if (!_markitToken) {
        throw new Error("Markit token response missing token field");
      }

      span.end("ok", { hasToken: true }, "info");
      return _markitToken;
    } catch (err) {
      span.end(
        "error",
        { error: (err as Error)?.message ?? String(err) },
        "error",
      );
      throw err;
    }
  })();

  try {
    return await _markitTokenPromise;
  } finally {
    _markitTokenPromise = null;
  }
}

export function getMarkitToken(): string | null {
  return _markitToken;
}
