import { getKeyConfig, isConfiguredKey } from "./config/storageConfig";
import { logService } from "shared/log/core/LogService";
import type { KVStore } from "../db/core/KVStore";

export type PersistenceSaveResult =
  | { success: true; skipped?: boolean; error?: undefined }
  | { success: false; error: string };
export type PersistenceLoadResult =
  | { success: true; value: any; error?: undefined }
  | { success: false; value?: undefined; error: string };
export type PersistenceClearResult =
  | { success: true; removedCount: number; error?: undefined }
  | { success: false; removedCount: number; error?: string };

export function createPersistenceLayer({
  prefix,
  validator,
  kvStore,
  debug = false,
}: {
  prefix: string;
  validator: { coerceToType: (key: string, value: any) => any };
  kvStore: KVStore;
  debug?: boolean;
}) {
  if (!prefix || typeof prefix !== "string") {
    throw new TypeError("Storage operation requires a prefix string");
  }

  let storageToken = "";

  const logStorage = logService.namespace("storage");

  function logDebug(operation: string, details: any = {}, level = "debug") {
    if (!debug) return;
    const payload =
      typeof details === "string" ? { message: details } : details || {};
    if (typeof logStorage[level] === "function") {
      logStorage[level](operation, payload);
    } else {
      logStorage.debug(operation, payload);
    }
  }

  function getKVKey(key: string): string | null {
    if (!storageToken || !isConfiguredKey(key)) return null;
    return `${prefix}.${key}.${storageToken}`;
  }

  return {
    setToken(token: string | null) {
      storageToken = token || "";
      logDebug("persistence.setToken", { tokenPresent: !!token }, "info");
    },

    getToken() {
      return storageToken;
    },

    async saveToStorage(
      key: string,
      value: any,
    ): Promise<PersistenceSaveResult> {
      if (!storageToken || !isConfiguredKey(key)) {
        return { success: false, error: "Invalid token or key" };
      }

      if (value === undefined) {
        return { success: true, skipped: true };
      }

      const kvKey = getKVKey(key);
      if (!kvKey) {
        return { success: false, error: "Failed to generate storage key" };
      }

      try {
        await kvStore.set(kvKey, value);
        logDebug("persistence.save.success", { key }, "info");
        return { success: true };
      } catch (error: any) {
        logDebug(
          "persistence.save.error",
          { key, error: error?.message },
          "error",
        );
        return { success: false, error: error?.message ?? String(error) };
      }
    },

    async loadFromStorage(key: string): Promise<PersistenceLoadResult> {
      if (!storageToken || !isConfiguredKey(key)) {
        return { success: false, error: "Invalid token or key" };
      }

      const kvKey = getKVKey(key);
      if (!kvKey) {
        return { success: false, error: "Failed to generate storage key" };
      }

      try {
        const raw = await kvStore.get(kvKey);
        if (raw === undefined) {
          const config = getKeyConfig(key);
          logDebug("persistence.load.notFound", { key, returning: "default" });
          return { success: true, value: config.default };
        }

        const value = validator.coerceToType(key, raw);
        logDebug("persistence.load.success", { key }, "info");
        return { success: true, value };
      } catch (error: any) {
        logDebug(
          "persistence.load.error",
          { key, error: error?.message },
          "error",
        );
        return { success: false, error: error?.message ?? String(error) };
      }
    },

    /**
     * Load multiple keys in a single IDB transaction via getByPrefix.
     * Returns a Map<key, PersistenceLoadResult> for each requested key.
     */
    async loadMultiple(
      keys: string[],
    ): Promise<Map<string, PersistenceLoadResult>> {
      const results = new Map<string, PersistenceLoadResult>();
      if (!storageToken) {
        for (const key of keys) {
          results.set(key, { success: false, error: "No token set" });
        }
        return results;
      }

      // Build a map from kvKey → configKey for reverse lookup
      const kvKeyToConfigKey = new Map<string, string>();
      for (const key of keys) {
        if (!isConfiguredKey(key)) {
          results.set(key, { success: false, error: "Invalid key" });
          continue;
        }
        const kvKey = getKVKey(key);
        if (!kvKey) {
          results.set(key, {
            success: false,
            error: "Failed to generate storage key",
          });
          continue;
        }
        kvKeyToConfigKey.set(kvKey, key);
      }

      try {
        // Single IDB transaction: fetch all keys with matching prefix
        const allEntries = await kvStore.getByPrefix(`${prefix}.`);

        // Distribute fetched values to their config keys
        for (const [kvKey, configKey] of kvKeyToConfigKey) {
          const raw = allEntries.get(kvKey);
          if (raw === undefined) {
            const config = getKeyConfig(configKey);
            results.set(configKey, { success: true, value: config.default });
          } else {
            const value = validator.coerceToType(configKey, raw);
            results.set(configKey, { success: true, value });
          }
        }

        logDebug(
          "persistence.loadMultiple.success",
          { keyCount: keys.length },
          "info",
        );
      } catch (error: any) {
        // Fall back: mark all un-resolved keys as failed
        for (const [, configKey] of kvKeyToConfigKey) {
          if (!results.has(configKey)) {
            results.set(configKey, {
              success: false,
              error: error?.message ?? String(error),
            });
          }
        }
        logDebug(
          "persistence.loadMultiple.error",
          { error: error?.message },
          "error",
        );
      }

      return results;
    },

    async removeFromStorage(key: string) {
      if (!storageToken || !isConfiguredKey(key)) return false;
      const kvKey = getKVKey(key);
      if (!kvKey) return false;

      try {
        await kvStore.delete(kvKey);
        logDebug("persistence.remove.success", { key }, "info");
        return true;
      } catch (error: any) {
        logDebug(
          "persistence.remove.error",
          { key, error: error?.message },
          "error",
        );
        return false;
      }
    },

    async clearStorage(): Promise<PersistenceClearResult> {
      if (!storageToken) {
        return { success: false, removedCount: 0, error: "No token set" };
      }

      try {
        const tokenSuffix = `.${storageToken}`;
        const all = await kvStore.getByPrefix(`${prefix}.`);
        let removedCount = 0;
        for (const [kvKey] of all) {
          if (kvKey.endsWith(tokenSuffix)) {
            await kvStore.delete(kvKey);
            removedCount++;
          }
        }
        logDebug("persistence.clear", { removedCount }, "info");
        return { success: true, removedCount };
      } catch (error: any) {
        logDebug("persistence.clear.error", { error: error?.message }, "error");
        return {
          success: false,
          removedCount: 0,
          error: error?.message ?? String(error),
        };
      }
    },

    async removeStaleTokenEntries() {
      if (!storageToken) return false;
      try {
        const tokenSuffix = `.${storageToken}`;
        const all = await kvStore.getByPrefix(`${prefix}.`);
        let removed = false;
        for (const [kvKey] of all) {
          if (!kvKey.endsWith(tokenSuffix)) {
            await kvStore.delete(kvKey);
            removed = true;
          }
        }
        if (removed)
          logDebug("persistence.evict.staleTokens", { removed }, "info");
        return removed;
      } catch {
        return false;
      }
    },
  };
}
