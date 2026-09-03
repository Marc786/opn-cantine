// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, act, cleanup } from '@testing-library/react';
import { useCart } from './useCart';

afterEach(cleanup);

let saleInProgress = false;

function Harness({ onReady }: { onReady: (cart: ReturnType<typeof useCart>) => void }) {
  const cart = useCart(() => {}, { isSaleInProgress: () => saleInProgress });
  onReady(cart);
  return null;
}

function mountCart() {
  let latest!: ReturnType<typeof useCart>;
  render(<Harness onReady={(cart) => { latest = cart; }} />);
  return () => latest;
}

beforeEach(() => {
  saleInProgress = false;
  vi.restoreAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        found: true,
        product: { id: 'p1', name: 'Chips', price: 2.5 },
      }),
    }))
  );
});

describe('useCart while a sale is being sent', () => {
  it('adds a scanned product when no sale is in flight', async () => {
    const cart = mountCart();

    await act(async () => {
      cart().handleScanChange({
        target: { value: '0064420001030' },
      } as React.ChangeEvent<HTMLInputElement>);
      cart().handleScanKeyDown({
        key: 'Enter',
      } as React.KeyboardEvent<HTMLInputElement>);
    });

    expect(cart().scannedProducts).toHaveLength(1);
    expect(cart().pendingTotal).toBe(2.5);
  });

  it('refuses a scan that lands while the sale is being sent', async () => {
    // The payload is serialised when the save starts and the screen navigates
    // away when it returns. On a slow connection that gap is seconds long, and
    // anything added to the cart in it would leave the shelf unbilled.
    const cart = mountCart();
    saleInProgress = true;

    await act(async () => {
      cart().handleScanChange({
        target: { value: '0064420001030' },
      } as React.ChangeEvent<HTMLInputElement>);
      cart().handleScanKeyDown({
        key: 'Enter',
      } as React.KeyboardEvent<HTMLInputElement>);
    });

    expect(cart().scannedProducts).toHaveLength(0);
    expect(cart().pendingTotal).toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('tells the user rather than failing silently', async () => {
    const cart = mountCart();
    saleInProgress = true;

    await act(async () => {
      cart().handleScanChange({
        target: { value: '0064420001030' },
      } as React.ChangeEvent<HTMLInputElement>);
      cart().handleScanKeyDown({
        key: 'Enter',
      } as React.KeyboardEvent<HTMLInputElement>);
    });

    expect(cart().scanFeedback).toMatch(/Vente en cours/);
  });

  it('takes scans again once the sale has finished', async () => {
    const cart = mountCart();
    saleInProgress = true;

    await act(async () => {
      cart().handleScanChange({
        target: { value: '0064420001030' },
      } as React.ChangeEvent<HTMLInputElement>);
      cart().handleScanKeyDown({ key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>);
    });
    saleInProgress = false;
    await act(async () => {
      cart().handleScanChange({
        target: { value: '0064420001030' },
      } as React.ChangeEvent<HTMLInputElement>);
      cart().handleScanKeyDown({ key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>);
    });

    expect(cart().scannedProducts).toHaveLength(1);
  });
});

/** A fetch whose response we release by hand, to observe the in-flight state. */
function deferredFetch() {
  const pending: Array<() => void> = [];
  const fetchMock = vi.fn(
    () =>
      new Promise((resolve) => {
        pending.push(() =>
          resolve({
            ok: true,
            json: async () => ({
              found: true,
              product: { id: 'p1', name: 'Chips', price: 2.5 },
            }),
          })
        );
      })
  );
  vi.stubGlobal('fetch', fetchMock);
  return {
    releaseAll: () => pending.splice(0).forEach((r) => r()),
    /** Releases the oldest in-flight lookup only. */
    releaseOne: () => pending.shift()?.(),
    inFlight: () => pending.length,
  };
}

function scan(cart: () => ReturnType<typeof useCart>, barcode = '0064420001030') {
  cart().handleScanChange({
    target: { value: barcode },
  } as React.ChangeEvent<HTMLInputElement>);
  cart().handleScanKeyDown({ key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>);
}

describe('useCart while a barcode is being looked up', () => {
  it('reports the lookup as pending', async () => {
    // On the kiosk this takes seconds, and the screen showed nothing at all
    // meanwhile: a slow scan looked exactly like a missed one.
    const { releaseAll } = deferredFetch();
    const cart = mountCart();

    await act(async () => { scan(cart); });
    expect(cart().scanPending).toBe(true);

    await act(async () => { releaseAll(); });
    expect(cart().scanPending).toBe(false);
  });

  it('stays pending until the last of several scans lands', async () => {
    // Overlapping scans are normal at speed. Clearing on the first response
    // would drop the spinner while a lookup is still outstanding.
    const { releaseOne, inFlight } = deferredFetch();
    const cart = mountCart();

    await act(async () => { scan(cart, '1111111111111'); });
    await act(async () => { scan(cart, '2222222222222'); });
    expect(inFlight()).toBe(2);

    await act(async () => { releaseOne(); });
    expect(cart().scanPending).toBe(true);

    await act(async () => { releaseOne(); });
    expect(cart().scanPending).toBe(false);
  });

  it('stops being pending when the lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const cart = mountCart();

    await act(async () => { scan(cart); });

    expect(cart().scanPending).toBe(false);
    expect(cart().scanFeedback).toMatch(/Erreur/);
  });

  it('is not pending before anything is scanned', () => {
    deferredFetch();
    const cart = mountCart();

    expect(cart().scanPending).toBe(false);
  });

  it('bounds the lookup so it cannot stay pending forever', async () => {
    // Auto-logout is paused while a lookup is in flight, so a request that
    // never settles would keep an employee's tab on a shared screen for good.
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            found: true,
            product: { id: 'p1', name: 'Chips', price: 2.5 },
          })
        )
    );
    vi.stubGlobal('fetch', fetchMock);
    const cart = mountCart();

    await act(async () => { scan(cart); });

    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('useCart scan feedback', () => {
  it('does not let an earlier scan cut short a later message', async () => {
    // Each scan used to arm its own timer, so the first to expire wiped
    // whatever the second had just put on screen.
    vi.useFakeTimers();
    try {
      const cart = mountCart();
      await act(async () => { scan(cart, '1111111111111'); });

      await act(async () => { vi.advanceTimersByTime(2500); });
      await act(async () => { scan(cart, '2222222222222'); });
      // The first timer would have fired here.
      await act(async () => { vi.advanceTimersByTime(1000); });

      expect(cart().scanFeedback).toMatch(/Chips/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the message once it has had its time', async () => {
    vi.useFakeTimers();
    try {
      const cart = mountCart();
      await act(async () => { scan(cart); });
      expect(cart().scanFeedback).toMatch(/Chips/);

      await act(async () => { vi.advanceTimersByTime(3100); });

      expect(cart().scanFeedback).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});
