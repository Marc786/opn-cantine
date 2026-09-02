import type { ScannedProduct } from './types';

export function newLineId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Adds one unit to the cart, merging into an existing line only when it is the
 * same thing at the same price.
 *
 * Matching on barcode alone silently folded a second event into the first
 * one's name and price: both use the `_event_` barcode, so a $5 BBQ and a $20
 * gala became "BBQ x2". The tab was charged $25 while the recorded lines only
 * accounted for $10, and the second event's name was lost.
 */
export function addUnit(
  lines: ScannedProduct[],
  line: Omit<ScannedProduct, 'lineId' | 'qty'>
): ScannedProduct[] {
  const existing = lines.find(
    (p) => p.barcode === line.barcode && p.name === line.name && p.price === line.price
  );
  if (existing) {
    return lines.map((p) => (p.lineId === existing.lineId ? { ...p, qty: p.qty + 1 } : p));
  }
  return [...lines, { ...line, lineId: newLineId(), qty: 1 }];
}

/** What the cart currently bills, derived from the lines themselves. */
export function linesTotal(lines: ScannedProduct[]): number {
  return parseFloat(lines.reduce((sum, p) => sum + p.price * p.qty, 0).toFixed(2));
}
