import { normalizeSpanStatus } from "../spanStatus";

type LogServiceLike = {
  clock: { now(): number };
  log: (
    namespace: string,
    operation: string,
    level: string,
    metadata?: any,
    options?: any,
  ) => void;
  isLevelEnabled?: (namespace: string, level: string) => boolean;
};

interface PerfOptions {
  /** Duration threshold (ms) above which the log upgrades to 'info'. Default: 16 */
  warnThresholdMs?: number;
  /** Duration threshold (ms) above which the log upgrades to 'error'. Default: 100 */
  errorThresholdMs?: number;
}

interface ThrottleState {
  lastTime: number;
  skipped: number;
}

interface CountState {
  count: number;
  firstTime: number;
  timerId: ReturnType<typeof setTimeout> | null;
}

export class LogNamespace {
  private name: string;
  private logService: LogServiceLike;
  private throttleMap: Map<string, ThrottleState> = new Map();
  private countMap: Map<string, CountState> = new Map();

  constructor(name: string, logService: LogServiceLike) {
    this.name = name;
    this.logService = logService;
  }

  /** Check if a given level would actually produce output for this namespace. */
  levelEnabled(level: string): boolean {
    return this.logService.isLevelEnabled?.(this.name, level) ?? true;
  }

  error(operation: string, metadata: any = {}, options: any = {}) {
    this.logService.log(this.name, operation, "error", metadata, options);
  }

  warn(operation: string, metadata: any = {}, options: any = {}) {
    this.logService.log(this.name, operation, "warn", metadata, options);
  }

  info(operation: string, metadata: any = {}, options: any = {}) {
    this.logService.log(this.name, operation, "info", metadata, options);
  }

  debug(operation: string, metadata: any = {}, options: any = {}) {
    this.logService.log(this.name, operation, "debug", metadata, options);
  }

  trace(operation: string, metadata: any = {}, options: any = {}) {
    this.logService.log(this.name, operation, "debug", metadata, options);
  }

  span(operation: string, metadata: any = {}) {
    const startTime = this.logService.clock.now();
    this.debug(`${operation}.start`, metadata);

    return {
      end: (statusOrMetadata: any, metadataOrLevel: any, level = "debug") => {
        const endTime = this.logService.clock.now();
        const duration = Math.round(endTime - startTime);

        let status: any = null;
        let meta: any = {};
        let finalLevel = level;

        if (typeof statusOrMetadata === "string") {
          status = normalizeSpanStatus(statusOrMetadata) || statusOrMetadata;
          if (metadataOrLevel && typeof metadataOrLevel === "object") {
            meta = metadataOrLevel;
          }
          if (typeof metadataOrLevel === "string") {
            finalLevel = metadataOrLevel;
          } else if (typeof level === "string") {
            finalLevel = level;
          }
        } else {
          meta = statusOrMetadata || {};
          if (metadataOrLevel && typeof metadataOrLevel === "string") {
            finalLevel = metadataOrLevel;
          }
        }

        const payload: any = {
          ...meta,
          durationMs: duration,
        };

        if (status) {
          payload.status = status;
        }

        this.logService.log(
          this.name,
          `${operation}.done`,
          finalLevel,
          payload,
        );
      },
    };
  }

  /**
   * Measure an operation's duration and auto-escalate log level based on thresholds.
   * - Below warnThresholdMs: logs at 'debug'
   * - Between warn and error thresholds: logs at 'info'
   * - Above errorThresholdMs: logs at 'error'
   *
   * Usage:
   *   const done = log.perf('renderTable');
   *   // ... work ...
   *   done({ rows: 150 });
   */
  perf(operation: string, opts: PerfOptions = {}) {
    const warnMs = opts.warnThresholdMs ?? 16;
    const errorMs = opts.errorThresholdMs ?? 100;
    const startTime = this.logService.clock.now();

    return (metadata: any = {}) => {
      const duration = Math.round(this.logService.clock.now() - startTime);
      let level = "debug";
      if (duration >= errorMs) level = "error";
      else if (duration >= warnMs) level = "info";

      this.logService.log(this.name, `${operation}.perf`, level, {
        ...metadata,
        durationMs: duration,
      });
    };
  }

  /**
   * Rate-limited logging. Only emits once per intervalMs for the same operation.
   * On the next allowed log, reports how many calls were skipped.
   *
   * Usage:
   *   log.throttle('streamerTick', 2000, { price: 123.45 });
   */
  throttle(
    operation: string,
    intervalMs: number,
    metadata: any = {},
    level = "debug",
  ) {
    const now = this.logService.clock.now();
    let state = this.throttleMap.get(operation);

    if (!state) {
      state = { lastTime: 0, skipped: 0 };
      this.throttleMap.set(operation, state);
    }

    if (now - state.lastTime < intervalMs) {
      state.skipped++;
      return;
    }

    const payload =
      state.skipped > 0 ? { ...metadata, skipped: state.skipped } : metadata;
    state.lastTime = now;
    state.skipped = 0;

    this.logService.log(this.name, operation, level, payload);
  }

  /**
   * Accumulate event counts and flush a summary periodically.
   * Useful for high-frequency events where individual logs are noise.
   *
   * Usage:
   *   log.count('rowsRendered', 5000);          // flush every 5s
   *   log.count('rowsRendered', 5000, { page: 'portfolio' });
   */
  count(
    operation: string,
    flushIntervalMs = 5000,
    metadata: any = {},
    level = "debug",
  ) {
    let state = this.countMap.get(operation);

    if (!state) {
      state = {
        count: 0,
        firstTime: this.logService.clock.now(),
        timerId: null,
      };
      this.countMap.set(operation, state);
    }

    state.count++;

    if (!state.timerId) {
      state.timerId = setTimeout(() => {
        const s = this.countMap.get(operation);
        if (s && s.count > 0) {
          const elapsed = Math.round(this.logService.clock.now() - s.firstTime);
          this.logService.log(this.name, `${operation}.summary`, level, {
            ...metadata,
            count: s.count,
            windowMs: elapsed,
          });
          s.count = 0;
          s.firstTime = this.logService.clock.now();
        }
        if (s) s.timerId = null;
      }, flushIntervalMs);
    }
  }
}
