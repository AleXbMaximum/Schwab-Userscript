import type{ StreamerLike } from "../../../shared/types/streamer";
import type { StreamerUpdate } from "backend/core/network/types";
import type { Logger } from "../../../shared/log/Logger";
import type { HoldingsDataService } from "../HoldingsDataService";

export class StreamerBridge {
  private streamer: StreamerLike | null = null;
  private streamerListener: ((updates: StreamerUpdate[]) => void) | null = null;
  private holdingsDataService: HoldingsDataService;
  private logger: Logger;
  private enabled: boolean;

  constructor(
    holdingsDataService: HoldingsDataService,
    logger: Logger,
    enabled = true,
  ) {
    this.holdingsDataService = holdingsDataService;
    this.logger = logger;
    this.enabled = enabled;
  }

  connect(streamer: StreamerLike): void {
    this.streamer = streamer;
    if (!this.enabled) return;

    // Index symbols removed — now provided by WsJson TOS streaming.

    const initialSymbols = this.holdingsDataService.getTrackedSymbols();
    if (initialSymbols.length > 0) {
      this.logger.debug("subscribeInitialSymbols", {
        count: initialSymbols.length,
      });
      streamer.subscribe(initialSymbols);
    }

    // Remove previous listener before registering a new one to prevent
    // duplicate processing when reconnect() re-calls this method.
    if (this.streamerListener) {
      streamer.removeListener(this.streamerListener);
    }
    this.streamerListener = (updates: StreamerUpdate[]) => {
      this.holdingsDataService.ingestStreamerUpdates(updates);
    };
    streamer.addListener(this.streamerListener);
  }

  /** Disconnect without dropping the streamer reference used by reconnect(). */
  disconnect(): void {
    if (this.streamer) {
      if (this.streamerListener) {
        this.streamer.removeListener(this.streamerListener);
        this.streamerListener = null;
      }
      this.streamer.disconnect();
    }
  }

  teardown(): void {
    this.disconnect();
    this.streamer = null;
  }

  handleSymbolDelta(delta: { added: string[]; removed: string[] }): void {
    if (!this.streamer || !this.enabled) return;

    if (delta.removed.length > 0) {
      this.logger.debug("unsubscribeRemovedSymbols", {
        count: delta.removed.length,
      });
      this.streamer.unsubscribe(delta.removed);
    }
    if (delta.added.length > 0) {
      this.logger.debug("subscribeNewSymbols", { count: delta.added.length });
      this.streamer.subscribe(delta.added);
    }
  }

  subscribeSymbols(symbols: string[]): void {
    if (!this.streamer || !this.enabled || symbols.length === 0) return;
    this.streamer.subscribe(symbols);
  }

  unsubscribeSymbols(symbols: string[]): void {
    if (!this.streamer || symbols.length === 0) return;
    this.streamer.unsubscribe(symbols);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isConnected(): boolean {
    return this.streamer?.isConnected ?? false;
  }

  getStreamer(): StreamerLike | null {
    return this.streamer;
  }

  reconnect(authToken: string | null, customerId: string | null): void {
    if (!this.streamer || !this.enabled) return;
    if (!this.streamer.isConnected) {
      this.streamer.connect(authToken, customerId);
      this.connect(this.streamer);
    }
  }
}
