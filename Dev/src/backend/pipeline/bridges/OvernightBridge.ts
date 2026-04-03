import type { Logger } from "../../../shared/log/Logger";
import type { HoldingsDataService } from "../HoldingsDataService";
import {
  YahooOvernightStreamer,
  type OvernightPriceUpdate,
} from "backend/core/network/yahoo/overnightStreamer";
import { isOvernightWindowCT } from "../../../shared/utils/time";

const SESSION_CHECK_INTERVAL_MS = 60_000; // Re-evaluate every 60 s

// Phase-aware Yahoo overnight streamer bridge for tracked equity symbols.
export class OvernightBridge {
  private readonly streamer: YahooOvernightStreamer;
  private readonly holdingsDataService: HoldingsDataService;
  private readonly logger: Logger;
  private enabled = false;
  private connected = false;
  private sessionCheckTimer: ReturnType<typeof setInterval> | null = null;
  private activeChangeCallback: ((active: boolean) => void) | null = null;

  constructor(holdingsDataService: HoldingsDataService, logger: Logger) {
    this.holdingsDataService = holdingsDataService;
    this.logger = logger;
    this.streamer = new YahooOvernightStreamer();

    this.streamer.addListener((updates: OvernightPriceUpdate[]) => {
      this.holdingsDataService.ingestOvernightUpdates(updates);
    });
  }

  /** Register a callback for overnight window entry and exit. */
  onActiveChange(cb: (active: boolean) => void): void {
    this.activeChangeCallback = cb;
  }

  setEnabled(enabled: boolean): void {
    this.logger.info("setEnabled", {
      enabled,
      wasEnabled: this.enabled,
      connected: this.connected,
    });
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;

    if (enabled) {
      this.startSessionCheck();
      this.evaluateSession(); // immediate check — connect only if inside overnight window
    } else {
      this.stopSessionCheck();
      if (this.connected) {
        this.disconnect();
      }
    }
  }

  handleSymbolDelta(delta: { added: string[]; removed: string[] }): void {
    this.logger.debug("symbolDelta", {
      enabled: this.enabled,
      connected: this.connected,
      added: delta.added.length,
      removed: delta.removed.length,
    });
    if (!this.enabled || !this.connected) {
      return;
    }

    const equityAdded = delta.added.filter(isEquitySymbol);
    const equityRemoved = delta.removed.filter(isEquitySymbol);

    if (equityRemoved.length > 0) {
      this.logger.debug("unsubOvernightSymbols", {
        count: equityRemoved.length,
      });
      this.streamer.unsubscribe(equityRemoved);
    }
    if (equityAdded.length > 0) {
      this.logger.debug("subOvernightSymbols", { count: equityAdded.length });
      this.streamer.subscribe(equityAdded);
    }
  }

  isActive(): boolean {
    return this.enabled && this.connected && this.streamer.isConnected;
  }

  private evaluateSession(): void {
    const shouldConnect = isOvernightWindowCT();
    this.logger.debug("evaluateSession", {
      shouldConnect,
      connected: this.connected,
    });

    if (shouldConnect && !this.connected) {
      this.logger.info("overnightWindowEntered");
      this.connect();
    } else if (!shouldConnect && this.connected) {
      this.logger.info("overnightWindowExited");
      this.disconnect();
    }
  }

  private startSessionCheck(): void {
    if (this.sessionCheckTimer) return;
    this.sessionCheckTimer = setInterval(
      () => this.evaluateSession(),
      SESSION_CHECK_INTERVAL_MS,
    );
  }

  private stopSessionCheck(): void {
    if (this.sessionCheckTimer) {
      clearInterval(this.sessionCheckTimer);
      this.sessionCheckTimer = null;
    }
  }

  private connect(): void {
    this.connected = true;
    this.streamer.connect();

    const allTracked = this.holdingsDataService.getTrackedSymbols();
    const symbols = allTracked.filter(isEquitySymbol);
    if (symbols.length > 0) {
      this.streamer.subscribe(symbols);
    }
    this.logger.info("connected", {
      trackedTotal: allTracked.length,
      equitySymbols: symbols.length,
    });
    this.activeChangeCallback?.(true);
  }

  private disconnect(): void {
    this.connected = false;
    this.streamer.disconnect();
    this.logger.info("disconnected");
    this.activeChangeCallback?.(false);
  }
}

/**
 * Returns true if the symbol looks like a plain equity ticker
 * (not an option contract and not an index symbol like $SPX).
 */
function isEquitySymbol(sym: string): boolean {
  // Skip index symbols ($SPX, $DJI, etc.)
  if (sym.startsWith("$")) return false;
  // Skip option symbols — they contain spaces + date+type+strike patterns
  // Example: "NVDA  260321C00180000" or compact "NVDA260321C00180000"
  if (/\d{6}[CP]\d+/.test(sym)) return false;
  return true;
}
