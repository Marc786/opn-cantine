// Sentinel cardNumber used to log cash sales (paid directly at the physical
// box, no employee account / tab involved).
export const CASH_CARD_NUMBER = '_cash_';

/**
 * Cash sales have no employee behind them, so they record a ledger entry and
 * decrement stock but charge no tab. Everything else about a sale is identical,
 * which is why they still go through `POST /api/sales`: skipping it is what
 * lets stock drift away from the ledger.
 */
export function isCashSale(cardNumber: string): boolean {
  return cardNumber === CASH_CARD_NUMBER;
}
