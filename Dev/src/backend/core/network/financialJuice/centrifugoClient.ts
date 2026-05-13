import { logService } from "shared/log/core/LogService";

const log = logService.namespace("streamer");

// ── Centrifugo v5 JSON wire protocol (subset) ───────────────────────────────
// Reference: https://centrifugal.dev/docs/transports/client_protocol
//
// Frames are newline-delimited JSON. Each frame is either:
//   - Command (client → server):  {id, connect|subscribe|...}
//   - Reply  (server → client):   {id, connect|subscribe|...|error}
//   - Push   (server → client):   {push: {channel, pub|join|leave|...}}
//   - Ping   (server → client):   "{}"  (literal empty object)
//   - Pong   (client → server):   "{}"  (only if ConnectResult.pong = true)
//
// Field names follow the proto schema verbatim:
//   ConnectRequest: token, name, version
//   ConnectResult:  client, ping (sec), pong, ttl, expires
//   SubscribeRequest: channel
//   SubscribeResult:  publications[], epoch, offset, recoverable
//   Publication:      data, offset, tags
//   Push:             channel, pub (Publication)

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;
const DEFAULT_PING_INTERVAL_SEC = 25;
const ACTIVITY_LOG_INTERVAL_MS = 60_000;

export type CentrifugoPublication = {
  channel: string;
  /** Raw publisher payload — opaque object, shape decided by the channel. */
  data: unknown;
  offset?: number;
  tags?: Record<string, string>;
};

export type CentrifugoClientOptions = {
  url: string;
  token: string;
  /** Channels to subscribe to on every successful connect. */
  channels: string[];
  /**
   * Called when the server rejects the current token or the connection drops
   * for an auth-related reason. Must return a fresh JWT, or null to abort.
   */
  refreshToken?: () => Promise<string | null>;
  onPublication: (pub: CentrifugoPublication) => void;
  onConnected?: () => void;
  onDisconnected?: (info: { code: number; reason: string }) => void;
};

type ConnectRequest = { token: string; name: string; version?: string };
type ConnectResult = {
  client?: string;
  version?: string;
  expires?: boolean;
  ttl?: number;
  ping?: number;
  pong?: boolean;
  /**
   * Server-side subscriptions auto-attached via the JWT `subs` claim.
   * Each entry is a SubscribeResult for that channel, possibly with
   * initial publications.
   */
  subs?: Record<string, SubscribeResult>;
};
type SubscribeRequest = { channel: string };
type SubscribeResult = {
  recoverable?: boolean;
  epoch?: string;
  offset?: number;
  publications?: PublicationFrame[];
};
type PublicationFrame = {
  data?: unknown;
  offset?: number;
  tags?: Record<string, string>;
};
type PushFrame = {
  channel?: string;
  pub?: PublicationFrame;
};
type CommandFrame = {
  id: number;
  connect?: ConnectRequest;
  subscribe?: SubscribeRequest;
};
type ReplyFrame = {
  id?: number;
  error?: { code: number; message: string };
  connect?: ConnectResult;
  subscribe?: SubscribeResult;
  push?: PushFrame;
};

