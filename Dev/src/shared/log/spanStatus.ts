const SPAN_STATUS = Object.freeze({
  SUCCESS: "success",
  ERROR: "error",
  FAILURE: "failure",
  TIMEOUT: "timeout",
  CANCELLED: "cancelled",
  ABORTED: "aborted",
  UNAVAILABLE: "unavailable",
} as const);

export type SpanStatus = (typeof SPAN_STATUS)[keyof typeof SPAN_STATUS];

export function normalizeSpanStatus(status: unknown): string | null {
  if (!status || typeof status !== "string") {
    return null;
  }

  const normalized = status.toLowerCase();
  if ((Object.values(SPAN_STATUS) as string[]).includes(normalized)) {
    return normalized;
  }

  switch (normalized) {
    case "ok":
      return SPAN_STATUS.SUCCESS;
    case "fail":
    case "failed":
      return SPAN_STATUS.FAILURE;
    case "timeouted":
      return SPAN_STATUS.TIMEOUT;
    case "not available":
    case "unavailable":
      return SPAN_STATUS.UNAVAILABLE;
    default:
      return null;
  }
}
