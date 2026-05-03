import type { OrchestratorPhase } from "../../../shared/utils/time";
import type { SchedulerOverride } from "../../../shared/types/core";
import type { PollingScheduler } from "./PollingScheduler";
import type { StreamerBridge } from "../bridges/StreamerBridge";
import type { OvernightBridge } from "../bridges/OvernightBridge";
import { getPhaseSourceDefault, type PhaseSourceKey } from "./PhaseManager";

export type SourceOverrideManagerDeps = {
  scheduler: PollingScheduler;
  streamerBridge: StreamerBridge;
  overnightBridge: OvernightBridge;
  getAuthToken: () => string | null;
  getCustomerId: () => string | null;
  reregisterHoldings: () => void;
  reregisterQuotes: () => void;
  reregisterBalances: () => void;
};

/**
 * Manages user-driven source overrides ("forceOn"/"forceOff") on top of
 * whatever the phase-driven defaults have set. Overrides are sticky: when
 * the phase changes, any active override is re-applied via
 * applySourceOverrides(phase).
 */
export class SourceOverrideManager {
  private readonly overrides = new Map<PhaseSourceKey, SchedulerOverride>();

  constructor(private readonly deps: SourceOverrideManagerDeps) {}

  setOverride(key: PhaseSourceKey, state: SchedulerOverride): void {
    if (state === "auto") {
      this.overrides.delete(key);
    } else {
      this.overrides.set(key, state);
    }
  }

  getOverride(key: PhaseSourceKey): SchedulerOverride {
    return this.overrides.get(key) ?? "auto";
  }

  getAll(): ReadonlyMap<PhaseSourceKey, SchedulerOverride> {
    return this.overrides;
  }

  /** Re-apply every active override on top of the current phase defaults. */
  applySourceOverrides(phase: OrchestratorPhase): void {
    for (const [key, override] of this.overrides) {
      const defaultOn = getPhaseSourceDefault(phase, key);
      const wantOn = override === "forceOn";
      const wantOff = override === "forceOff";

      if (wantOn && !defaultOn) {
        this.forceSourceOn(key);
      } else if (wantOff && defaultOn) {
        this.forceSourceOff(key);
      }
      // If override aligns with default, no action needed (phase already set it)
    }
  }

  forceSourceOn(key: PhaseSourceKey): void {
    const { scheduler, streamerBridge, overnightBridge } = this.deps;
    switch (key) {
      case "holdings":
        if (scheduler.hasSource("holdings"))
          scheduler.resumeSource("holdings");
        else this.deps.reregisterHoldings();
        break;
      case "quotes":
        if (scheduler.hasSource("quotes")) scheduler.resumeSource("quotes");
        else this.deps.reregisterQuotes();
        break;
      case "balances":
        if (scheduler.hasSource("balances"))
          scheduler.resumeSource("balances");
        else this.deps.reregisterBalances();
        break;
      case "streamer":
        streamerBridge.setEnabled(true);
        streamerBridge.reconnect(
          this.deps.getAuthToken(),
          this.deps.getCustomerId(),
        );
        break;
      case "overnight":
        overnightBridge.setEnabled(true);
        break;
      // sparkline is handled by the frontend store, not here
    }
  }

  forceSourceOff(key: PhaseSourceKey): void {
    const { scheduler, streamerBridge, overnightBridge } = this.deps;
    switch (key) {
      case "holdings":
        scheduler.pauseSource("holdings");
        break;
      case "quotes":
        scheduler.pauseSource("quotes");
        break;
      case "balances":
        scheduler.pauseSource("balances");
        break;
      case "streamer":
        streamerBridge.setEnabled(false);
        streamerBridge.disconnect();
        break;
      case "overnight":
        overnightBridge.setEnabled(false);
        break;
    }
  }
}