export class CentrifugoClient {
  private socket: WebSocket | null = null;
  private currentToken: string;
  private nextId = 1;
  private pendingCommands = new Map<number, (reply: ReplyFrame) => void>();
  private reconnectEnabled = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;
  private clientPongRequired = false;
  private pingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private pingIntervalMs = DEFAULT_PING_INTERVAL_SEC * 1000;
  private visibilityHandler: (() => void) | null = null;
  private refreshInFlight = false;
  private samplePublicationsLogged = 0;
  private framesReceived = 0;
  private publicationsReceived = 0;
  private lastFrameAtUtcMs = 0;
  private lastPublicationAtUtcMs = 0;
  private activityTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly opts: CentrifugoClientOptions) {
    this.currentToken = opts.token;
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    this.intentionalDisconnect = false;
    this.reconnectEnabled = true;
    this.clearReconnectTimer();
    this.closeSocketQuietly();

    log.info("ws.connecting", {
      domain: this.urlHost(),
      channels: this.opts.channels.length,
    });

    try {
      this.socket = new WebSocket(this.opts.url);
    } catch (error) {
      log.error("ws.create.fail", {
        domain: this.urlHost(),
        error: error instanceof Error ? error.message : String(error),
      });
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => this.sendConnect();
    this.socket.onmessage = (event) => {
      try {
        this.handleSocketMessage(event.data);
      } catch (error) {
        log.error("ws.frame.error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    this.socket.onclose = (event) => {
      this.clearPingTimeout();
      this.clearActivityTimer();
      log.info("ws.disconnected", {
        domain: this.urlHost(),
        code: event.code,
        reason: event.reason || "(none)",
        intentional: this.intentionalDisconnect,
        frames: this.framesReceived,
        pubs: this.publicationsReceived,
      });
      this.socket = null;
      this.pendingCommands.clear();
      this.opts.onDisconnected?.({ code: event.code, reason: event.reason });
      if (!this.intentionalDisconnect && this.reconnectEnabled) {
        this.scheduleReconnect();
      }
    };
    this.socket.onerror = () => {
      log.warn("ws.error", { domain: this.urlHost() });
    };

    if (!this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (
          document.visibilityState === "visible" &&
          this.reconnectEnabled &&
          !this.isConnected &&
          !this.intentionalDisconnect
        ) {
          log.info("ws.visibility.recover", { domain: this.urlHost() });
          this.clearReconnectTimer();
          this.connect();
        }
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.reconnectEnabled = false;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.clearPingTimeout();
    this.clearActivityTimer();
    this.closeSocketQuietly();
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /** Replace the token for the next (re)connect. */
  setToken(token: string): void {
    this.currentToken = token;
  }

  // ── Internal: frame handling ────────────────────────────────────────────

  private sendConnect(): void {
    const id = this.nextId++;
    const cmd: CommandFrame = {
      id,
      connect: { token: this.currentToken, name: "userscript" },
    };
    this.pendingCommands.set(id, (reply) => this.onConnectReply(reply));
    this.sendFrame(cmd);
  }

  private onConnectReply(reply: ReplyFrame): void {
    if (reply.error) {
      log.warn("ws.connect.rejected", {
        code: reply.error.code,
        message: reply.error.message,
      });
      void this.attemptTokenRefresh();
      return;
    }
    const result = reply.connect ?? {};
    this.pingIntervalMs =
      (typeof result.ping === "number" && result.ping > 0
        ? result.ping
        : DEFAULT_PING_INTERVAL_SEC) * 1000;
    this.clientPongRequired = !!result.pong;
    this.reconnectAttempt = 0;
    const autoSubs = result.subs ?? {};
    const autoSubChannels = Object.keys(autoSubs);
    log.info("ws.connected", {
      domain: this.urlHost(),
      client: result.client,
      pingSec: result.ping,
      pong: result.pong,
      ttl: result.ttl,
      autoSubs: autoSubChannels.length,
    });
    this.opts.onConnected?.();
    this.scheduleNextPingTimeout();
    this.startActivityTimer();

    // Server-side subscriptions delivered via the JWT subs claim: replay
    // any initial publications, and don't send a redundant Subscribe (the
    // server rejects those with code 105 "already subscribed").
    let autoInitial = 0;
    for (const [channel, subResult] of Object.entries(autoSubs)) {
      const pubs = Array.isArray(subResult?.publications)
        ? subResult.publications
        : [];
      autoInitial += pubs.length;
      for (const pub of pubs) this.deliverPublication(channel, pub);
    }
    if (autoSubChannels.length > 0) {
      log.info("ws.subscribed.auto", {
        channels: autoSubChannels.length,
        initialPubs: autoInitial,
      });
    }

    for (const channel of this.opts.channels) {
      if (channel in autoSubs) continue;
      this.sendSubscribe(channel);
    }
  }

  private sendSubscribe(channel: string): void {
    const id = this.nextId++;
    const cmd: CommandFrame = { id, subscribe: { channel } };
    this.pendingCommands.set(id, (reply) =>
      this.onSubscribeReply(channel, reply),
    );
    this.sendFrame(cmd);
  }

  private onSubscribeReply(channel: string, reply: ReplyFrame): void {
    if (reply.error) {
      // Code 105 = already subscribed via the connection token. Benign:
      // the subscription is alive on the server side and publications
      // will still flow — we just shouldn't have asked.
      const benign = reply.error.code === 105;
      const level = benign ? "info" : "warn";
      log[level]("ws.subscribe.fail", {
        channel,
        code: reply.error.code,
        message: reply.error.message,
        benign,
      });
      return;
    }
    const result = reply.subscribe ?? {};
    const initial = Array.isArray(result.publications)
      ? result.publications
      : [];
    log.info("ws.subscribed", { channel, initial: initial.length });
    for (const pub of initial) {
      this.deliverPublication(channel, pub);
    }
  }

  private handleSocketMessage(raw: unknown): void {
    if (typeof raw !== "string" || !raw.length) return;
    this.lastFrameAtUtcMs = Date.now();
    this.framesReceived++;
    // Centrifugo can pack multiple frames in one WS message — newline-delimited.
    for (const line of raw.split("\n")) {
      const text = line.trim();
      if (!text) continue;
      this.handleSingleFrame(text);
    }
  }

  private handleSingleFrame(text: string): void {
    // Server ping = literal "{}". Reset ping watchdog and pong if required.
    if (text === "{}") {
      this.scheduleNextPingTimeout();
      if (this.clientPongRequired) this.sendRaw("{}");
      return;
    }
    let frame: ReplyFrame;
    try {
      frame = JSON.parse(text) as ReplyFrame;
    } catch {
      log.warn("ws.frame.parse_fail", { sample: text.slice(0, 80) });
      return;
    }
    this.scheduleNextPingTimeout();

    // Check push first — Centrifugo's JSON encoder may emit `id:0` on push
    // frames depending on version/config. Treating `id` presence as
    // "this is a command reply" would then drop every push silently.
    if (frame.push) {
      const channel = frame.push.channel ?? "";
      const pub = frame.push.pub;
      if (channel && pub) this.deliverPublication(channel, pub);
      return;
    }

    // Reply to a previous command. Centrifugo correlation ids start at 1.
    if (typeof frame.id === "number" && frame.id > 0) {
      const handler = this.pendingCommands.get(frame.id);
      if (handler) {
        this.pendingCommands.delete(frame.id);
        handler(frame);
      }
      return;
    }

    log.warn("ws.frame.unhandled", {
      keys: Object.keys(frame).slice(0, 8),
      sample: text.slice(0, 160),
    });
  }

  private deliverPublication(channel: string, pub: PublicationFrame): void {
    this.publicationsReceived++;
    this.lastPublicationAtUtcMs = Date.now();
    // Log the first few publications at info to expose the actual payload
    // shape (we don't have a public schema for FJ's pub.data). After 5
    // samples we go silent to avoid log spam.
    if (this.samplePublicationsLogged < 5) {
      this.samplePublicationsLogged++;
      const data = pub.data;
      const dataObj =
        data && typeof data === "object" && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : null;
      let preview: string;
      try {
        preview = JSON.stringify(data).slice(0, 1500);
      } catch {
        preview = "<unstringifiable>";
      }
      log.info("ws.pub.sample", {
        channel,
        dataType: typeof data,
        keys: dataObj ? Object.keys(dataObj).slice(0, 16) : null,
        offset: pub.offset,
        preview,
      });
    }
    try {
      this.opts.onPublication({
        channel,
        data: pub.data,
        offset: pub.offset,
        tags: pub.tags,
      });
    } catch (error) {
      log.error("ws.publication.handler.error", {
        channel,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ── Internal: io ────────────────────────────────────────────────────────

  private sendFrame(cmd: CommandFrame): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(cmd));
  }

  private sendRaw(text: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(text);
  }

  // ── Internal: timers ────────────────────────────────────────────────────

  private startActivityTimer(): void {
    this.clearActivityTimer();
    this.activityTimer = setInterval(() => {
      if (!this.isConnected) return;
      const now = Date.now();
      log.info("ws.activity", {
        domain: this.urlHost(),
        frames: this.framesReceived,
        pubs: this.publicationsReceived,
        sinceLastFrameSec: this.lastFrameAtUtcMs
          ? Math.round((now - this.lastFrameAtUtcMs) / 1000)
          : null,
        sinceLastPubSec: this.lastPublicationAtUtcMs
          ? Math.round((now - this.lastPublicationAtUtcMs) / 1000)
          : null,
      });
    }, ACTIVITY_LOG_INTERVAL_MS);
  }

  private clearActivityTimer(): void {
    if (this.activityTimer !== null) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
  }

  private scheduleNextPingTimeout(): void {
    this.clearPingTimeout();
    if (!this.pingIntervalMs) return;
    // 2x the server ping interval — anything quieter is considered dead.
    this.pingTimeoutTimer = setTimeout(() => {
      log.warn("ws.ping.timeout", {
        domain: this.urlHost(),
        intervalMs: this.pingIntervalMs,
      });
      this.closeSocketQuietly();
    }, this.pingIntervalMs * 2);
  }

  private clearPingTimeout(): void {
    if (this.pingTimeoutTimer !== null) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = null;
    }
  }

  private scheduleReconnect(forceDelayMs?: number): void {
    this.clearReconnectTimer();
    const delay =
      forceDelayMs ??
      Math.min(
        RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
        RECONNECT_MAX_MS,
      );
    this.reconnectAttempt++;
    log.info("ws.reconnecting", {
      domain: this.urlHost(),
      delayMs: delay,
      attempt: this.reconnectAttempt,
    });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.reconnectEnabled && !this.intentionalDisconnect) {
        this.connect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocketQuietly(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
  }

  // ── Internal: auth ──────────────────────────────────────────────────────

  private async attemptTokenRefresh(): Promise<void> {
    if (this.refreshInFlight) return;
    this.refreshInFlight = true;
    try {
      if (!this.opts.refreshToken) {
        log.warn("ws.token.refresh.unavailable", { domain: this.urlHost() });
        this.disconnect();
        return;
      }
      const fresh = await this.opts.refreshToken();
      if (!fresh) {
        log.warn("ws.token.refresh.aborted", { domain: this.urlHost() });
        this.disconnect();
        return;
      }
      this.currentToken = fresh;
      this.closeSocketQuietly();
      this.scheduleReconnect(0);
    } catch (error) {
      log.error("ws.token.refresh.error", {
        domain: this.urlHost(),
        error: error instanceof Error ? error.message : String(error),
      });
      this.disconnect();
    } finally {
      this.refreshInFlight = false;
    }
  }

  private urlHost(): string {
    try {
      return new URL(this.opts.url).host;
    } catch {
      return this.opts.url;
    }
  }
}
