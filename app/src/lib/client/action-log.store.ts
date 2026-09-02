import {
  type ActionEntry,
  type ActionDetail,
  type ActionType,
  LOG_CAPACITY,
  scrubDetail,
} from './action-log';

/**
 * IndexedDB-backed store for the action log.
 *
 * IndexedDB rather than localStorage: appends happen on the barcode-scan hot
 * path, and localStorage is synchronous and string-only, so every append would
 * mean re-serialising the whole log on the main thread. Here an append is one
 * async put, and the auto-incrementing key *is* the sequence number.
 *
 * Nothing in here may ever break the kiosk. Every operation is best-effort:
 * storage can be unavailable (private mode), full, or evicted by the browser,
 * and none of those are worth failing a sale over.
 */

const DB_NAME = 'cantine-action-log';
const DB_VERSION = 1;
const STORE = 'actions';

/** Trimming scans the store, so amortise it instead of running on every append. */
const TRIM_EVERY = 250;

let dbPromise: Promise<IDBDatabase> | null = null;
let appendsSinceTrim = 0;

function supported(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // autoIncrement gives us the monotonic `seq` for free, and it keeps
        // counting across reloads, which a client-side counter would not.
        db.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // A failed open must not be cached, or the log stays dead for the session.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Drops the oldest entries so the log cannot grow without bound. An unbounded
 * store risks hitting the origin quota, and on iOS a bloated origin is a
 * likelier candidate for eviction — which would lose the whole log.
 */
export async function trimTo(capacity: number = LOG_CAPACITY): Promise<number> {
  if (!supported()) return 0;
  const db = await openDb();

  const total = await promisify(tx(db, 'readonly').count());
  const excess = total - Math.max(0, capacity);
  if (excess <= 0) return 0;

  return new Promise<number>((resolve, reject) => {
    let removed = 0;
    const cursorRequest = tx(db, 'readwrite').openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor || removed >= excess) return resolve(removed);
      cursor.delete();
      removed += 1;
      cursor.continue();
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}

export async function appendEntry(entry: {
  at: string;
  sessionId: string;
  type: ActionType;
  detail?: ActionDetail;
}): Promise<void> {
  if (!supported()) return;

  const db = await openDb();
  await promisify(
    tx(db, 'readwrite').add({
      at: entry.at,
      sessionId: entry.sessionId,
      type: entry.type,
      detail: scrubDetail(entry.detail),
    })
  );

  appendsSinceTrim += 1;
  if (appendsSinceTrim >= TRIM_EVERY) {
    appendsSinceTrim = 0;
    await trimTo(LOG_CAPACITY);
  }
}

/** Every entry, oldest first — IndexedDB returns keys in ascending order. */
export async function readAll(): Promise<ActionEntry[]> {
  if (!supported()) return [];
  const db = await openDb();
  return promisify(tx(db, 'readonly').getAll()) as Promise<ActionEntry[]>;
}

export async function count(): Promise<number> {
  if (!supported()) return 0;
  const db = await openDb();
  return promisify(tx(db, 'readonly').count());
}

export async function clearAll(): Promise<void> {
  if (!supported()) return;
  const db = await openDb();
  await promisify(tx(db, 'readwrite').clear());
}

/** Test seam: forget the cached connection. */
export function resetConnection(): void {
  dbPromise = null;
  appendsSinceTrim = 0;
}
