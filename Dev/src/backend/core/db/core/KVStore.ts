import { STORES } from "./AlexQuantDB";
import { txPromise, txComplete } from "./idbUtils";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("storage");

interface KVRecord {
  key: string;
  value: any;
  updatedAt: number;
}

export class KVStore {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async get<T = any>(key: string): Promise<T | undefined> {
    const tx = this.db.transaction(STORES.KV, "readonly");
    const record = await txPromise<KVRecord | undefined>(
      tx.objectStore(STORES.KV).get(key),
    );
    return record?.value as T | undefined;
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    const record: KVRecord = { key, value, updatedAt: Date.now() };
    const tx = this.db.transaction(STORES.KV, "readwrite");
    tx.objectStore(STORES.KV).put(record);
    await txComplete(tx);
    log.debug("kv.set", { key });
  }

  async delete(key: string): Promise<boolean> {
    const tx = this.db.transaction(STORES.KV, "readwrite");
    tx.objectStore(STORES.KV).delete(key);
    await txComplete(tx);
    log.debug("kv.delete", { key });
    return true;
  }

  async getAll(): Promise<Map<string, any>> {
    const tx = this.db.transaction(STORES.KV, "readonly");
    const records = await txPromise<KVRecord[]>(
      tx.objectStore(STORES.KV).getAll(),
    );
    const map = new Map<string, any>();
    for (const r of records) map.set(r.key, r.value);
    return map;
  }

  async getByPrefix(prefix: string): Promise<Map<string, any>> {
    const tx = this.db.transaction(STORES.KV, "readonly");
    const range = IDBKeyRange.bound(prefix, prefix + "\uffff");
    const records = await txPromise<KVRecord[]>(
      tx.objectStore(STORES.KV).getAll(range),
    );
    const map = new Map<string, any>();
    for (const r of records) map.set(r.key, r.value);
    return map;
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const tx = this.db.transaction(STORES.KV, "readwrite");
    const store = tx.objectStore(STORES.KV);
    const range = IDBKeyRange.bound(prefix, prefix + "\uffff");
    const keys = await txPromise<IDBValidKey[]>(store.getAllKeys(range));
    for (const key of keys) store.delete(key);
    await txComplete(tx);
    log.debug("kv.deleteByPrefix", { prefix, deletedCount: keys.length });
    return keys.length;
  }

  async has(key: string): Promise<boolean> {
    const tx = this.db.transaction(STORES.KV, "readonly");
    const count = await txPromise<number>(tx.objectStore(STORES.KV).count(key));
    return count > 0;
  }
}
