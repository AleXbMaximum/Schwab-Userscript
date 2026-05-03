export type FormatTimeAgoOptions = {
  includeJustNow?: boolean;
  nowMs?: number;
};

export function formatTimeAgo(
  isoString: string,
  options: FormatTimeAgoOptions = {},
): string {
  const timestamp = new Date(isoString).getTime();
  if (!Number.isFinite(timestamp)) return "—";

  const nowMs = options.nowMs ?? Date.now();
  const diffMs = Math.max(0, nowMs - timestamp);
  const mins = Math.floor(diffMs / 60_000);
  const includeJustNow = options.includeJustNow !== false;

  if (mins < 1 && includeJustNow) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  return `${Math.floor(hrs / 24)}d ago`;
}
