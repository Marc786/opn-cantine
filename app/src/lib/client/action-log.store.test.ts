import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  appendEntry,
  clearAll,
  count,
  readAll,
  resetConnection,
  trimTo,
} from './action-log.store';

/**
 * The store is exercised against a real IndexedDB implementation rather than a
 * mock: the sequence numbering and the ordering guarantees come from IndexedDB
 * itself, so a mock would only assert our own assumptions back at us.
 */
beforeEach(() => {
  // A brand new factory per test, so databases never leak between them.
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
});

const log = (type: Parameters<typeof appendEntry>[0]['type'], detail?: Record<string, string>) =>
  appendEntry({ at: new Date().toISOString(), sessionId: 's1', type, detail });

describe('action log store', () => {
  it('starts empty', async () => {
    expect(await readAll()).toEqual([]);
    expect(await count()).toBe(0);
  });

  it('assigns increasing sequence numbers', async () => {
    await log('login');
    await log('scan');
    await log('save_confirm');

    const entries = await readAll();
    expect(entries.map((e) => e.type)).toEqual(['login', 'scan', 'save_confirm']);
    expect(entries.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('returns entries oldest first, which is the order they happened', async () => {
    for (const barcode of ['a', 'b', 'c']) await log('scan', { barcode });

    const entries = await readAll();
    expect(entries.map((e) => e.detail.barcode)).toEqual(['a', 'b', 'c']);
  });

  it('keeps sequence numbers unique across a reconnect', async () => {
    await log('login');
    resetConnection();
    await log('scan');

    const seqs = (await readAll()).map((e) => e.seq);
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  });

  it('scrubs credentials on the way in, not just on the way out', async () => {
    await appendEntry({
      at: new Date().toISOString(),
      sessionId: 's1',
      type: 'login',
      detail: { cardNumber: '123456789012', pin: '4321' },
    });

    const [entry] = await readAll();
    expect(entry.detail.cardNumber).toBe('*9012');
    expect(entry.detail.pin).toBeUndefined();
  });

  it('clears everything on request', async () => {
    await log('login');
    await log('scan');
    await clearAll();

    expect(await readAll()).toEqual([]);
  });

  it('counts what it holds', async () => {
    await log('login');
    await log('scan');
    expect(await count()).toBe(2);
  });
});

describe('action log store without IndexedDB', () => {
  const original = globalThis.indexedDB;

  afterEach(() => {
    globalThis.indexedDB = original;
  });

  it('degrades quietly rather than breaking the kiosk', async () => {
    // Private browsing and locked-down devices can leave this undefined.
    // @ts-expect-error deliberately removing the API for this test
    delete globalThis.indexedDB;
    resetConnection();

    await expect(log('scan')).resolves.toBeUndefined();
    expect(await readAll()).toEqual([]);
    expect(await count()).toBe(0);
    await expect(clearAll()).resolves.toBeUndefined();
  });
});

describe('trimTo', () => {
  it('drops the oldest entries and keeps the newest', async () => {
    for (const barcode of ['a', 'b', 'c', 'd', 'e']) await log('scan', { barcode });

    const removed = await trimTo(2);

    expect(removed).toBe(3);
    const remaining = await readAll();
    expect(remaining.map((e) => e.detail.barcode)).toEqual(['d', 'e']);
  });

  it('does nothing when under capacity', async () => {
    await log('scan', { barcode: 'a' });
    expect(await trimTo(10)).toBe(0);
    expect(await count()).toBe(1);
  });

  it('keeps sequence numbers strictly increasing after a trim', async () => {
    for (const barcode of ['a', 'b', 'c']) await log('scan', { barcode });
    await trimTo(1);
    await log('scan', { barcode: 'd' });

    const seqs = (await readAll()).map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  it('empties the log for a zero capacity', async () => {
    await log('scan', { barcode: 'a' });
    await trimTo(0);
    expect(await count()).toBe(0);
  });
});
