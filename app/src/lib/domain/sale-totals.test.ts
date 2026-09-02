import { describe, it, expect } from 'vitest';
import { cartTotal, totalMatchesItems } from './sale-totals';

const line = (price: number, quantity: number) => ({ price, quantity });

describe('cartTotal', () => {
  it('sums price times quantity', () => {
    expect(cartTotal([line(2.5, 3), line(1, 2)])).toBe(9.5);
  });

  it('is zero for an empty cart', () => {
    expect(cartTotal([])).toBe(0);
  });

  it('rounds float drift to the cent', () => {
    expect(cartTotal([line(0.1, 1), line(0.2, 1)])).toBe(0.3);
  });
});

describe('totalMatchesItems', () => {
  it('accepts a total that matches its lines', () => {
    expect(totalMatchesItems(9.5, [line(2.5, 3), line(1, 2)])).toBe(true);
  });

  it('tolerates sub-cent float drift', () => {
    expect(totalMatchesItems(0.1 + 0.2, [line(0.3, 1)])).toBe(true);
  });

  it('rejects an inflated total', () => {
    expect(totalMatchesItems(25, [line(5, 2)])).toBe(false);
  });

  it('rejects a total that undercharges', () => {
    expect(totalMatchesItems(1, [line(5, 2)])).toBe(false);
  });

  it('rejects the multi-event bug: two events folded into one line', () => {
    // Two events, $5 and $20, merged onto the $5 line as qty 2. The tab was
    // charged $25 while the itemised lines only account for $10.
    expect(totalMatchesItems(25, [line(5, 2)])).toBe(false);
  });

  it('rejects a negative total against real lines', () => {
    expect(totalMatchesItems(-9.5, [line(2.5, 3), line(1, 2)])).toBe(false);
  });

  it('accepts an empty cart billed at zero', () => {
    expect(totalMatchesItems(0, [])).toBe(true);
  });
});
