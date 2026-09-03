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
