import { logService } from "shared/log/core/LogService";
import {
  CentrifugoClient,
  type CentrifugoPublication,
} from "./centrifugoClient";
import { fetchFinancialJuiceCredentials } from "./tokenFetcher";
import { detectFjProvider } from "./providerDetect";
import {
  generateNewsId,
  sortNewsItemsNewestFirst,
} from "../../../services/news/types";
import type { UnifiedNewsItem } from "../../../services/news/types";
import { htmlToPlainText } from "../../../services/news/newsFetchers";

const log = logService.namespace("network");

// Subscribe to every channel the JWT's `subs` claim grants — the token
// embeds the authoritative list, so we don't need to guess room IDs.
// `feed:lite` alone matches the RSS content set; the room channels
// (`feed:lite_rid:*`) expose finer-grained topic streams.
const FALLBACK_CHANNELS = ["feed:lite"];
const BUFFER_LIMIT = 200;
const EMIT_DEBOUNCE_MS = 500;

export type FinancialJuiceStreamerListener = (
  items: UnifiedNewsItem[],
) => void;

export class FinancialJuiceStreamer {
  private client: CentrifugoClient | null = null;
  private listeners = new Set<FinancialJuiceStreamerListener>();
  private buffer = new Map<string, UnifiedNewsItem>();
  private starting: Promise<void> | null = null;
  private started = false;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;

