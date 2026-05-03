import { getAuthToken, refreshAuthToken } from "../infra/auth";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("network");

export type InvalidTokenPayload = {
  error: "invalid_token";
  [key: string]: unknown;
};

export type HttpError = Error & { status?: number; payload?: unknown };

export function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function parseErrorPayload(response: Response): Promise<unknown | null> {
  try {
    const text = await response.text();
    return safeJsonParse(text) || { raw: text };
  } catch {
    return null;
  }
}

function isInvalidTokenError(payload: unknown): payload is InvalidTokenPayload {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    (payload as { error?: unknown }).error === "invalid_token",
  );
}

export async function throw401(response: Response): Promise<never> {
  const payload = await parseErrorPayload(response);
  const err = new Error("Unauthorized") as HttpError;
  err.status = 401;
  err.payload = payload;
  throw err;
}

export function withTokenRefresh<T>(
  doRequest: (token: string) => Promise<T>,
  token?: string | null,
): Promise<T> {
  const initialToken = token || getAuthToken();
  if (!initialToken) {
    return Promise.reject(new Error("Missing auth token"));
  }

  return doRequest(initialToken).catch(async (err: unknown) => {
    const e = err as HttpError;
    if (e && e.status === 401 && isInvalidTokenError(e.payload)) {
      log.warn("auth.token.refresh", { reason: "invalid_token" });
      const newToken = await refreshAuthToken();
      return doRequest(newToken);
    }
    throw err;
  });
}
