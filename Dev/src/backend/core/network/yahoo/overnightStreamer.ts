import { logService } from "shared/log/core/LogService";

const log = logService.namespace("streamer");

// ── Yahoo Finance WebSocket protobuf schema ─────────────────────────────────
// Endpoint: wss://streamer.finance.yahoo.com/?version=2
// Subscribe: {"subscribe": ["NVDA", ...]}
// Message:  {"type":"pricing","message":"<base64-protobuf>"}
//
// Decoded fields:
//   1 (string)  id            — ticker symbol
//   2 (float32) price         — current price
//   5 (string)  exchange      — e.g. "NMS", "NYQ"
//   6 (varint)  quoteType     — 8 = EQUITY
//   7 (varint)  marketHours   — see MarketHours enum below
//   8 (float32) changePercent — % change from close (percentage-point form)
//  12 (float32) change        — $ change from close
//  27 (varint)  priceHint     — decimal precision hint
// Fields not decoded (skipped by skipField): 3 (time/sint64 — JS int safety; we use
// the receive-side wall clock downstream), 5/6/27 (don't influence routing).

/** Yahoo's `marketHours` enum on field 7. */
const MarketHours = {
  PRE: 1,
  REGULAR: 2,
  POST: 3,
  EXTENDED: 4,
} as const;

export type OvernightPriceUpdate = {
  symbol: string;
  price: number;
  change: number;
  /** Ratio form (÷100), matching Schwab convention */
  changePercent: number;
  marketHours: number;
};

export type OvernightListener = (updates: OvernightPriceUpdate[]) => void;

const WS_ENDPOINT = "wss://streamer.finance.yahoo.com/?version=2";
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;

/** Market-hours values that represent overnight / extended trading */
const OVERNIGHT_MARKET_HOURS = new Set<number>([
  MarketHours.POST,
  MarketHours.EXTENDED,
]);

// ── Protobuf primitives (no external dependency) ────────────────────────────

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let result = 0;
  let shift = 0;
  while (pos < buf.length) {
    const b = buf[pos++];
    result |= (b & 0x7f) << shift;
    shift += 7;
    if ((b & 0x80) === 0) break;
    if (shift >= 35) {
      // Large varint — consume remaining continuation bytes, keep lower bits
      while (pos < buf.length && (buf[pos++] & 0x80) !== 0) {
        /* skip */
      }
      break;
    }
  }
  return [result >>> 0, pos];
}

function readFloat32(buf: Uint8Array, pos: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset + pos, 4);
  return view.getFloat32(0, true); // little-endian
}

function skipField(buf: Uint8Array, pos: number, wireType: number): number {
  switch (wireType) {
    case 0: {
      // varint
      while (pos < buf.length && (buf[pos++] & 0x80) !== 0) {
        /* skip */
      }
      return pos;
    }
    case 1:
      return pos + 8; // 64-bit
    case 2: {
      // length-delimited
      const [len, p] = readVarint(buf, pos);
      return p + len;
    }
    case 5:
      return pos + 4; // 32-bit
    default:
      return buf.length; // unknown — bail
  }
}

type DecodedMessage = {
  id: string;
  price: number;
  marketHours: number;
  changePercent: number;
  change: number;
};

function decodeYahooPricing(b64: string): DecodedMessage | null {
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(b64);
  } catch {
    return null;
  }

  let id = "";
  let price = NaN;
  let marketHours = 0;
  let changePercent = NaN;
  let change = NaN;

  let pos = 0;
  while (pos < bytes.length) {
    const [tag, tagEnd] = readVarint(bytes, pos);
    pos = tagEnd;
    const fieldNum = tag >>> 3;
    const wireType = tag & 0x07;

    switch (fieldNum) {
      case 1: // id (string)
        if (wireType === 2) {
          const [len, p] = readVarint(bytes, pos);
          pos = p;
          id = new TextDecoder().decode(bytes.subarray(pos, pos + len));
          pos += len;
        } else {
          pos = skipField(bytes, pos, wireType);
        }
        break;
      case 2: // price (float32)
        if (wireType === 5) {
          price = readFloat32(bytes, pos);
          pos += 4;
        } else {
          pos = skipField(bytes, pos, wireType);
        }
        break;
      case 7: // marketHours (varint)
        if (wireType === 0) {
          const [v, p] = readVarint(bytes, pos);
          pos = p;
          marketHours = v;
        } else {
          pos = skipField(bytes, pos, wireType);
        }
        break;
      case 8: // changePercent (float32)
        if (wireType === 5) {
          changePercent = readFloat32(bytes, pos);
          pos += 4;
        } else {
          pos = skipField(bytes, pos, wireType);
        }
        break;
      case 12: // change (float32)
        if (wireType === 5) {
          change = readFloat32(bytes, pos);
          pos += 4;
        } else {
          pos = skipField(bytes, pos, wireType);
        }
        break;
      default:
        pos = skipField(bytes, pos, wireType);
        break;
    }
  }

  if (!id) return null;
  return { id, price, marketHours, changePercent, change };
}

