import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getDb, closeDb } from './mongo';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = 'index-test';
});

afterAll(async () => {
  await closeDb();
  await mongo.stop();
});

/** Index creation is deliberately not awaited, so give it a moment to land. */
async function indexKeysFor(collection: string) {
  const db = await getDb();
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const indexes = await db.collection(collection).indexes();
      if (indexes.length > 1) return indexes.map((i) => JSON.stringify(i.key));
    } catch {
      // The collection does not exist until createIndex has made it.
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return [];
}

describe('database indexes', () => {
  it('indexes the barcode lookup that every scan goes through', async () => {
    // Without this the kiosk scans a full collection per item, which the
    // operator waits on.
    expect(await indexKeysFor('products')).toContain('{"barcodes":1}');
  });

  it('indexes the login lookup', async () => {
    expect(await indexKeysFor('employees')).toContain('{"cardNumber":1}');
  });

  it('indexes the per-employee history', async () => {
    const keys = await indexKeysFor('transactions');
    expect(keys).toContain('{"cardNumber":1,"timestamp":-1}');
    expect(keys).toContain('{"timestamp":-1}');
  });
});
