import { defaultSettings } from "shared/settings/settingsNormalization";

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
    default: defaultSettings,
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
