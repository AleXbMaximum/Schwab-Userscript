/**
 * Generic single-channel subscription primitive.
 *
 * Canonical abstraction for the push-callback / return-unsubscribe pattern.
 * For multi-event buses, use TypedEventBus instead.
 */

export type Unsubscribe = () => void;

export class Subscribable<T> {
  private listeners = new Set<(data: T) => void>();
  private latest: T | undefined = undefined;
  private hasEmitted = false;

  /** Subscribe to updates. If data was already emitted, callback fires immediately (sync). */
  subscribe(callback: (data: T) => void): Unsubscribe {
    this.listeners.add(callback);
    if (this.hasEmitted) {
      callback(this.latest as T);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  /** Emit data to all subscribers and cache for late subscribers. */
  emit(data: T): void {
    this.latest = data;
    this.hasEmitted = true;
    for (const fn of this.listeners) {
      try {
        fn(data);
      } catch {
        /* listener must not break emitter */
      }
    }
  }

  /** Get the latest emitted value (or undefined if nothing emitted yet). */
  getLatest(): T | undefined {
    return this.latest;
  }

  get size(): number {
    return this.listeners.size;
  }

  /** Remove all subscribers and reset cached value. */
  clear(): void {
    this.listeners.clear();
    this.latest = undefined;
    this.hasEmitted = false;
  }
}
