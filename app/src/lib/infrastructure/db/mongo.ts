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
