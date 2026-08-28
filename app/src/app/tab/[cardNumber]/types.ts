export interface Employee {
  cardNumber: string;
  employeeNumber: string;
  tab: number;
}

export interface ScannedProduct {
  barcode: string;
  name: string;
  price: number;
  qty: number;
  /** Product id resolved at scan time; absent for quick-add pseudo items. */
  productId?: string | null;
}
