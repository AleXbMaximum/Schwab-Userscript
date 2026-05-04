/**
 * Generic typed event bus with optional replay support.
 * Domain-agnostic — parameterize with your own event map.
 */

export type TypedEventBus<Events extends Record<string, unknown>> = {
  on<K extends keyof Events>(
    event: K,
    cb: (data: Events[K]) => void,
    options?: { replay?: boolean },
  ): () => void;
  emit<K extends keyof Events>(event: K, data: Events[K]): void;
  off<K extends keyof Events>(event: K, cb: (data: Events[K]) => void): void;
  getLatest<K extends keyof Events>(event: K): Events[K] | undefined;
  clear(): void;
};

export function createEventBus<
  Events extends Record<string, unknown>,
>(): TypedEventBus<Events> {
  const listeners = new Map<keyof Events, Set<(data: any) => void>>();
  const latestValues = new Map<keyof Events, unknown>();

  return {
    on(event, cb, options) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(cb);

      if (options?.replay && latestValues.has(event)) {
        try {
          cb(latestValues.get(event) as any);
        } catch {
          // Swallow replay errors — caller is responsible for its own error handling.
        }
      }

      return () => {
        set!.delete(cb);
        if (set!.size === 0) listeners.delete(event);
      };
    },

    emit(event, data) {
      latestValues.set(event, data);
      const set = listeners.get(event);
      if (!set) return;
      for (const cb of set) {
        try {
          cb(data);
        } catch {
          // Listeners must not throw into the emitter loop.
        }
      }
    },

    off(event, cb) {
      const set = listeners.get(event);
      if (!set) return;
      set.delete(cb);
      if (set.size === 0) listeners.delete(event);
    },

    getLatest(event) {
      return latestValues.get(event) as any;
    },

    clear() {
      listeners.clear();
      latestValues.clear();
    },
  };
}
