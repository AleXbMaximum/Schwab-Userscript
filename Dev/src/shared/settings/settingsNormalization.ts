import type {
  RebalanceAnchorMode,
  RebalanceProfile,
  RebalanceTargets,
  Settings,
} from "../types/core";
import { DEFAULT_NEWS_REFRESH_INTERVALS } from "./newsRefreshDefaults";
import {
  DEFAULT_HOLDINGS_TABLE_COLUMN_ORDER,
  normalizeHoldingsTableViewModes,
  normalizeHoldingsTableActiveViewModeId,
} from "../types/holdingsTableColumns";

/**
 * Resolve "is this feature enabled?" from an arbitrary stored value.
 * Returns false only if the value is explicitly the boolean `false`.
 * All other values (true, undefined, null, etc.) resolve to true.
 *
 * Mirrors the router's delta semantics so startup and runtime updates agree.
 */
export function isFeatureEnabled(value: unknown): boolean {
  return value !== false;
}

export const defaultSettings: Settings = {
  refreshInterval: 1000,
  holdingsRefreshInterval: 10000,
  quotesRefreshInterval: 15000,
  newsYahooMacroRefreshInterval: DEFAULT_NEWS_REFRESH_INTERVALS.yahooMacroMs,
  newsYahooSymbolRefreshInterval:
    DEFAULT_NEWS_REFRESH_INTERVALS.yahooSymbolMs,
  newsBarronsRefreshInterval: DEFAULT_NEWS_REFRESH_INTERVALS.barronsMs,
  newsFinancialJuiceRssRefreshInterval:
    DEFAULT_NEWS_REFRESH_INTERVALS.financialJuiceRssMs,
  newsSchwabRefreshInterval: DEFAULT_NEWS_REFRESH_INTERVALS.schwabMs,
  newsYahooMacroEnabled: true,
  newsYahooSymbolEnabled: true,
  newsBarronsEnabled: true,
  newsFinancialJuiceRssEnabled: true,
  newsFinancialJuiceStreamEnabled: true,
  newsSchwabEnabled: true,
  isRefreshing: true,
  isHoldingsRefreshing: true,
  isQuotesRefreshing: true,
  enableStreamer: true,
  enableOvernightPrice: true,
  enableBalances: true,
  warningRulesJson: '{\n  "version": 1,\n  "rules": []\n}',
  holdingsTableViewModes: [
    {
      id: "default",
      name: "Default",
      isVisible: true,
      columnOrder: DEFAULT_HOLDINGS_TABLE_COLUMN_ORDER,
    },
  ],
  holdingsTableActiveViewModeId: "default",
  accountSnapshotIntervalMs: 10_000,
  accountSnapshotRecordNight: false,
  accountSnapshotAutoArchive: true,
  accountSnapshotArchiveThreshold: 200_000,
  accountSnapshotRetentionDays: 7,
  betaRefreshIntervalMs: 7_200_000,
};

const VALID_ANCHOR_MODES = new Set<RebalanceAnchorMode>([
  "shares",
  "deltaDollar",
  "deltaDollarPct",
  "betaPct",
]);

export const normalizeRebalanceTargets = (
  raw: unknown,
): RebalanceTargets | undefined => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;

  const result: RebalanceTargets = {};
  for (const [key, entry] of Object.entries(obj)) {
    if (typeof key !== "string" || key.length === 0) continue;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    const anchor = e.anchor as RebalanceAnchorMode;
    const value = Number(e.value);
    if (!VALID_ANCHOR_MODES.has(anchor) || !Number.isFinite(value)) continue;
    result[key] = { anchor, value: Math.round(value * 100) / 100 };
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

export const normalizeRebalanceProfiles = (
  raw: unknown,
): RebalanceProfile[] | undefined => {
  if (!Array.isArray(raw)) return undefined;

  const byId = new Map<string, RebalanceProfile>();
  let fallbackIdx = 0;

  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const candidate = entry as Record<string, unknown>;
    const rebalanceTargets = normalizeRebalanceTargets(
      candidate.rebalanceTargets,
    );
    if (!rebalanceTargets) continue;

    const createdAtRaw = Number(candidate.createdAt);
    const createdAt =
      Number.isFinite(createdAtRaw) && createdAtRaw > 0
        ? Math.round(createdAtRaw)
        : Date.now();
    const fallbackId = `rp_${createdAt}_${fallbackIdx++}`;
    const id =
      typeof candidate.id === "string" && candidate.id.trim().length > 0
        ? candidate.id.trim().slice(0, 80)
        : fallbackId;
    const fallbackName = new Date(createdAt)
      .toISOString()
      .slice(0, 16)
      .replace("T", " ");
    const name =
      typeof candidate.name === "string" && candidate.name.trim().length > 0
        ? candidate.name.trim().slice(0, 160)
        : fallbackName;

    const normalized: RebalanceProfile = {
      id,
      name,
      createdAt,
      rebalanceTargets,
    };
    const prev = byId.get(id);
    if (!prev || normalized.createdAt >= prev.createdAt)
      byId.set(id, normalized);
  }

  const profiles = [...byId.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 60);

  return profiles.length > 0 ? profiles : undefined;
};

