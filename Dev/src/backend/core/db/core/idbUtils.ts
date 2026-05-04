export function txPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new DOMException("Transaction aborted", "AbortError"));
  });
}

/** Single-op read transaction. The callback returns the IDBRequest to await. */
export function readTx<T>(
  db: IDBDatabase,
  storeName: string,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const tx = db.transaction(storeName, "readonly");
  return txPromise(fn(tx.objectStore(storeName)));
}

/** Write transaction with no return value. The callback queues ops on the store. */
export async function writeTx(
  db: IDBDatabase,
  storeName: string,
  fn: (store: IDBObjectStore) => void | Promise<void>,
): Promise<void> {
  const tx = db.transaction(storeName, "readwrite");
  await fn(tx.objectStore(storeName));
  await txComplete(tx);
}

/** Write transaction returning a value (e.g. read-then-write). */
export async function writeTxResult<T>(
  db: IDBDatabase,
  storeName: string,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const tx = db.transaction(storeName, "readwrite");
  const result = await fn(tx.objectStore(storeName));
  await txComplete(tx);
  return result;
}
