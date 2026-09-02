import type { TransactionItem } from './entities/transaction.entity';

/**
 * Totals are money rounded to the cent, so compare with a tolerance rather than
 * `===`: summing floats (0.1 + 0.2) drifts in the last bits.
 */
export const TOTAL_TOLERANCE = 0.01;

/** What the cart lines add up to. */
export function cartTotal(items: Pick<TransactionItem, 'price' | 'quantity'>[]): number {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return parseFloat(total.toFixed(2));
}

/**
 * Whether a submitted total is consistent with the lines it claims to bill.
 *
 * The kiosk sends both, and nothing recomputed the total server-side, so a
 * client-side bug could charge one amount while the ledger itemised another —
 * a silent, permanent discrepancy of exactly the kind we removed from stock.
 */
export function totalMatchesItems(
  totalAmount: number,
  items: Pick<TransactionItem, 'price' | 'quantity'>[]
): boolean {
  return Math.abs(cartTotal(items) - totalAmount) <= TOTAL_TOLERANCE;
}
