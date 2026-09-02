import { describe, it, expect } from 'vitest';
import { addUnit, linesTotal } from './cart-lines';
import type { ScannedProduct } from './types';

const scan = (barcode: string, name: string, price: number, productId?: string) => ({
  barcode,
  name,
  price,
  productId: productId ?? null,
});

const build = (...adds: Omit<ScannedProduct, 'lineId' | 'qty'>[]) =>
  adds.reduce<ScannedProduct[]>((lines, line) => addUnit(lines, line), []);

describe('addUnit', () => {
  it('adds a new line with quantity one', () => {
    const lines = addUnit([], scan('1111', 'Chips', 2.5, 'p1'));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ barcode: '1111', name: 'Chips', price: 2.5, qty: 1 });
    expect(lines[0].lineId).toBeTruthy();
  });

  it('merges a repeat scan of the same product', () => {
    const lines = build(scan('1111', 'Chips', 2.5, 'p1'), scan('1111', 'Chips', 2.5, 'p1'));

    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(2);
  });

  it('keeps two different events apart even though they share a barcode', () => {
    const lines = build(scan('_event_', 'BBQ', 5), scan('_event_', 'Gala', 20));

    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.name)).toEqual(['BBQ', 'Gala']);
    expect(lines.every((l) => l.qty === 1)).toBe(true);
  });

  it('still merges the same event added twice', () => {
    const lines = build(scan('_event_', 'BBQ', 5), scan('_event_', 'BBQ', 5));

    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(2);
  });

  it('merges repeated coffees onto one line', () => {
    const lines = build(scan('_cafe_', 'Café', 1), scan('_cafe_', 'Café', 1));

    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(2);
  });

  it('gives every line a distinct id so edits cannot hit the wrong one', () => {
    const lines = build(scan('_event_', 'BBQ', 5), scan('_event_', 'Gala', 20));

    expect(new Set(lines.map((l) => l.lineId)).size).toBe(2);
  });

  it('separates the same barcode sold at a different price', () => {
    const lines = build(scan('1111', 'Chips', 2.5, 'p1'), scan('1111', 'Chips', 3, 'p1'));

    expect(lines).toHaveLength(2);
    expect(linesTotal(lines)).toBe(5.5);
  });

  it('does not mutate the array it was given', () => {
    const original = build(scan('1111', 'Chips', 2.5, 'p1'));
    const snapshot = JSON.parse(JSON.stringify(original));

    addUnit(original, scan('1111', 'Chips', 2.5, 'p1'));

    expect(original).toEqual(snapshot);
  });
});

describe('linesTotal', () => {
  it('is zero for an empty cart', () => {
    expect(linesTotal([])).toBe(0);
  });

  it('matches what two distinct events actually cost', () => {
    const lines = build(scan('_event_', 'BBQ', 5), scan('_event_', 'Gala', 20));

    // The old barcode-only merge produced "BBQ x2" = $10 while billing $25.
    expect(linesTotal(lines)).toBe(25);
  });

  it('sums mixed lines', () => {
    const lines = build(
      scan('1111', 'Chips', 2.5, 'p1'),
      scan('1111', 'Chips', 2.5, 'p1'),
      scan('_cafe_', 'Café', 1)
    );

    expect(linesTotal(lines)).toBe(6);
  });
});
