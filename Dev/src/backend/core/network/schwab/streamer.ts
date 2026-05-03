import type{ StreamerListener, StreamerUpdate } from "shared/types/streamer";
import { generateUUID } from "shared/utils/data/uuid";
import { isOptionSymbol } from "shared/utils/domain/holdingsKeys";
import { logService } from "shared/log/core/LogService";
import { parseStreamerUpdate } from "./parsing/streamerParser";
import { refreshAuthToken } from "./infra/auth";
import {
  EQUITY_FIELD_MAP,
  OPTION_FIELD_MAP,
  EQUITY_FIELDS,
  OPTIONS_FIELDS,
  type StreamerMessage,
  type StreamerResponse,
  type StreamerDataGroup,
  type StreamerNotify,
  type SchwabRequest,
  type SchwabRequestEnvelope,
} from "./streamer/fieldMaps";

const log = logService.namespace("streamer");

function normalizeSymbols(symbols: unknown): string[] {
  return (Array.isArray(symbols) ? symbols : [])
    .map((s) => (s == null ? "" : String(s)).trim())
    .filter(Boolean);
}

class Streamer {
  private socket: WebSocket | null = null;
  public isConnected = false;
  private isLoggedIn = false;
  private requestId = 0;
  private customerId: string | null = null;
  private token: string | null = null;
  private correlId: string | null = null;
  private listeners = new Set<StreamerListener>();

  private pendingSymbols: string[] = [];

  private userSubscribedEquities = new Set<string>();
  private userSubscribedOptions = new Set<string>();
  private keepAliveSubscribed = false;
  private acctNotificationSubscribed = false;

