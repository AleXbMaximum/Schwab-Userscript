import type{ Settings } from "shared/types/core";
import { DEFAULT_HOLDINGS_TABLE_COLUMN_ORDER } from "shared/types/holdingsTableColumns";

export interface StorageConfigEntry {
  important: boolean;
  compress: boolean;
  type: string;
  default: any;
}

export const STORAGE_CONFIG: Record<string, StorageConfigEntry> = {
  authToken: {
    important: false,
    compress: false,
    type: "string",
    default: null,
  },
  accountId: {
    important: false,
    compress: false,
    type: "string",
    default: null,
  },
  settings: {
    important: true,
    compress: false,
    type: "object",
    default: {
      refreshInterval: 1000,
      holdingsRefreshInterval: 10000,
      quotesRefreshInterval: 15000,
      newsYahooMacroRefreshInterval: 120000,
      newsYahooSymbolRefreshInterval: 120000,
      newsBarronsRefreshInterval: 180000,
      newsFinancialJuiceRefreshInterval: 45000,
      isRefreshing: true,
      isHoldingsRefreshing: true,
      isQuotesRefreshing: true,
      enableStreamer: true,
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
      extraBetaTickers: [],
    } as Settings,
  },
  lastUpdate: {
    important: true,
    compress: false,
    type: "string",
    default: "",
  },
  rawHoldings: {
    important: false,
    compress: false,
    type: "object",
    default: null,
  },
  betaData: {
    important: false,
    compress: false,
    type: "object",
    default: null,
  },
};

export function getStorageKeys(): string[] {
  return Object.keys(STORAGE_CONFIG);
}

export function getKeyConfig(key: string): StorageConfigEntry | null {
  return STORAGE_CONFIG[key] || null;
}

export function isConfiguredKey(key: string): boolean {
  return key in STORAGE_CONFIG;
}
