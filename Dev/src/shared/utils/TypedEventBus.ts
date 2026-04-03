/**
 * Generic typed event bus with optional replay support.
 * Domain-agnostic — parameterize with your own event map.
 */
export class TypedEventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<(data: any) => void>>();
  private latestValues = new Map<keyof Events, unknown>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   * If `replay` is true and the event was previously emitted,
   * the callback is invoked immediately with the last value.
   */
  on<K extends keyof Events>(
    event: K,
    cb: (data: Events[K]) => void,
    options?: { replay?: boolean },
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb);

    if (options?.replay && this.latestValues.has(event)) {
      try {
        cb(this.latestValues.get(event) as Events[K]);
      } catch {
        // Swallow replay errors — caller is responsible for its own error handling.
      }
    }

    return () => {
      set!.delete(cb);
      if (set!.size === 0) this.listeners.delete(event);
    };
  }

  /** Emit an event to all subscribers. Stores the value for replay. */
  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.latestValues.set(event, data);

    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(data);
      } catch {
        // Listeners must not throw into the emitter loop.
      }
    }
  }

  /** Remove a specific listener. */
  off<K extends keyof Events>(event: K, cb: (data: Events[K]) => void): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(cb);
    if (set.size === 0) this.listeners.delete(event);
  }

  /** Get the latest emitted value for an event (or undefined). */
  getLatest<K extends keyof Events>(event: K): Events[K] | undefined {
    return this.latestValues.get(event) as Events[K] | undefined;
  }

  /** Remove all listeners and stored values. */
  clear(): void {
    this.listeners.clear();
    this.latestValues.clear();
  }
}
