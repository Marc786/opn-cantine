// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, act, cleanup } from '@testing-library/react';
import { useSaveFlow } from './useSaveFlow';
import type { Employee, ScannedProduct } from '../types';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const INACTIVITY_TIMEOUT_MS = 15000;

const employee: Employee = {
  cardNumber: '000000000001',
  employeeNumber: 'E1',
  tab: 0,
};

const cart: ScannedProduct[] = [
  { lineId: 'l1', barcode: '1234', name: 'Chips', price: 2.5, qty: 1, productId: 'p1' },
];

function mountSaveFlow(scanPending: boolean) {
  let latest!: ReturnType<typeof useSaveFlow>;

  function Harness({ pending }: { pending: boolean }) {
    latest = useSaveFlow({
      employee,
      cardNumber: employee.cardNumber,
      pendingTotal: 2.5,
      scannedProducts: cart,
      setLoading: () => {},
      router: { push: () => {} },
      resetOpen: false,
      unknownOpen: false,
      editProduct: null,
      historyOpen: false,
      scanPending: pending,
    });
    return null;
  }

  const view = render(<Harness pending={scanPending} />);
  return {
    get: () => latest,
    setPending: (pending: boolean) =>
      act(() => {
        view.rerender(<Harness pending={pending} />);
      }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }))
  );
});

describe('auto-logout while a lookup is in flight', () => {
  it('logs out after the inactivity delay when nothing is pending', () => {
    const flow = mountSaveFlow(false);

    act(() => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);
    });

    expect(flow.get().saveOpen).toBe(true);
  });

  it('does not log out while a scan is still being looked up', () => {
    const flow = mountSaveFlow(true);

    act(() => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS * 3);
    });

    // The operator is still there and an item is on its way into the cart:
    // saving now would serialise the payload without it.
    expect(flow.get().saveOpen).toBe(false);
  });

  it('gives the operator a full delay again once the lookup lands', () => {
    const flow = mountSaveFlow(true);

    act(() => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1000);
    });
    flow.setPending(false);

    // The pre-lookup wait must not carry over, or an item arriving late would
    // be followed almost immediately by the save.
    act(() => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1);
    });
    expect(flow.get().saveOpen).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(flow.get().saveOpen).toBe(true);
  });
});
