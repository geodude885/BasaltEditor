// A few promise-shaped calls over IndexedDB - the browser's storage for things too big for
// localStorage, such as songs. Small on purpose: the library needs gets, puts, deletes and listings.

export type Stores = Record<string, { keyPath?: string }>;

export class Idb {
  #db: Promise<IDBDatabase> | null = null;

  constructor(private readonly name: string, private readonly version: number, private readonly stores: Stores) {}

  #open(): Promise<IDBDatabase> {
    return this.#db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, this.version);
      req.onupgradeneeded = () => {
        for (const [store, options] of Object.entries(this.stores)) {
          if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store, options.keyPath ? { keyPath: options.keyPath } : undefined);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { this.#db = null; reject(req.error); };
    });
  }

  async #run<T>(store: string, mode: IDBTransactionMode, act: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.#open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode), req = act(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
    });
  }

  get<T>(store: string, key: IDBValidKey): Promise<T | undefined> { return this.#run(store, "readonly", s => s.get(key)); }
  all<T>(store: string, range?: IDBKeyRange): Promise<T[]> { return this.#run(store, "readonly", s => s.getAll(range)); }
  keys(store: string, range?: IDBKeyRange): Promise<IDBValidKey[]> { return this.#run(store, "readonly", s => s.getAllKeys(range)); }
  put(store: string, value: unknown, key?: IDBValidKey): Promise<IDBValidKey> { return this.#run(store, "readwrite", s => s.put(value, key)); }
  delete(store: string, key: IDBValidKey | IDBKeyRange): Promise<undefined> { return this.#run(store, "readwrite", s => s.delete(key)); }
}