// ── YahooOvernightStreamer ───────────────────────────────────────────────────

export class YahooOvernightStreamer {
  private socket: WebSocket | null = null;
  private subscribedSymbols = new Set<string>();
  private listeners = new Set<OvernightListener>();
  private reconnectEnabled = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;
  private visibilityHandler: (() => void) | null = null;

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    this.intentionalDisconnect = false;
    this.reconnectEnabled = true;
    // reconnectAttempt is NOT reset here so backoff accumulates across failed
    // attempts; reset happens in onopen (success) and disconnect() (teardown).
    this.clearReconnectTimer();

    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
    }

    log.info("ws.connecting", { symbols: this.subscribedSymbols.size });

    try {
      this.socket = new WebSocket(WS_ENDPOINT);
    } catch (err) {
      log.error("ws.create.fail", {
        error: (err as Error)?.message ?? String(err),
      });
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      log.info("ws.connected", { symbols: this.subscribedSymbols.size });
      if (this.subscribedSymbols.size > 0) {
        this.sendSubscribe([...this.subscribedSymbols]);
      }
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        this.handleMessage(event.data);
      } catch (e) {
        log.error("ws.message.error", {
          error: (e as Error)?.message ?? String(e),
        });
      }
    };

    this.socket.onclose = (event: CloseEvent) => {
      log.info("ws.disconnected", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        intentional: this.intentionalDisconnect,
      });
      this.socket = null;
      if (!this.intentionalDisconnect && this.reconnectEnabled) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = () => {
      log.error("ws.error");
    };

    // Visibility recovery — reconnect immediately when tab becomes visible
    if (!this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (
          document.visibilityState === "visible" &&
          this.reconnectEnabled &&
          !this.isConnected &&
          !this.intentionalDisconnect
        ) {
          log.info("ws.visibility.recover");
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
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    // No log here — socket.close() will fire onclose which logs ws.disconnected
    // with intentional=true. Avoids duplicate-event noise.
  }

  subscribe(symbols: string[]): void {
    const added = symbols.filter((s) => !this.subscribedSymbols.has(s));
    if (added.length === 0) return;
    for (const s of added) this.subscribedSymbols.add(s);
    log.debug("ws.subscribe", {
      requested: symbols.length,
      added: added.length,
      connected: this.isConnected,
      total: this.subscribedSymbols.size,
    });
    if (this.isConnected) this.sendSubscribe(added);
  }

  unsubscribe(symbols: string[]): void {
    const removed = symbols.filter((s) => this.subscribedSymbols.has(s));
    if (removed.length === 0) return;
    for (const s of removed) this.subscribedSymbols.delete(s);
    if (this.isConnected) {
      this.socket!.send(JSON.stringify({ unsubscribe: removed }));
    }
  }

  addListener(cb: OvernightListener): void {
    this.listeners.add(cb);
  }
  removeListener(cb: OvernightListener): void {
    this.listeners.delete(cb);
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private handleMessage(data: unknown): void {
    if (typeof data !== "string") return;

    let parsed: { type?: string; message?: string };
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    if (parsed.type !== "pricing" || !parsed.message) return;

    const decoded = decodeYahooPricing(parsed.message);
    if (!decoded) return;

    // Only forward overnight / extended-hours updates
    if (!OVERNIGHT_MARKET_HOURS.has(decoded.marketHours)) return;

    if (!Number.isFinite(decoded.price)) return;

    const update: OvernightPriceUpdate = {
      symbol: decoded.id.toUpperCase(),
      price: decoded.price,
      change: Number.isFinite(decoded.change) ? decoded.change : 0,
      // Convert from percentage-point form to ratio (÷100) to match Schwab convention
      changePercent: Number.isFinite(decoded.changePercent)
        ? decoded.changePercent / 100
        : 0,
      marketHours: decoded.marketHours,
    };

    for (const listener of this.listeners) {
      try {
        listener([update]);
      } catch (e) {
        log.error("ws.listener.error", {
          error: (e as Error)?.message ?? String(e),
        });
      }
    }
  }

  private sendSubscribe(symbols: string[]): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ subscribe: symbols }));
    log.debug("ws.subscribed", { count: symbols.length });
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;
    log.info("ws.reconnecting", {
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
}
