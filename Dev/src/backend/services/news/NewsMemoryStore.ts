import type { KVStore } from "../../core/db/core/KVStore";
import { normalizeNewsSymbolTags } from "./types";
import type { UnifiedNewsItem, StoredNewsRecord } from "./types";

const KV_KEY = "news.memory";
const KV_READ_KEY = "news.readIds";
const PRUNE_DAYS = 7;

/**
 * Persists seen-news IDs in IndexedDB so we can mark new arrivals.
 * All records are stored as a single KV entry (array) for efficiency.
 *
 * Read-state is tracked separately: items stay `isNew` until the user
 * explicitly marks them as read (hover or "Mark All Read" button).
 */
export class NewsMemoryStore {
  private records: Map<string, StoredNewsRecord> = new Map();
  private readIds: Set<string> = new Set();
  private loaded = false;

  constructor(private kv: KVStore) {}

  /** Load memory from IDB (idempotent) */
  async load(): Promise<void> {
    if (this.loaded) return;
    const stored = await this.kv.get<StoredNewsRecord[]>(KV_KEY);
    if (stored) {
      for (const r of stored) this.records.set(r.id, r);
    }
    const readStored = await this.kv.get<string[]>(KV_READ_KEY);
    if (readStored) {
      for (const id of readStored) this.readIds.add(id);
    }
    this.loaded = true;
  }

  /** Mark items and persist — returns items with `isNew` set */
  async markAndPersist(items: UnifiedNewsItem[]): Promise<UnifiedNewsItem[]> {
    await this.load();
    const now = new Date().toISOString();
    const result: UnifiedNewsItem[] = [];

    for (const item of items) {
      const symbolTags = normalizeNewsSymbolTags(item.symbolTags, item.symbol);
      const normalizedItem: UnifiedNewsItem = {
        ...item,
        symbol: symbolTags[0] ?? null,
        symbolTags,
      };
      const known = this.records.has(item.id);
      const read = this.readIds.has(item.id);
      result.push({ ...normalizedItem, isNew: !read });

      if (!known) {
        this.records.set(item.id, {
          id: normalizedItem.id,
          title: normalizedItem.title,
          source: normalizedItem.source,
          sourceType: normalizedItem.sourceType,
          url: normalizedItem.url,
          publishedAt: normalizedItem.publishedAt,
          firstSeenAt: now,
          symbol: normalizedItem.symbol,
          symbolTags,
          summary: normalizedItem.summary,
          ...(normalizedItem.provider
            ? { provider: normalizedItem.provider }
            : {}),
          ...(normalizedItem.isHeadline ? { isHeadline: true } : {}),
        });
        continue;
      }

      const existing = this.records.get(item.id);
      if (!existing) continue;
      const mergedSymbols = normalizeNewsSymbolTags([
        ...normalizeNewsSymbolTags(existing.symbolTags, existing.symbol),
        ...symbolTags,
      ]);
      existing.symbol = mergedSymbols[0] ?? null;
      existing.symbolTags = mergedSymbols;
      // FJ pushes corrections / re-issues that keep the same NewsID but
      // change title / summary / time — refresh those so cold-start
      // hydration reflects the most recent revision.
      existing.title = normalizedItem.title;
      existing.summary = normalizedItem.summary;
      existing.url = normalizedItem.url;
      existing.publishedAt = normalizedItem.publishedAt;
      if (normalizedItem.provider) existing.provider = normalizedItem.provider;
      else delete existing.provider;
      if (normalizedItem.isHeadline) existing.isHeadline = true;
      else delete existing.isHeadline;
    }

    this.prune();
    await this.save();
    return result;
  }

  /**
   * Reconstruct displayable items from persisted records. Carries the
   * correct `isNew` flag based on stored read state. Returns items in
   * insertion order — callers should sort with `sortNewsItemsNewestFirst`.
   */
  getHydratedItems(): UnifiedNewsItem[] {
    const out: UnifiedNewsItem[] = [];
    for (const r of this.records.values()) {
      out.push({
        id: r.id,
        title: r.title,
        summary: r.summary ?? "",
        publishedAt: r.publishedAt,
        source: r.source,
        sourceType: r.sourceType,
        url: r.url,
        symbol: r.symbol,
        symbolTags: r.symbolTags ?? [],
        isNew: !this.readIds.has(r.id),
        ...(r.provider ? { provider: r.provider } : {}),
        ...(r.isHeadline ? { isHeadline: true } : {}),
      });
    }
    return out;
  }

  /** Mark specific items as read and persist */
  async markRead(ids: string[]): Promise<void> {
    await this.load();
    for (const id of ids) this.readIds.add(id);
    await this.saveReadIds();
  }

  /** Get set of all known IDs */
  getSeenIds(): Set<string> {
    return new Set(this.records.keys());
  }

  /** Check if a specific news item has been read */
  isNew(id: string): boolean {
    return !this.readIds.has(id);
  }

  /** Remove records older than PRUNE_DAYS */
  private prune(): void {
    const cutoff = Date.now() - PRUNE_DAYS * 24 * 60 * 60 * 1000;
    for (const [id, rec] of this.records) {
      if (new Date(rec.firstSeenAt).getTime() < cutoff) {
        this.records.delete(id);
        this.readIds.delete(id);
      }
    }
    // Prune orphaned readIds with no corresponding record
    for (const id of this.readIds) {
      if (!this.records.has(id)) this.readIds.delete(id);
    }
  }

  private async save(): Promise<void> {
    await this.kv.set(KV_KEY, Array.from(this.records.values()));
    await this.saveReadIds();
  }

  private async saveReadIds(): Promise<void> {
    await this.kv.set(KV_READ_KEY, Array.from(this.readIds));
  }
}
