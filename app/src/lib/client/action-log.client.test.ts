import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

/**
 * Covers the app-facing wrapper: ordering, session grouping and the promise
 * that logging never breaks the caller.
 */

function installSessionStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  });
}

async function freshModules() {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  const store = await import('./action-log.store');
  store.resetConnection();
  const client = await import('./action-log.client');
  return { client, store };
}

beforeEach(() => {
  installSessionStorage();
});

describe('logAction', () => {
  it('records actions in call order even though it does not block', async () => {
    const { client, store } = await freshModules();

    client.logAction('login');
    client.logAction('scan', { barcode: 'a' });
    client.logAction('save_confirm');
    await client.flushActionLog();

    const entries = await store.readAll();
    expect(entries.map((e) => e.type)).toEqual(['login', 'scan', 'save_confirm']);
  });

  it('returns synchronously so it cannot slow the scan path', async () => {
    const { client } = await freshModules();

    expect(client.logAction('scan')).toBeUndefined();
    await client.flushActionLog();
  });

  it('groups entries under one session id', async () => {
    const { client, store } = await freshModules();

    client.logAction('login');
    client.logAction('scan');
    await client.flushActionLog();

    const sessions = new Set((await store.readAll()).map((e) => e.sessionId));
    expect(sessions.size).toBe(1);
  });

  it('starts a new session id on the next login', async () => {
    const { client, store } = await freshModules();

    client.logAction('login');
    await client.flushActionLog();
    client.startSession();
    client.logAction('login');
    await client.flushActionLog();

    const sessions = (await store.readAll()).map((e) => e.sessionId);
    expect(new Set(sessions).size).toBe(2);
  });

  it('redacts the card number it is handed', async () => {
    const { client, store } = await freshModules();

    client.logAction('login', { cardNumber: '123456789012' });
    await client.flushActionLog();

    const [entry] = await store.readAll();
    expect(entry.detail.cardNumber).toBe('*9012');
  });

  it('swallows a storage failure instead of surfacing it to the caller', async () => {
    const { client } = await freshModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Simulate storage going away mid-session, as eviction would.
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('storage unavailable');
      },
    });
    const store = await import('./action-log.store');
    store.resetConnection();

    expect(() => client.logAction('scan')).not.toThrow();
    await expect(client.flushActionLog()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps working after a failed write', async () => {
    const { client, store } = await freshModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const good = globalThis.indexedDB;
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('transient');
      },
    });
    const storeModule = await import('./action-log.store');
    storeModule.resetConnection();
    client.logAction('scan', { barcode: 'lost' });
    await client.flushActionLog();

    // Storage comes back: the queue must not be poisoned by the earlier reject.
    vi.stubGlobal('indexedDB', good);
    storeModule.resetConnection();
    client.logAction('scan', { barcode: 'kept' });
    await client.flushActionLog();

    expect((await store.readAll()).map((e) => e.detail.barcode)).toEqual(['kept']);

    warn.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('logActionOnce', () => {
  it('records only the first call for a key', async () => {
    const { client, store } = await freshModules();

    client.logActionOnce('login', 'login', { cardNumber: '123456789012' });
    client.logActionOnce('login', 'login', { cardNumber: '123456789012' });
    await client.flushActionLog();

    expect(await store.readAll()).toHaveLength(1);
  });

  it('survives the double effect invocation StrictMode causes', async () => {
    const { client, store } = await freshModules();

    // React runs setup twice on the same instance in development, so the guard
    // cannot live in a component ref that a remount would reset.
    for (let i = 0; i < 2; i++) client.logActionOnce('login', 'login');
    await client.flushActionLog();

    expect((await store.readAll()).filter((e) => e.type === 'login')).toHaveLength(1);
  });

  it('keeps different keys independent', async () => {
    const { client, store } = await freshModules();

    client.logActionOnce('login', 'login');
    client.logActionOnce('greeting', 'scan');
    await client.flushActionLog();

    expect(await store.readAll()).toHaveLength(2);
  });

  it('records again after the next login starts a new session', async () => {
    const { client, store } = await freshModules();

    client.logActionOnce('login', 'login');
    await client.flushActionLog();

    client.startSession();
    client.logActionOnce('login', 'login');
    await client.flushActionLog();

    const entries = await store.readAll();
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((e) => e.sessionId)).size).toBe(2);
  });

  it('does not suppress ordinary logAction calls of the same type', async () => {
    const { client, store } = await freshModules();

    client.logActionOnce('login', 'login');
    client.logAction('login');
    await client.flushActionLog();

    expect(await store.readAll()).toHaveLength(2);
  });
});

describe('flushActionLog', () => {
  it('waits for a slow write to land', async () => {
    // This is the guarantee the save flow leans on: it flushes before
    // navigating away, so the last thing the kiosk did is never lost.
    vi.resetModules();
    globalThis.indexedDB = new IDBFactory();

    const landed: string[] = [];
    let release: (() => void) | null = null;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    vi.doMock('./action-log.store', () => ({
      appendEntry: async (entry: { type: string }) => {
        await blocked;
        landed.push(entry.type);
      },
      readAll: async () => [],
      count: async () => 0,
      clearAll: async () => {},
      resetConnection: () => {},
      trimTo: async () => 0,
    }));

    const client = await import('./action-log.client');
    client.logAction('save_confirm');

    expect(landed).toEqual([]);

    const flushing = client.flushActionLog().then(() => 'flushed' as const);
    const timeout = new Promise<'pending'>((r) => setTimeout(() => r('pending'), 30));

    // Must still be waiting while the write is blocked.
    expect(await Promise.race([flushing, timeout])).toBe('pending');

    release!();
    expect(await flushing).toBe('flushed');
    expect(landed).toEqual(['save_confirm']);

    vi.doUnmock('./action-log.store');
    vi.resetModules();
  });

  it('serialises writes so they cannot land out of order', async () => {
    vi.resetModules();
    globalThis.indexedDB = new IDBFactory();

    const landed: string[] = [];
    // The first write is slow, the second instant. Without a queue the fast one
    // would overtake it and the log would misreport what happened first.
    const delays: Record<string, number> = { login: 20, scan: 0 };

    vi.doMock('./action-log.store', () => ({
      appendEntry: async (entry: { type: string }) => {
        await new Promise((r) => setTimeout(r, delays[entry.type] ?? 0));
        landed.push(entry.type);
      },
      readAll: async () => [],
      count: async () => 0,
      clearAll: async () => {},
      resetConnection: () => {},
      trimTo: async () => 0,
    }));

    const client = await import('./action-log.client');
    client.logAction('login');
    client.logAction('scan');
    await client.flushActionLog();

    expect(landed).toEqual(['login', 'scan']);

    vi.doUnmock('./action-log.store');
    vi.resetModules();
  });
});

describe('readActionLog', () => {
  it('flushes pending writes before reading, so nothing is missed', async () => {
    const { client } = await freshModules();

    client.logAction('login');
    client.logAction('scan');

    // No explicit flush: the read must do it.
    expect(await client.readActionLog()).toHaveLength(2);
  });
});

describe('clearActionLog', () => {
  it('empties the log', async () => {
    const { client } = await freshModules();

    client.logAction('login');
    await client.clearActionLog();

    expect(await client.readActionLog()).toEqual([]);
  });
});
