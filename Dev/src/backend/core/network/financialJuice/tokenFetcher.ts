import { gmGetWithHeaders } from "../yahoo/httpUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

const FJ_HOME_URL = "https://www.financialjuice.com/home";
const TOKEN_REGEX = /centrifugoToken\s*=\s*['"]([^'"]+)['"]/;
const URL_REGEX = /centrifugoUrl\s*=\s*['"]([^'"]+)['"]/;

// Mimic a real browser fetch — the FJ home page is server-rendered HTML
// shell and a bare GM request without these headers can be cloaked / cached
// as bot traffic.
const FJ_HOME_HEADERS: Record<string, string> = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export type FinancialJuiceCredentials = {
  /** wss://rt.financialjuice.com/connection/websocket */
  url: string;
  /** Centrifugo JWT */
  token: string;
  /** JWT exp claim as epoch ms, or 0 if undecodable. Used for diagnostics. */
  expiresAtUtcMs: number;
  /**
   * Channels listed in the JWT's `subs` claim. Centrifugo auto-subscribes
   * the client to these on connect — we still pass them through so the
   * streamer knows the authoritative set.
   */
  channels: string[];
};

/**
 * Fetch the FJ home page and extract the Centrifugo URL + JWT that the page
 * uses to bootstrap its realtime feed. Returns null if either is missing
 * (e.g. anonymous visitors getting a different HTML shell, or page changes).
 */
export async function fetchFinancialJuiceCredentials(): Promise<FinancialJuiceCredentials | null> {
  let html: string;
  try {
    html = await gmGetWithHeaders(FJ_HOME_URL, FJ_HOME_HEADERS, 20_000);
  } catch (error) {
    log.warn("fj.token.fetch.fail", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const tokenMatch = html.match(TOKEN_REGEX);
  const urlMatch = html.match(URL_REGEX);
  if (!tokenMatch?.[1] || !urlMatch?.[1]) {
    log.warn("fj.token.parse.fail", {
      tokenFound: !!tokenMatch?.[1],
      urlFound: !!urlMatch?.[1],
      htmlLen: html.length,
    });
    return null;
  }

  const token = tokenMatch[1];
  const url = urlMatch[1];
  const claims = decodeJwtClaims(token);
  const expiresAtUtcMs =
    typeof claims?.exp === "number" ? claims.exp * 1000 : 0;
  const channels =
    claims?.subs && typeof claims.subs === "object"
      ? Object.keys(claims.subs)
      : [];
  log.info("fj.token.fetched", {
    url,
    expiresAtUtcMs,
    expiresInSec:
      expiresAtUtcMs > 0
        ? Math.max(0, Math.round((expiresAtUtcMs - Date.now()) / 1000))
        : null,
    channelCount: channels.length,
  });
  return { url, token, expiresAtUtcMs, channels };
}

type JwtClaims = { exp?: unknown; subs?: Record<string, unknown> };

function decodeJwtClaims(jwt: string): JwtClaims | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as JwtClaims;
  } catch {
    return null;
  }
}
