import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;
let connecting: Promise<Db> | null = null;

function uri(): string {
  return process.env.MONGODB_URI || 'mongodb://localhost:27017';
}

function dbName(): string {
  return process.env.MONGODB_DB || 'cantine';
}

/**
 * Indexes for the queries on the critical path.
 *
 * Without these every barcode scan is a full collection scan, which the kiosk
 * feels directly: the operator waits, staring at an unchanged screen, before
 * the product appears. `createIndex` is idempotent, so this is safe to run on
 * every cold start.
 *
 * Deliberately none of them unique: an index that fails to build on existing
 * duplicate data would take the whole app down, and none of these fields are
 * guaranteed unique in data written before this existed.
 */
async function ensureIndexes(database: Db): Promise<void> {
  await Promise.all([
    // The scan lookup, run once per item on every visit.
    database.collection('products').createIndex({ barcodes: 1 }),
    // The login lookup.
    database.collection('employees').createIndex({ cardNumber: 1 }),
    // The per-employee history, newest first.
    database.collection('transactions').createIndex({ cardNumber: 1, timestamp: -1 }),
    database.collection('transactions').createIndex({ timestamp: -1 }),
  ]);
}

/**
 * Returns the shared database handle, connecting on first use.
 *
 * Connection settings are read lazily rather than at module load so tests and
 * tooling can point the process at another database before the first query
 * without having to control import order.
 */
export async function getDb(): Promise<Db> {
  if (db) return db;
  // Concurrent callers must share one connection attempt rather than each
  // creating a client and leaking all but the last.
  if (connecting) return connecting;

  connecting = (async () => {
    const created = new MongoClient(uri());
    await created.connect();
    client = created;
    db = created.db(dbName());
    // Not awaited: the first query should not wait on index creation, and a
    // database user without the rights to create them must not break the app.
    ensureIndexes(db).catch((error) => {
      console.error('[mongo] could not ensure indexes', error);
    });
    return db;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

/** Closes the shared connection. Used to keep test runs and scripts tidy. */
export async function closeDb(): Promise<void> {
  const current = client;
  client = null;
  db = null;
  connecting = null;
  if (current) await current.close();
}