export const normalizeSettings = (input: Settings): Settings => {
  const next = { ...(input as any) } as Settings;
  const normalizePositiveInt = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.round(parsed);
  };

  (next as any).newsYahooMacroRefreshInterval = normalizePositiveInt(
    (next as any).newsYahooMacroRefreshInterval,
    defaultSettings.newsYahooMacroRefreshInterval ??
      DEFAULT_NEWS_REFRESH_INTERVALS.yahooMacroMs,
  );
  (next as any).newsYahooSymbolRefreshInterval = normalizePositiveInt(
    (next as any).newsYahooSymbolRefreshInterval,
    defaultSettings.newsYahooSymbolRefreshInterval ??
      DEFAULT_NEWS_REFRESH_INTERVALS.yahooSymbolMs,
  );
  (next as any).newsBarronsRefreshInterval = normalizePositiveInt(
    (next as any).newsBarronsRefreshInterval,
    defaultSettings.newsBarronsRefreshInterval ??
      DEFAULT_NEWS_REFRESH_INTERVALS.barronsMs,
  );
  (next as any).newsFinancialJuiceRssRefreshInterval = normalizePositiveInt(
    (next as any).newsFinancialJuiceRssRefreshInterval,
    defaultSettings.newsFinancialJuiceRssRefreshInterval ??
      DEFAULT_NEWS_REFRESH_INTERVALS.financialJuiceRssMs,
  );
  (next as any).newsSchwabRefreshInterval = normalizePositiveInt(
    (next as any).newsSchwabRefreshInterval,
    defaultSettings.newsSchwabRefreshInterval ??
      DEFAULT_NEWS_REFRESH_INTERVALS.schwabMs,
  );

  (next as any).holdingsTableViewModes = normalizeHoldingsTableViewModes(
    (next as any).holdingsTableViewModes,
  );
  (next as any).holdingsTableActiveViewModeId =
    normalizeHoldingsTableActiveViewModeId(
      (next as any).holdingsTableActiveViewModeId,
      (next as any).holdingsTableViewModes,
    );
  const snapshotIntervalRaw = Number((next as any).accountSnapshotIntervalMs);
  (next as any).accountSnapshotIntervalMs =
    Number.isFinite(snapshotIntervalRaw) && snapshotIntervalRaw > 0
      ? Math.round(snapshotIntervalRaw)
      : defaultSettings.accountSnapshotIntervalMs;
  (next as any).accountSnapshotRecordNight =
    (next as any).accountSnapshotRecordNight === true;
  (next as any).accountSnapshotAutoArchive =
    (next as any).accountSnapshotAutoArchive !== false;
  const snapshotArchiveThresholdRaw = Number(
    (next as any).accountSnapshotArchiveThreshold,
  );
  (next as any).accountSnapshotArchiveThreshold =
    Number.isFinite(snapshotArchiveThresholdRaw) &&
    snapshotArchiveThresholdRaw > 0
      ? Math.round(snapshotArchiveThresholdRaw)
      : defaultSettings.accountSnapshotArchiveThreshold;
  const snapshotRetentionDaysRaw = Number(
    (next as any).accountSnapshotRetentionDays,
  );
  (next as any).accountSnapshotRetentionDays =
    Number.isFinite(snapshotRetentionDaysRaw) && snapshotRetentionDaysRaw >= 1
      ? Math.round(snapshotRetentionDaysRaw)
      : defaultSettings.accountSnapshotRetentionDays;

  if (
    (next as any).targetAllocations &&
    typeof (next as any).targetAllocations === "object" &&
    !Array.isArray((next as any).targetAllocations)
  ) {
    const cleaned: Record<string, number> = {};
    for (const [key, val] of Object.entries(
      (next as any).targetAllocations,
    )) {
      const num = Number(val);
      if (
        typeof key === "string" &&
        key.length > 0 &&
        Number.isFinite(num) &&
        num >= 0 &&
        num <= 100
      ) {
        cleaned[key] = Math.round(num * 100) / 100;
      }
    }
    (next as any).targetAllocations =
      Object.keys(cleaned).length > 0 ? cleaned : undefined;
  } else {
    (next as any).targetAllocations = undefined;
  }

  (next as any).rebalanceTargets = normalizeRebalanceTargets(
    (next as any).rebalanceTargets,
  );
  (next as any).rebalanceProfiles = normalizeRebalanceProfiles(
    (next as any).rebalanceProfiles,
  );

  return next;
};
