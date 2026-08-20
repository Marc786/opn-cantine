// Sentinel cardNumber used to log cash sales (paid directly at the physical
// box, no employee account / tab involved). Transaction and inventory
// pipelines treat it as an opaque string — no special backend handling needed.
export const CASH_CARD_NUMBER = '_cash_';