  // ── Reconnect state ──
  private reconnectEnabled = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;
  private loginTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly RECONNECT_BASE_MS = 1_000;
  private static readonly RECONNECT_MAX_MS = 30_000;
  private static readonly LOGIN_TIMEOUT_MS = 10_000;

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (
          document.visibilityState === "visible" &&
          this.reconnectEnabled &&
          !this.isConnected
        ) {
          log.info("ws.visibility.recover", { attempt: this.reconnectAttempt });
          refreshAuthToken({ force: true })
            .then((freshToken) => {
              this.token = freshToken;
              this.scheduleReconnect(true);
            })
            .catch(() => {
              this.scheduleReconnect(true);
            });
        }
      });
    }
  }

  /** Update the cached auth token without reconnecting. */
  updateToken(token: string | null): void {
    if (token && token !== this.token) {
      log.debug("ws.token.updated");
      this.token = token;
    }
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.reconnectEnabled = false;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.clearLoginTimer();
    if (this.socket) {
      if (this.isLoggedIn) {
        this.send({
          service: "ADMIN",
          requestid: this.nextRequestId(),
          command: "LOGOUT",
          SchwabClientCustomerId: this.customerId,
          SchwabClientCorrelId: this.correlId,
        });
      }
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.isLoggedIn = false;
  }

  connect(token: string | null, customerId: string | null): void {
    const wasAutoReconnecting = this.reconnectAttempt > 0;

    this.token = token;
    this.customerId = customerId;
    this.correlId = generateUUID();
    this.requestId = 0;
    this.intentionalDisconnect = false;
    this.reconnectEnabled = true;
    this.clearReconnectTimer();

    if (!wasAutoReconnecting) {
      this.userSubscribedEquities.clear();
      this.userSubscribedOptions.clear();
      this.pendingSymbols = [];
    }
    this.keepAliveSubscribed = false;
    this.acctNotificationSubscribed = false;

    if (this.socket) {
      this.socket.close();
    }

    // Create WebSocket outside Angular's Zone to prevent change detection
    // on every incoming message (~1/sec during market hours).
    const Z = (globalThis as Record<string, unknown>).Zone as
      | { root: { run: <T>(fn: () => T) => T } }
      | undefined;
    const root = Z?.root ?? null;
    const initSocket = () => {
      this.socket = new WebSocket("wss://streamer.schwab.com/ws");

      this.socket.onopen = () => {
        log.info("ws.connected");
        this.isConnected = true;
        this.reconnectAttempt = 0;
        this.login();
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(String(event.data)) as StreamerMessage;
          this.handleMessage(message);
        } catch (e) {
          log.error("ws.parse.error", { error: (e as Error)?.message ?? String(e) });
        }
      };

      this.socket.onclose = () => {
        log.info("ws.disconnected", { intentional: this.intentionalDisconnect });
        this.isConnected = false;
        this.isLoggedIn = false;
        this.socket = null;
        if (!this.intentionalDisconnect && this.reconnectEnabled) {
          this.scheduleReconnect(false);
        }
      };

      this.socket.onerror = (err) => {
        log.error("ws.error", { error: String(err) });
      };
    };
    root ? root.run(initSocket) : initSocket();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(immediate: boolean): void {
    this.clearReconnectTimer();
    if (!this.reconnectEnabled || this.intentionalDisconnect) return;

    const delayMs = immediate
      ? 0
      : Math.min(
          Streamer.RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
          Streamer.RECONNECT_MAX_MS,
        );
    this.reconnectAttempt++;
    log.info("ws.reconnect.scheduled", { attempt: this.reconnectAttempt, delayMs });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (
        !this.reconnectEnabled ||
        this.intentionalDisconnect ||
        this.isConnected
      )
        return;
      log.info("ws.reconnecting", { attempt: this.reconnectAttempt });
      this.connect(this.token, this.customerId);
    }, delayMs);
  }

  /** Re-subscribe all previously subscribed symbols after a reconnect login. */
  private resubscribeAll(): void {
    const equities = [...this.userSubscribedEquities];
    const options = [...this.userSubscribedOptions];
    // Clear sets so subscribe() treats them as new
    this.userSubscribedEquities.clear();
    this.userSubscribedOptions.clear();
    const allSymbols = [...equities, ...options];
    if (allSymbols.length > 0) {
      log.info("ws.resubscribe.all", {
        equities: equities.length,
        options: options.length,
      });
      this.subscribe(allSymbols);
    }
  }

  private clearLoginTimer(): void {
    if (this.loginTimer !== null) {
      clearTimeout(this.loginTimer);
      this.loginTimer = null;
    }
  }

  private login(): void {
    this.clearLoginTimer();
    const request: SchwabRequest = {
      service: "ADMIN",
      command: "LOGIN",
      requestid: this.nextRequestId(),
      SchwabClientCustomerId: this.customerId,
      SchwabClientCorrelId: this.correlId,
      parameters: {
        Authorization: this.token,
        SchwabClientChannel: "IO",
        SchwabClientFunctionId: "ups-streamer",
      },
    };
    this.send(request);

    // If the server doesn't respond within LOGIN_TIMEOUT_MS, close the
    // socket so the onclose handler triggers a reconnect cycle.
    this.loginTimer = setTimeout(() => {
      this.loginTimer = null;
      if (this.isConnected && !this.isLoggedIn) {
        log.warn("ws.login.timeout", { attempt: this.reconnectAttempt });
        this.socket?.close();
      }
    }, Streamer.LOGIN_TIMEOUT_MS);
  }

  subscribe(symbols: unknown): void {
    if (!this.isLoggedIn) {
      const normalized = normalizeSymbols(symbols);
      this.pendingSymbols.push(...normalized);
      return;
    }

    const nextSymbols = normalizeSymbols(symbols);
    if (nextSymbols.length === 0) return;

    const optionSymbols = nextSymbols.filter(isOptionSymbol);
    const equitySymbols = nextSymbols.filter((s) => !isOptionSymbol(s));

    const newEquities = equitySymbols.filter(
      (s) => !this.userSubscribedEquities.has(s),
    );
    const newOptions = optionSymbols.filter(
      (s) => !this.userSubscribedOptions.has(s),
    );
    if (newEquities.length === 0 && newOptions.length === 0) {
      return;
    }

    // Capture before adding: empty set means first-time SUBS; non-empty means ADD.
    const equityCommand = this.userSubscribedEquities.size === 0 ? "SUBS" : "ADD";
    const optionCommand = this.userSubscribedOptions.size === 0 ? "SUBS" : "ADD";

    newEquities.forEach((s) => this.userSubscribedEquities.add(s));
    newOptions.forEach((s) => this.userSubscribedOptions.add(s));

    const requests: SchwabRequest[] = [];
    if (newEquities.length > 0) {
      requests.push({
        service: "LEVELONE_EQUITIES",
        requestid: this.nextRequestId(),
        command: equityCommand,
        SchwabClientCustomerId: this.customerId,
        SchwabClientCorrelId: this.correlId,
        parameters: {
          keys: newEquities.join(","),
          fields: EQUITY_FIELDS,
        },
      });
    }

    if (newOptions.length > 0) {
      requests.push({
        service: "LEVELONE_OPTIONS",
        requestid: this.nextRequestId(),
        command: optionCommand,
        SchwabClientCustomerId: this.customerId,
        SchwabClientCorrelId: this.correlId,
        parameters: {
          keys: newOptions.join(","),
          fields: OPTIONS_FIELDS,
        },
      });
    }

    log.debug("ws.subscribe", {
      equities: newEquities.length,
      equityCmd: equityCommand,
      options: newOptions.length,
      optionCmd: optionCommand,
    });
    this.send({ requests });
  }

  private bootstrapSubscriptions(): void {
    this.subscribeKeepAlive();
    this.subscribeAcctNotification();
  }

  private subscribeKeepAlive(): void {
    if (this.keepAliveSubscribed) return;
    this.keepAliveSubscribed = true;
    this.send({
      requests: [
        {
          service: "LEVELONE_EQUITIES",
          requestid: this.nextRequestId(),
          command: "SUBS",
          SchwabClientCustomerId: this.customerId,
          SchwabClientCorrelId: this.correlId,
          parameters: { keys: "KEEP_ALIVE", fields: "0" },
        },
      ],
    });
  }

  unsubscribe(symbols: unknown): void {
    if (!this.isLoggedIn) return;

    const nextSymbols = normalizeSymbols(symbols);
    if (nextSymbols.length === 0) return;

    const optionSymbols = nextSymbols.filter(isOptionSymbol);
    const equitySymbols = nextSymbols.filter((s) => !isOptionSymbol(s));

    const equitiesToRemove = equitySymbols.filter((s) =>
      this.userSubscribedEquities.has(s),
    );
    const optionsToRemove = optionSymbols.filter((s) =>
      this.userSubscribedOptions.has(s),
    );

    if (equitiesToRemove.length === 0 && optionsToRemove.length === 0) return;

    equitiesToRemove.forEach((s) => this.userSubscribedEquities.delete(s));
    optionsToRemove.forEach((s) => this.userSubscribedOptions.delete(s));

    const requests: SchwabRequest[] = [];
    if (equitiesToRemove.length > 0) {
      requests.push({
        service: "LEVELONE_EQUITIES",
        requestid: this.nextRequestId(),
        command: "UNSUBS",
        SchwabClientCustomerId: this.customerId,
        SchwabClientCorrelId: this.correlId,
        parameters: {
          keys: equitiesToRemove.join(","),
        },
      });
    }

    if (optionsToRemove.length > 0) {
      requests.push({
        service: "LEVELONE_OPTIONS",
        requestid: this.nextRequestId(),
        command: "UNSUBS",
        SchwabClientCustomerId: this.customerId,
        SchwabClientCorrelId: this.correlId,
        parameters: {
          keys: optionsToRemove.join(","),
        },
      });
    }

    this.send({ requests });
  }

  private subscribeAcctNotification(): void {
    if (this.acctNotificationSubscribed) return;
    this.acctNotificationSubscribed = true;

    this.send({
      requests: [
        {
          service: "ACCT_NOTIFICATION",
          requestid: this.nextRequestId(),
          command: "SUBS",
          SchwabClientCustomerId: this.customerId,
          SchwabClientCorrelId: this.correlId,
          parameters: { keys: "ACCT_NOTIFICATION", fields: "0,1,2,3" },
        },
      ],
    });
  }

  private nextRequestId(): number {
    return this.requestId++;
  }

  private send(data: SchwabRequest | SchwabRequestEnvelope): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      log.warn("ws.send.skipped", { readyState: this.socket?.readyState ?? null });
    }
  }

  private handleMessage(message: StreamerMessage): void {
    if (message.response) {
      this.handleResponse(message.response);
    }

    if (message.notify) {
      this.handleNotify(message.notify);
    }

    if (message.data) {
      this.handleData(message.data);
    }
  }

  private handleNotify(notifies: StreamerNotify[]): void {
    for (const n of notifies) {
      if (n.heartbeat !== undefined) {
        log.debug("ws.heartbeat");
      } else if (n.content) {
        log.error("ws.notify.error", { code: n.content.code, msg: n.content.msg });
      }
    }
  }

  private handleAcctNotification(
    items: Array<Record<string, unknown> & { key: string }>,
  ): void {
    for (const item of items) {
      const account = item["1"];
      const messageType = item["2"];
      const rawData = item["3"];
      let data: unknown = rawData;
      if (typeof rawData === "string") {
        try {
          data = JSON.parse(rawData);
        } catch {
          data = rawData;
        }
      }
      log.debug("ws.acct.notification", { account, messageType, data });
    }
  }

  private handleResponse(responses: StreamerResponse[]): void {
    for (const resp of responses) {
      if (resp.command !== "LOGIN") continue;

      this.clearLoginTimer();

      if (resp.content?.code === 0) {
        log.info("ws.login.done");
        this.isLoggedIn = true;
        this.bootstrapSubscriptions();

        // On reconnect, re-subscribe all previously active symbols
        if (
          this.reconnectAttempt > 0 ||
          this.userSubscribedEquities.size > 0 ||
          this.userSubscribedOptions.size > 0
        ) {
          this.resubscribeAll();
        }

        if (this.pendingSymbols.length > 0) {
          log.debug("ws.pending.process", {
            count: this.pendingSymbols.length,
          });
          this.subscribe(this.pendingSymbols);
          this.pendingSymbols = [];
        }
      } else {
        log.error("ws.login.fail", { response: resp });
        this.isLoggedIn = false;
        // Close the dead connection so the onclose handler triggers
        // a reconnect cycle with exponential backoff.
        this.socket?.close();
      }
    }
  }

  private handleData(groups: StreamerDataGroup[]): void {
    for (const group of groups) {
      if (group.service === "ACCT_NOTIFICATION") {
        this.handleAcctNotification(group.content ?? []);
        continue;
      }

      if (
        group.service !== "LEVELONE_EQUITIES" &&
        group.service !== "LEVELONE_OPTIONS"
      ) {
        continue;
      }

      const fieldMap =
        group.service === "LEVELONE_OPTIONS"
          ? OPTION_FIELD_MAP
          : EQUITY_FIELD_MAP;
      const content = group.content || [];
      if (content.length === 0) continue;

      const rawUpdates: StreamerUpdate[] = [];
      for (const item of content) {
        const update: StreamerUpdate = { symbol: String(item.key) };
        for (const [k, v] of Object.entries(item)) {
          const mapped = fieldMap[k];
          if (mapped) {
            update[mapped] = v;
          }
        }
        rawUpdates.push(update);
      }

      if (rawUpdates.length > 0) {
        const parsed = rawUpdates.map(parseStreamerUpdate);
        if (log.levelEnabled("debug")) {
          log.debug("ws.data", () => ({
            service: group.service,
            count: parsed.length,
            sample: parsed.slice(0, 3).map((u) => {
              const o: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(u)) {
                if (v !== undefined) o[k] = v;
              }
              return o;
            }),
          }));
        }
        this.notify(parsed);
      }
    }
  }

  addListener(callback: StreamerListener): void {
    this.listeners.add(callback);
  }

  removeListener(callback: StreamerListener): void {
    this.listeners.delete(callback);
  }

  private notify(updates: StreamerUpdate[]): void {
    this.listeners.forEach((cb) => cb(updates));
  }
}

export const streamer = new Streamer();
