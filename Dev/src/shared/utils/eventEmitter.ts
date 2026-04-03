import { logService } from "../log/core/LogService";

const log = logService.namespace("storage");

export function createEventEmitter() {
  const listeners = new Map();

  return {
    subscribe(key, callback) {
      if (!key || typeof callback !== "function") {
        throw new TypeError("subscribe requires a key and callback function");
      }

      if (!listeners.has(key)) {
        listeners.set(key, new Set());
      }

      listeners.get(key).add(callback);

      return () => {
        const keyListeners = listeners.get(key);
        if (keyListeners) {
          keyListeners.delete(callback);
          if (keyListeners.size === 0) {
            listeners.delete(key);
          }
        }
      };
    },

    emit(key, value) {
      if (listeners.has(key)) {
        listeners.get(key).forEach((callback) => {
          try {
            callback(value);
          } catch (error) {
            log.error("storage.eventEmitter.listenerError", {
              key,
              message: error?.message || String(error),
              stack: error?.stack,
            });
          }
        });
      }

      if (listeners.has("*")) {
        listeners.get("*").forEach((callback) => {
          try {
            callback({ key, value });
          } catch (error) {
            log.error("storage.eventEmitter.globalListenerError", {
              key,
              message: error?.message || String(error),
              stack: error?.stack,
            });
          }
        });
      }
    },

    unsubscribe(key, callback) {
      const keyListeners = listeners.get(key);
      if (!keyListeners) return false;

      const removed = keyListeners.delete(callback);
      if (keyListeners.size === 0) {
        listeners.delete(key);
      }

      return removed;
    },

    clear(key) {
      if (key) {
        listeners.delete(key);
      } else {
        listeners.clear();
      }
    },

    listenerCount(key) {
      return listeners.get(key)?.size ?? 0;
    },

    getStats() {
      let totalListeners = 0;
      const keys = [];

      for (const [key, keyListeners] of listeners.entries()) {
        keys.push(key);
        totalListeners += keyListeners.size;
      }

      return {
        totalKeys: listeners.size,
        totalListeners,
        keys,
      };
    },
  };
}
