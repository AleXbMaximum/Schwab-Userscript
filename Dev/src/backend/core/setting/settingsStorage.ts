import { deepClone } from "shared/utils/data/deepClone";
import { isEqual } from "shared/utils/data/equality";
import { STORAGE_CONFIG, getStorageKeys } from "./config/storageConfig";
import {
  createStateMapping,
  getStateValue,
  setStateValue,
} from "./config/stateMapping";
import { coerceToType } from "./validation";
import { createPersistenceLayer } from "./persistence";
import { createEventEmitter } from "shared/utils/state/eventEmitter";
import { logService } from "shared/log/core/LogService";
import { normalizeNumbersDeepInPlace } from "shared/utils/format/numberNormalizer";
import type { KVStore } from "../db/core/KVStore";

const PREFIX = "state";
const SAVE_DELAY = 100; // milliseconds

export function storageOperator(globalStateRefs: any, kvStore: KVStore) {
  const logStorage = logService.namespace("storage");

  const stateMapping = createStateMapping(globalStateRefs);
  const emitter = createEventEmitter();

  const persistence = createPersistenceLayer({
    prefix: PREFIX,
    validator: { coerceToType },
    kvStore,
  });

  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

  let _currentToken: string | null = null;

  function persistToStorage(key: string, value: any) {
    const persisted = deepClone(value);
    normalizeNumbersDeepInPlace(persisted, 6);
    return persistence.saveToStorage(key, persisted);
  }

  function debouncedSave(key: string) {
    if (saveTimers.has(key)) {
      clearTimeout(saveTimers.get(key)!);
    }

    saveTimers.set(
      key,
      setTimeout(async () => {
        saveTimers.delete(key);
        const value = getStateValue(stateMapping, key);
        if (value !== undefined) {
          const result = await persistToStorage(key, value);
          if (!result.success) {
            logStorage.error("debouncedSave.error", {
              message: "debounced save failed",
              key,
              error: result.error,
            });
          }
        }
      }, SAVE_DELAY),
    );
  }

  return {
    setToken(token) {
      if (_currentToken === token) {
        logStorage.debug("setToken.skip", { message: "token unchanged" });
        return this;
      }
      _currentToken = token;
      logStorage.info("setToken.set", {
        message: "storage token updated",
        hasToken: !!token,
      });
      persistence.setToken(token);
      return this;
    },

    getToken() {
      return _currentToken || persistence.getToken();
    },

    get(key) {
      const value = getStateValue(stateMapping, key);
      logStorage.debug("get.fresh", {
        message: "value retrieved",
        key,
        found: value !== undefined,
      });
      return value !== undefined ? deepClone(value) : undefined;
    },

    set(
      key,
      value,
      options: {
        silent?: boolean;
        skipStorage?: boolean;
        immediate?: boolean;
      } = {},
    ) {
      const {
        silent = false,
        skipStorage = false,
        immediate = false,
      } = options;

      const prevValue = getStateValue(stateMapping, key);
      if (isEqual(prevValue, value)) {
        logStorage.debug("set.skip", { message: "value unchanged", key });
        return this;
      }

      setStateValue(stateMapping, key, value);

      if (!silent) {
        emitter.emit(key, deepClone(value));
      }

      if (!skipStorage) {
        if (immediate) {
          // Fire-and-forget async save
          void persistToStorage(key, value).then((result) => {
            if (result.success) {
              logStorage.info("set.immediate", {
                message: "value persisted",
                key,
              });
            } else {
              logStorage.error("set.immediateError", {
                message: "immediate persistence failed",
                key,
                error: result.error,
              });
            }
          });
        } else {
          debouncedSave(key);
          logStorage.debug("set.debounced", {
            message: "value scheduled for save",
            key,
          });
        }
      } else {
        logStorage.debug("set.memory", {
          message: "value updated (no persistence)",
          key,
        });
      }

      return this;
    },

    update(
      key,
      updater,
      options: {
        silent?: boolean;
        skipStorage?: boolean;
        immediate?: boolean;
      } = {},
    ) {
      if (typeof updater !== "function") {
        throw new TypeError("updater must be a function");
      }

      const currentValue = getStateValue(stateMapping, key);
      const clonedValue = deepClone(currentValue);
      const newValue = updater(clonedValue);

      const changed = !isEqual(currentValue, newValue);
      logStorage.debug("update.apply", {
        message: "updater function applied",
        key,
        changed,
      });
      return this.set(key, newValue, options);
    },

    subscribe(key, callback) {
      if (typeof callback !== "function") {
        throw new TypeError("callback must be a function");
      }
      return emitter.subscribe(key, callback);
    },

    saveItem(key) {
      const value = getStateValue(stateMapping, key);
      if (value === undefined) {
        logStorage.error("saveItem.missing", {
          message: "cannot save undefined value",
          key,
        });
        return false;
      }

      // Fire-and-forget async save
      void persistToStorage(key, value).then((result) => {
        if (result.success) {
          logStorage.debug("saveItem.success", { message: "item saved", key });
        } else {
          logStorage.error("saveItem.error", {
            message: "failed to save item",
            key,
            error: result.error,
          });
        }
      });

      return true;
    },

    async loadItem(key) {
      const loadSpan = logStorage.span("loadItem", {
        message: `loading ${key}`,
      });
      const result = await persistence.loadFromStorage(key);

      if (result.success && result.value !== undefined) {
        setStateValue(stateMapping, key, result.value);
        emitter.emit(key, deepClone(result.value));
        loadSpan.end("item loaded", { key }, "debug");
      } else {
        loadSpan.end("item load failed", { key, error: result.error }, "error");
      }

      return result.success;
    },

    async loadAll() {
      const loadAllSpan = logStorage.span("loadAll", {
        message: "loading all storage items",
      });

      if (!persistence.getToken()) {
        logStorage.error("loadAll.noToken", {
          message: "no token set, cannot load",
        });
        loadAllSpan.end("aborted - no token", null, "error");
        return false;
      }

      let success = true;
      let dataStale = false;
      let criticalMissing = false;
      const missingKeys: string[] = [];

      // Batch-load all keys in a single IDB transaction instead of
      // sequential per-key awaits (6 keys × separate txn → 1 txn).
      const allKeys = getStorageKeys();
      const batchResults = await persistence.loadMultiple(allKeys);

      for (const key of allKeys) {
        const result = batchResults.get(key);
        if (!result || !result.success) {
          success = false;
          missingKeys.push(key);
          const keyConfig = STORAGE_CONFIG[key];
          if (keyConfig?.important) {
            criticalMissing = true;
            logStorage.error("loadAll.criticalMissing", {
              message: "critical key missing",
              key,
            });
          }
        } else if (result.value !== undefined) {
          setStateValue(stateMapping, key, result.value);
        }
      }

      // Check freshness after all values are loaded
      const lastUpdateResult = batchResults.get("lastUpdate");
      if (lastUpdateResult?.success && lastUpdateResult.value) {
        const lastUpdate = new Date(lastUpdateResult.value);
        const now = new Date();
        const hoursSinceUpdate =
          (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate > 24) {
          dataStale = true;
          logStorage.info("loadAll.stale", {
            message: "data is stale",
            hoursSinceUpdate: hoursSinceUpdate.toFixed(1),
          });
        }
      }

      loadAllSpan.end(
        success ? "ok" : "error",
        {
          success,
          dataStale,
          criticalMissing,
          loadedCount: allKeys.length - missingKeys.length,
          missingCount: missingKeys.length,
        },
        success ? "info" : "error",
      );

      return { success, dataStale, criticalMissing, missingKeys };
    },

    async saveAll() {
      const saveAllSpan = logStorage.span("saveAll", {
        message: "saving all storage items",
      });

      if (!persistence.getToken()) {
        logStorage.error("saveAll.noToken", {
          message: "no token set, cannot save",
        });
        saveAllSpan.end("aborted - no token", null, "error");
        return false;
      }

      let success = true;
      let savedCount = 0;
      const failedKeys: string[] = [];

      for (const key of getStorageKeys()) {
        const value = getStateValue(stateMapping, key);
        if (value !== undefined) {
          const result = await persistToStorage(key, value);
          if (result.success) {
            savedCount++;
          } else {
            success = false;
            failedKeys.push(key);
          }
        }
      }

      saveAllSpan.end(
        success ? "ok" : "error",
        { savedCount, failedCount: failedKeys.length, failedKeys },
        success ? "info" : "error",
      );

      return success;
    },

    async clearStorage() {
      const clearSpan = logStorage.span("clearStorage", {
        message: "clearing all storage",
      });

      if (!persistence.getToken()) {
        logStorage.error("clearStorage.noToken", {
          message: "no token set, cannot clear",
        });
        clearSpan.end("aborted - no token", null, "error");
        return false;
      }

      const result = await persistence.clearStorage();
      if (result.success) {
        for (const [key, config] of Object.entries(STORAGE_CONFIG)) {
          setStateValue(stateMapping, key, config.default);
        }
        saveTimers.forEach((timer) => clearTimeout(timer));
        saveTimers.clear();
        clearSpan.end("ok", null, "info");
      } else {
        clearSpan.end("clear failed", { error: result.error }, "error");
      }

      return result.success;
    },

    resetState() {
      logStorage.info("resetState.start", {
        message: "resetting all state to defaults",
      });
      for (const [key, config] of Object.entries(STORAGE_CONFIG)) {
        setStateValue(stateMapping, key, config.default);
      }
      logStorage.info("resetState.done", {
        message: "state reset complete",
        keyCount: Object.keys(STORAGE_CONFIG).length,
      });
      return this;
    },

    logger: logStorage,
  };
}
