import type { Logger } from "../../shared/log/Logger";
import { logService } from "../../shared/log/core/LogService";
import {
  resolveOrchestratorPhase,
  formatHourMinuteCT,
  type OrchestratorPhase,
} from "../../shared/utils/time";

const phaseLog = logService.namespace("phase");

// ── Phase boundary scheduling ─────────────────────────────────────────────

/** CT phase boundary minutes-since-midnight: 3:00, 8:30, 15:00, 19:00. */
export const PHASE_BOUNDARIES_MIN = [180, 510, 900, 1140] as const;

const PHASE_MAX_SLEEP_MS = 14_400_000; // 4-hour cap for very long gaps
const PHASE_GUARD_MS = 200; // post-boundary guard to absorb timer jitter

/**
 * Returns ms from `now` until the next phase boundary in CT.
 *
 * Minute-level precision comes from `formatHourMinuteCT` (DST-safe via Intl).
 * Sub-minute precision comes from `Date.getSeconds/getMilliseconds`
 * (timezone-independent — seconds within a minute are the same in all zones).
 *
 * Always returns a value in [PHASE_GUARD_MS, PHASE_MAX_SLEEP_MS].
 */
export function msUntilNextBoundary(now: Date): number {
  const hmStr = formatHourMinuteCT(now);
  if (!hmStr) return 60_000; // defensive fallback if Intl fails

  const [hStr, mStr] = hmStr.split(":");
  const nowMin = Number(hStr) * 60 + Number(mStr);
  const fracMs = now.getSeconds() * 1_000 + now.getMilliseconds();

  for (const b of PHASE_BOUNDARIES_MIN) {
    if (b > nowMin) {
      const ms = (b - nowMin) * 60_000 - fracMs + PHASE_GUARD_MS;
      return Math.min(Math.max(ms, PHASE_GUARD_MS), PHASE_MAX_SLEEP_MS);
    }
  }

  // Past 19:00 — next boundary is 3:00 AM next CT day
  const msToMidnight = (1440 - nowMin) * 60_000 - fracMs;
  const ms = msToMidnight + PHASE_BOUNDARIES_MIN[0] * 60_000 + PHASE_GUARD_MS;
  return Math.min(Math.max(ms, PHASE_GUARD_MS), PHASE_MAX_SLEEP_MS);
}

/**
 * Adaptive boundary-aligned scheduler.
 *
 * Replaces the flat 60-second setInterval with a self-rescheduling
 * setTimeout chain that sleeps until the next CT phase boundary.
 * Also re-evaluates on tab visibility restore to recover from
 * browser background-tab throttling.
 */
class PhaseScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private running = false;

  constructor(
    private readonly onTick: () => void,
    private readonly onLog: (msg: string, meta?: Record<string, unknown>) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.attachVisibility();
    this.arm();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.cancelTimer();
    this.detachVisibility();
  }

  private arm(): void {
    this.cancelTimer();
    const delay = msUntilNextBoundary(new Date());
    this.onLog("phaseScheduler:arm", { delayMs: delay });
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        this.onTick();
      } catch (e) {
        this.onLog("phaseScheduler:onTick threw, re-arming", {
          error: (e as Error)?.message ?? String(e),
        });
      } finally {
        if (this.running) this.arm();
      }
    }, delay);
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private attachVisibility(): void {
    if (this.visibilityHandler) return;
    this.visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        this.onLog("phaseScheduler:visibilityRestore");
        try {
          this.onTick();
        } catch (e) {
          this.onLog("phaseScheduler:visibilityTick threw", {
            error: (e as Error)?.message ?? String(e),
          });
        }
        if (this.running) this.arm();
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private detachVisibility(): void {
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}

function phaseUsesDualFetch(phase: OrchestratorPhase): boolean {
  return phase === "afterHours" || phase === "preMarket";
}

function phaseUsesStreamer(phase: OrchestratorPhase): boolean {
  return phase === "market";
}

function phaseUsesPolling(phase: OrchestratorPhase): boolean {
  return phase === "market" || phase === "afterHours" || phase === "preMarket";
}

/**
 * Static default on/off for each source in each phase.
 * Used by both PhaseManager logic and the settings panel UI.
 */
export function getPhaseSourceDefault(
  phase: OrchestratorPhase,
  sourceKey: string,
): boolean {
  switch (sourceKey) {
    case "holdings":
    case "quotes":
    case "balances":
      return phaseUsesPolling(phase);
    case "streamer":
      return phaseUsesStreamer(phase);
    case "overnight":
      return phase === "overnight";
    case "sparkline":
      return phase === "market";
    default:
      return false;
  }
}

export type PhaseSourceKey =
  | "holdings"
  | "quotes"
  | "balances"
  | "streamer"
  | "overnight"
  | "sparkline";

interface PhaseCallbacks {
  onStreamerEnable(): void;
  onStreamerDisable(): void;
  onFetchTaskSwitch(dualFetch: boolean): void;
  onPollingResume(): void;
  onPollingPauseForOvernight(): void;
  onPollingPauseForClosed(): void;
  onPhaseChange?(phase: OrchestratorPhase): void;
}

export class PhaseManager {
  private currentPhase: OrchestratorPhase = "market";
  private readonly scheduler: PhaseScheduler;
  private readonly logger: Logger;
  private readonly callbacks: PhaseCallbacks;

  constructor(logger: Logger, callbacks: PhaseCallbacks) {
    this.logger = logger;
    this.callbacks = callbacks;
    this.scheduler = new PhaseScheduler(
      () => this.evaluate(),
      (msg, meta) => phaseLog.info(msg, meta),
    );
  }

  getPhase(): OrchestratorPhase {
    return this.currentPhase;
  }

  init(skipScheduler = false): void {
    const phase = resolveOrchestratorPhase();
    this.currentPhase = phase;
    phaseLog.info("init", { phase });
    this.applyPhaseConfig(skipScheduler);
  }

  startPeriodicCheck(): void {
    this.scheduler.start();
  }

  stopPeriodicCheck(): void {
    this.scheduler.stop();
  }

  /** Whether the current phase uses the Schwab streamer. */
  usesStreamer(): boolean {
    return phaseUsesStreamer(this.currentPhase);
  }

  /** Whether the current phase uses dual holdings fetch. */
  usesDualFetch(): boolean {
    return phaseUsesDualFetch(this.currentPhase);
  }

  /** Whether the current phase needs continuous polling. */
  usesPolling(): boolean {
    return phaseUsesPolling(this.currentPhase);
  }

  private evaluate(): void {
    const next = resolveOrchestratorPhase();
    if (next !== this.currentPhase) {
      this.transition(next);
    }
  }

  private transition(next: OrchestratorPhase): void {
    const prev = this.currentPhase;
    this.currentPhase = next;
    this.logger.info("phaseTransition", { from: prev, to: next });
    phaseLog.info("transition", { from: prev, to: next });
    this.applyPhaseConfig();
    this.callbacks.onPhaseChange?.(next);
  }

  private applyPhaseConfig(skipScheduler = false): void {
    const phase = this.currentPhase;

    // Streamer lifecycle
    if (phaseUsesStreamer(phase)) {
      this.callbacks.onStreamerEnable();
    } else {
      this.callbacks.onStreamerDisable();
    }

    // Fetch task
    this.callbacks.onFetchTaskSwitch(phaseUsesDualFetch(phase));

    // Polling lifecycle (skipped during startup)
    if (!skipScheduler) {
      if (phaseUsesPolling(phase)) {
        this.callbacks.onPollingResume();
      } else if (phase === "overnight") {
        this.callbacks.onPollingPauseForOvernight();
      } else {
        this.callbacks.onPollingPauseForClosed();
      }
    }
  }
}