  /**
   * Bootstrap the stream: fetch a token from FJ home, open the websocket,
   * subscribe to feed:lite. Idempotent — repeated calls await the same
   * boot promise.
   */
  start(): Promise<void> {
    if (this.starting) return this.starting;
    if (this.started) return Promise.resolve();
    this.starting = this.bootstrap().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  stop(): void {
    this.started = false;
    this.connected = false;
    this.client?.disconnect();
    this.client = null;
    if (this.emitTimer !== null) {
      clearTimeout(this.emitTimer);
      this.emitTimer = null;
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }

  /** Current buffered items, newest first. Used as the fetch-time snapshot. */
  getItems(): UnifiedNewsItem[] {
    return sortNewsItemsNewestFirst(Array.from(this.buffer.values()));
  }

  addListener(cb: FinancialJuiceStreamerListener): void {
    this.listeners.add(cb);
  }
  removeListener(cb: FinancialJuiceStreamerListener): void {
    this.listeners.delete(cb);
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private async bootstrap(): Promise<void> {
    const cred = await fetchFinancialJuiceCredentials();
    if (!cred) {
      log.warn("fj.streamer.bootstrap.no_credentials");
      return;
    }
    const channels =
      cred.channels.length > 0 ? cred.channels : FALLBACK_CHANNELS;
    this.started = true;
    this.client = new CentrifugoClient({
      url: cred.url,
      token: cred.token,
      channels,
      refreshToken: async () => {
        const fresh = await fetchFinancialJuiceCredentials();
        return fresh?.token ?? null;
      },
      onPublication: (pub) => this.handlePublication(pub),
      onConnected: () => {
        this.connected = true;
        log.info("fj.streamer.connected", { channels: channels.length });
      },
      onDisconnected: ({ code, reason }) => {
        this.connected = false;
        log.info("fj.streamer.disconnected", { code, reason });
      },
    });
    this.client.connect();
  }

  private pubsReceived = 0;
  private itemsExtracted = 0;
  private rowKeysLogged = 0;

  private handlePublication(pub: CentrifugoPublication): void {
    this.pubsReceived++;
    const rawRow = peekFirstRow(pub);
    const items = mapPublicationToNewsItems(pub);
    this.itemsExtracted += items.length;
    if (this.pubsReceived <= 5) {
      log.info("fj.pub.mapped", {
        pubIndex: this.pubsReceived,
        items: items.length,
        channel: pub.channel,
        sampleTitle: items[0]?.title?.slice(0, 80) ?? null,
        sampleSource: items[0]?.source ?? null,
      });
    }
    // Dump the FULL key list of the first 3 distinct row shapes so we can
    // discover which field FJ uses to label the underlying provider
    // (Reuters / ForexLive / FT / etc). Cheap one-shot diagnostic.
    if (rawRow && this.rowKeysLogged < 3) {
      this.rowKeysLogged++;
      log.info("fj.row.keys", {
        channel: pub.channel,
        keys: Object.keys(rawRow),
      });
    }
    if (items.length === 0) return;
    for (const item of items) this.buffer.set(item.id, item);
    if (this.buffer.size > BUFFER_LIMIT) {
      // Drop oldest by publishedAt. Map insertion order ≈ arrival order, but
      // late-arriving older items would otherwise grow unbounded.
      const sorted = sortNewsItemsNewestFirst(Array.from(this.buffer.values()));
      this.buffer.clear();
      for (const it of sorted.slice(0, BUFFER_LIMIT)) {
        this.buffer.set(it.id, it);
      }
    }
    // Emit on every accepted publication, not only when the buffer GREW.
    // FJ also pushes corrections / re-issues for an existing NewsID; those
    // updates change title / summary / time but leave the id alone, so a
    // size-only gate would silently drop them and the UI would freeze.
    this.scheduleEmit();
  }

  private scheduleEmit(): void {
    if (this.emitTimer !== null) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      this.emit();
    }, EMIT_DEBOUNCE_MS);
  }

  private emit(): void {
    const snapshot = this.getItems();
    for (const cb of this.listeners) {
      try {
        cb(snapshot);
      } catch (error) {
        log.error("fj.streamer.listener.error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

// ── Publication → UnifiedNewsItem mapping ──────────────────────────────────
//
// FJ wraps every news push in a SignalR-style envelope:
//
//   pub.data = { ev: "sendUpdates", msg: "<JSON-string>", t: ... }
//
// `msg` is a *string* containing a JSON array of news objects:
//
//   [{ Title, Description, NewsID, Tags, PostedShort, PostedLong, ... }]
//
// A single publication can therefore deliver several news items at once.

type FjNewsRow = Record<string, unknown>;

/** Return the first raw row object from a publication, without mapping. */
function peekFirstRow(pub: CentrifugoPublication): FjNewsRow | null {
  if (!pub.data || typeof pub.data !== "object") return null;
  const envelope = pub.data as { msg?: unknown };
  let rows: unknown;
  if (typeof envelope.msg === "string") {
    try {
      rows = JSON.parse(envelope.msg);
    } catch {
      return null;
    }
  } else {
    rows = envelope.msg;
  }
  if (Array.isArray(rows)) {
    const first = rows[0];
    return first && typeof first === "object" && !Array.isArray(first)
      ? (first as FjNewsRow)
      : null;
  }
  if (rows && typeof rows === "object") return rows as FjNewsRow;
  return null;
}

function mapPublicationToNewsItems(
  pub: CentrifugoPublication,
): UnifiedNewsItem[] {
  if (!pub.data || typeof pub.data !== "object") return [];
  const envelope = pub.data as { ev?: unknown; msg?: unknown };

  // Resolve the inner array. `msg` is normally a JSON-encoded string, but
  // tolerate the rare case where the publisher already inlined an array.
  let rows: unknown;
  if (typeof envelope.msg === "string") {
    try {
      rows = JSON.parse(envelope.msg);
    } catch {
      return [];
    }
  } else if (Array.isArray(envelope.msg)) {
    rows = envelope.msg;
  } else if (envelope.msg && typeof envelope.msg === "object") {
    rows = [envelope.msg];
  } else {
    return [];
  }

  if (!Array.isArray(rows)) return [];

  const ev = typeof envelope.ev === "string" ? envelope.ev : "";
  const out: UnifiedNewsItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = mapFjRowToNewsItem(row as FjNewsRow, ev);
    if (item) out.push(item);
  }
  return out;
}

function mapFjRowToNewsItem(
  row: FjNewsRow,
  ev: string,
): UnifiedNewsItem | null {
  const title = pickString(row, ["Title", "title", "Headline", "headline"]);
  if (!title) return null;
  // Require a parseable upstream timestamp. Falling back to `new Date()` here
  // would regenerate "now" on any replay/reconnect remap of the same row,
  // breaking the merge-by-id cache (same bug pattern as Schwab's missing
  // dateTime field).
  const publishedAt = parsePostedAt(row);
  if (!publishedAt) return null;
  // FJ pushes raw HTML in Description (FXStreet, ZeroHedge etc. embed
  // <style> blocks); strip tags + leaked CSS before storing as summary.
  const summary = htmlToPlainText(
    pickString(row, [
      "Description",
      "description",
      "Summary",
      "summary",
      "Text",
    ]) ?? "",
  );
  const url = pickString(row, ["EURL", "Url", "url", "Link", "link"]);
  const newsId = pickIdString(row, ["NewsID", "newsId", "Id", "id"]);
  const symbolTags = extractSymbolTags(row);
  const isHeadline =
    /headline/i.test(ev) ||
    pickBool(row, ["IsHeadline", "isHeadline", "isPriority"]);
  const description = pickString(row, ["Description", "description"]);
  // Try an explicit provider field first, then fall back to URL / content
  // heuristics so we still tag the item when FJ omits the field.
  const provider =
    extractProviderLabel(row) ??
    detectFjProvider({ url, descriptionHtml: description, title });

  return {
    // Prefer FJ's stable NewsID over a hash of the title — the publisher
    // may amend a story (typos, follow-ups) while keeping the same id.
    id: newsId ? `fj_${newsId}` : generateNewsId(title, "financialjuice"),
    title,
    summary,
    publishedAt,
    // `source` stays as the aggregator. The underlying outlet — when we
    // can identify it — lives in `provider` and renders as a secondary
    // badge next to the FJ badge.
    source: "FJ",
    sourceType: "financialjuice",
    ...(provider && provider !== "FJ" && provider !== "FinancialJuice"
      ? { provider }
      : {}),
    url,
    symbol: symbolTags[0] ?? null,
    symbolTags,
    ...(isHeadline ? { isHeadline: true } : {}),
  };
}

// FJ's payload labels the underlying publisher via the `FCName` field
// (Feed Company Name) — e.g. "FXStreet", "OilPrice", "South China Morning
// Post", "Reuters". The other entries below are defensive fallbacks for
// event shapes we haven't sampled yet.
const PROVIDER_KEYS = [
  "FCName",
  "FCNameURL",
  "Datasource",
  "DataSource",
  "DataSourceName",
  "Source",
  "SourceName",
  "Provider",
  "ProviderName",
  "Vendor",
  "Publisher",
] as const;

function extractProviderLabel(row: FjNewsRow): string | undefined {
  for (const key of PROVIDER_KEYS) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
    // Some endpoints nest provider details in an object {Id, Name}.
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = v as Record<string, unknown>;
      const name = nested.Name ?? nested.name ?? nested.Title ?? nested.title;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  return undefined;
}

function pickString(
  d: FjNewsRow,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickIdString(
  d: FjNewsRow,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function pickBool(d: FjNewsRow, keys: string[]): boolean {
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "boolean") return v;
  }
  return false;
}

// FJ posts dates as a split pair: PostedLong = "13 May 2026", PostedShort
// = "04:55". Treat the combined value as UTC — the underlying squawk feed
// is London-based but published in UTC.
function parsePostedAt(d: FjNewsRow): string | null {
  const postedLong = typeof d.PostedLong === "string" ? d.PostedLong : null;
  const postedShort = typeof d.PostedShort === "string" ? d.PostedShort : null;
  if (postedLong && postedShort) {
    const ts = Date.parse(`${postedLong} ${postedShort} UTC`);
    if (Number.isFinite(ts)) return new Date(ts).toISOString();
  }
  const fallbackKeys = [
    "DatePublished",
    "datePublished",
    "PublishedAt",
    "publishedAt",
    "PostDate",
    "postDate",
    "CreatedAt",
    "createdAt",
    "Date",
    "date",
    "Timestamp",
    "timestamp",
  ];
  for (const k of fallbackKeys) {
    const v = d[k];
    if (typeof v === "string" && v) {
      const ts = Date.parse(v);
      if (Number.isFinite(ts)) return new Date(ts).toISOString();
    }
    if (typeof v === "number" && v > 0) {
      const ms = v < 1e12 ? v * 1000 : v;
      return new Date(ms).toISOString();
    }
  }
  return null;
}

function extractSymbolTags(d: FjNewsRow): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: unknown): void => {
    if (typeof raw !== "string") return;
    const value = raw.trim().toUpperCase();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };

  const rawTags = d.Tags ?? d.tags;
  if (Array.isArray(rawTags)) {
    for (const item of rawTags) {
      if (typeof item === "string") {
        push(item);
        continue;
      }
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        push(obj.Symbol ?? obj.symbol ?? obj.Name ?? obj.name ?? obj.Tag);
      }
    }
  }
  return out;
}

export const financialJuiceStreamer = new FinancialJuiceStreamer();
