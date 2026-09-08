/**
 * Rules that keep the transaction ledger and stock counts in agreement.
 *
 * These live in the domain because they are relied upon by both the sale
 * service and the Mongo repositories, and drift is exactly what happens when
 * the two disagree about them.
 */

/**
 * Quick-add buttons (coffee, event tickets) use synthetic barcodes such as
 * `_cafe_` and `_event_`. They are billed but deliberately not inventory
 * tracked, so they must never be treated as a failed product lookup.
 */
export const INTERNAL_BARCODE_PREFIX = '_';

export function isInventoryTracked(barcode: string): boolean {
  return barcode.length > 0 && !barcode.startsWith(INTERNAL_BARCODE_PREFIX);
}

/**
 * Manual inventory corrections may start from a negative quantity. Keep the
 * edit itself as text so the operator can erase "-5" before entering its
 * replacement; validate the completed value before it is persisted.
 */
export function parseInventoryQuantity(value: string): number | null {
  if (value.trim() === '') return null;

  const quantity = Number(value);
  return isValidInventoryQuantity(quantity) ? quantity : null;
}

export function isValidInventoryQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * How many recent sale ids are retained per employee and per product to make
 * writes idempotent. Retry windows are seconds wide, so this is far more
 * history than is needed while keeping documents bounded.
 */
export const APPLIED_SALES_HISTORY = 500;

/** Shape a `saleId` must have to be accepted as an idempotency key. */
export const SALE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function isValidSaleId(value: unknown): value is string {
  return typeof value === 'string' && SALE_ID_PATTERN.test(value);
}
