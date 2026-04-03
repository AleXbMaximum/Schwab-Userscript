import type { Clock } from "../../shared/utils/Clock";
import type { Logger } from "../../shared/log/Logger";
import type{ HoldingsFrame } from "../../shared/types/derived";

export type HoldingsFrameBuilderFn = () => Promise<HoldingsFrame | null>;
export type DirtyCheckFn = () => boolean;
export type DirtySubscribeFn = (onDirty: () => void) => () => void;

export class HoldingsFrameEmitter {
  private clock: Clock;
  private logger: Logger;

  private listeners = new Set<(frame: HoldingsFrame) => void>();
  private isRunning = false;
  private tickInFlight = false;
  private lastEmitTime = 0;
  private refreshIntervalMs: number;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeDirty: (() => void) | null = null;
  private hasDirtySubscription = false;
  private isDirtyFn: DirtyCheckFn | null = null;
  private buildFrameFn: HoldingsFrameBuilderFn | null = null;

  private lastFrame: HoldingsFrame | null = null;

  constructor(clock: Clock, logger: Logger, refreshIntervalMs: number) {
    this.clock = clock;
    this.logger = logger;
    this.refreshIntervalMs = refreshIntervalMs;
  }

  subscribe(callback: (frame: HoldingsFrame) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getLatestFrame(): HoldingsFrame | null {
    return this.lastFrame;
  }

  start(
    isDirty: DirtyCheckFn,
    buildFrame: HoldingsFrameBuilderFn,
    subscribeDirty?: DirtySubscribeFn,
  ): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tickInFlight = false;
    this.isDirtyFn = isDirty;
    this.buildFrameFn = buildFrame;

    if (subscribeDirty) {
      this.hasDirtySubscription = true;
      this.unsubscribeDirty = subscribeDirty(() => {
        this.scheduleTick(0);
      });
    } else {
      this.hasDirtySubscription = false;
      this.unsubscribeDirty = null;
    }

    this.logger.info("HoldingsFrameEmitter started", {
      refreshIntervalMs: this.refreshIntervalMs,
    });
    this.scheduleTick(0);
  }

  private scheduleTick(delayMs: number): void {
    if (!this.isRunning) return;
    if (this.timerId != null) {
      this.clock.clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.timerId = this.clock.setTimeout(
      () => {
        this.timerId = null;
        void this.runTick();
      },
      Math.max(0, delayMs),
    );
  }

  private async runTick(): Promise<void> {
    if (!this.isRunning || this.tickInFlight) return;
    if (!this.isDirtyFn || !this.buildFrameFn) return;
    this.tickInFlight = true;

    let nextDelayMs: number | null = null;
    try {
      const now = this.clock.now();
      const isDirtyNow = this.isDirtyFn();

      if (!isDirtyNow) {
        if (!this.hasDirtySubscription) {
          nextDelayMs = this.getFallbackPollIntervalMs();
        }
        return;
      }

      const waitMs =
        this.lastEmitTime > 0
          ? this.refreshIntervalMs - (now - this.lastEmitTime)
          : 0;
      if (waitMs > 0) {
        nextDelayMs = waitMs;
        return;
      }

      const frame = await this.buildFrameFn();
      if (!this.isRunning) return;
      if (frame) {
        this.lastEmitTime = this.clock.now();
        this.lastFrame = frame;
        this.broadcast(frame);
      }

      if (this.isDirtyFn()) {
        const elapsedSinceEmit = this.clock.now() - this.lastEmitTime;
        nextDelayMs = Math.max(0, this.refreshIntervalMs - elapsedSinceEmit);
      } else if (!this.hasDirtySubscription) {
        nextDelayMs = this.getFallbackPollIntervalMs();
      }
    } catch (error) {
      this.logger.error("Emit loop error:", error);
      if (!this.hasDirtySubscription) {
        nextDelayMs = this.getFallbackPollIntervalMs();
      }
    } finally {
      this.tickInFlight = false;
      if (this.isRunning && nextDelayMs != null) {
        this.scheduleTick(nextDelayMs);
      }
    }
  }

  private getFallbackPollIntervalMs(): number {
    const byRefreshRate = Math.max(100, Math.floor(this.refreshIntervalMs / 2));
    return Math.min(500, byRefreshRate);
  }

  stop(): void {
    this.isRunning = false;
    this.tickInFlight = false;
    if (this.timerId != null) {
      this.clock.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.unsubscribeDirty) {
      this.unsubscribeDirty();
      this.unsubscribeDirty = null;
    }
    this.hasDirtySubscription = false;
    this.isDirtyFn = null;
    this.buildFrameFn = null;
    this.logger.info("HoldingsFrameEmitter stopped");
  }

  setRefreshInterval(ms: number): void {
    this.refreshIntervalMs = ms;
    if (this.isRunning) {
      this.scheduleTick(0);
    }
  }

  private broadcast(frame: HoldingsFrame): void {
    for (const cb of this.listeners) {
      try {
        cb(frame);
      } catch (error) {
        this.logger.error("Error in frame listener:", error);
      }
    }
  }
}
