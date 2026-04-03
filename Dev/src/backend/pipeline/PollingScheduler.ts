import type { Clock } from "../../shared/utils/Clock";
import type { Logger } from "../../shared/log/Logger";

export interface SchedulerOptions {
  enableBackpressure?: boolean;
}

export interface SchedulerSource<T> {
  key: string;
  fetcher: () => Promise<T> | T;
  intervalMs: number;
  initialDelayMs?: number;
  onUpdate?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface SourceEntry<T> {
  fetcher: () => Promise<T> | T;
  intervalMs: number;
  lastUpdated: number;
  data: T | null;
  error: unknown | null;
  nextFetchAt: number;
  isFetching: boolean;
  isPaused: boolean;
  timerId: ReturnType<typeof setTimeout> | null;
  onUpdate?: (data: T) => void;
  onError?: (error: Error) => void;
}

export class PollingScheduler {
  private sources: Map<string, SourceEntry<any>>;
  private isRunning: boolean;
  private isPaused: boolean;
  private options: { enableBackpressure: boolean };
  private clock: Clock;
  private logger: Logger;

  constructor(options: SchedulerOptions = {}, clock: Clock, logger: Logger) {
    this.sources = new Map();
    this.isRunning = false;
    this.isPaused = false;
    this.clock = clock;
    this.logger = logger;

    this.options = { enableBackpressure: options.enableBackpressure ?? true };
  }

  register<T>(source: SchedulerSource<T>): void {
    const initialDelay = Math.max(0, source.initialDelayMs ?? 0);
    const now = this.clock.now();
    const nextFetchAt = now + initialDelay;

    // Clear any existing timer before replacing the entry to prevent
    // leaked timers from causing duplicate fetch chains.
    const existing = this.sources.get(source.key);
    if (existing) this.clearTimer(existing);

    this.sources.set(source.key, {
      fetcher: source.fetcher,
      intervalMs: source.intervalMs,
      lastUpdated: 0,
      data: null,
      error: null,
      nextFetchAt,
      isFetching: false,
      isPaused: false,
      timerId: null,
      onUpdate: source.onUpdate,
      onError: source.onError,
    });

    if (this.isRunning && !this.isPaused) {
      this.scheduleSource(source.key);
    }
  }

  updateInterval(key: string, newIntervalMs: number): void {
    const source = this.sources.get(key);
    if (source) {
      source.intervalMs = newIntervalMs;
      this.clearTimer(source);
      if (this.isRunning && !this.isPaused) {
        source.nextFetchAt = this.clock.now();
        this.scheduleSource(key);
      }
    }
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;

    this.logger.info("PollingScheduler started");
    for (const [key] of this.sources) {
      this.scheduleSource(key);
    }
  }

  stop(): void {
    this.isRunning = false;
    for (const source of this.sources.values()) {
      this.clearTimer(source);
    }
    this.logger.info("PollingScheduler stopped");
  }

  pause(): void {
    this.isPaused = true;
    for (const source of this.sources.values()) {
      this.clearTimer(source);
    }
    this.logger.info("PollingScheduler paused");
  }

  resume(): void {
    if (!this.isRunning) return;
    this.isPaused = false;

    this.logger.info("PollingScheduler resumed");
    for (const [key] of this.sources) {
      this.scheduleSource(key);
    }
  }

  pauseSource(key: string): void {
    const source = this.sources.get(key);
    if (!source) return;
    source.isPaused = true;
    this.clearTimer(source);
    this.logger.info(`PollingScheduler: paused source "${key}"`);
  }

  resumeSource(key: string): void {
    const source = this.sources.get(key);
    if (!source || !source.isPaused) return;
    source.isPaused = false;
    if (this.isRunning && !this.isPaused) {
      source.nextFetchAt = this.clock.now();
      this.scheduleSource(key);
    }
    this.logger.info(`PollingScheduler: resumed source "${key}"`);
  }

  unregister(key: string): void {
    const source = this.sources.get(key);
    if (!source) return;
    this.clearTimer(source);
    this.sources.delete(key);
    this.logger.info(`PollingScheduler: unregistered source "${key}"`);
  }

  hasSource(key: string): boolean {
    return this.sources.has(key);
  }

  getData<T>(key: string): T | null {
    return (this.sources.get(key)?.data as T | null) ?? null;
  }

  hasUpdate(key: string, timestamp: number): boolean {
    const source = this.sources.get(key);
    return !!source && source.lastUpdated > timestamp;
  }

  getLastUpdated(key: string): number {
    return this.sources.get(key)?.lastUpdated || 0;
  }

  getStatus(key: string): {
    isFetching: boolean;
    error: unknown | null;
    isPaused: boolean;
  } {
    const source = this.sources.get(key);
    return source
      ? {
          isFetching: source.isFetching,
          error: source.error,
          isPaused: source.isPaused,
        }
      : { isFetching: false, error: null, isPaused: false };
  }

  private scheduleSource(key: string): void {
    const source = this.sources.get(key);
    if (!source || source.isPaused) return;

    const delay = Math.max(0, source.nextFetchAt - this.clock.now());
    this.clearTimer(source);
    source.timerId = this.clock.setTimeout(() => this.runFetch(key), delay);
  }

  private clearTimer(source: SourceEntry<any>): void {
    if (source?.timerId !== null) {
      this.clock.clearTimeout(source.timerId);
      source.timerId = null;
    }
  }

  private runFetch(key: string): void {
    if (!this.isRunning || this.isPaused) return;
    const source = this.sources.get(key);
    if (!source || source.isPaused) return;

    if (this.options.enableBackpressure && source.isFetching) {
      this.logger.warn(
        `Backpressure: skipping fetch for ${key}, already fetching`,
      );
      return;
    }

    source.isFetching = true;
    Promise.resolve(source.fetcher())
      .then((data) => {
        if (!this.isRunning) return;
        source.data = data;
        source.lastUpdated = this.clock.now();
        source.error = null;

        if (source.onUpdate) {
          try {
            source.onUpdate(data);
          } catch (err) {
            this.logger.error(`Error in onUpdate callback for ${key}:`, err);
          }
        }
      })
      .catch((err) => {
        if (!this.isRunning) return;
        this.logger.error(`Error fetching ${key}:`, err);
        source.error = err;

        if (source.onError) {
          try {
            source.onError(err as Error);
          } catch (cbErr) {
            this.logger.error(`Error in onError callback for ${key}:`, cbErr);
          }
        }
      })
      .finally(() => {
        if (!this.isRunning) return;
        source.isFetching = false;
        source.nextFetchAt = this.clock.now() + source.intervalMs;
        this.scheduleSource(key);
      });
  }
}
