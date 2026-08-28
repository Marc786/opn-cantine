export interface TransactionItem {
  barcode: string;
  name: string;
  price: number;
  quantity: number;
  /** Resolved at scan time so a later barcode edit cannot orphan the line. */
  productId?: string | null;
}

export type InventoryLineStatus =
  | 'applied'
  | 'not_tracked'
  | 'product_not_found'
  | 'oversold'
  | 'failed';

export interface InventoryLine {
  barcode: string;
  name: string;
  productId: string | null;
  requested: number;
  applied: number;
  status: InventoryLineStatus;
  message?: string;
}

export interface Transaction {
  /** Client-generated sale id. Doubles as the Mongo `_id` for idempotency. */
  id?: string;
  cardNumber: string;
  items: TransactionItem[];
  totalAmount: number;
  timestamp: Date;
  /** Whether the employee tab was charged for this sale. */
  tabApplied?: boolean;
  /** Per-line inventory outcome, written once the decrements have run. */
  inventory?: InventoryLine[];
  /** True once tab and inventory have both been fully settled. */
  settled?: boolean;
}

export class TransactionEntity implements Transaction {
  constructor(
    public readonly cardNumber: string,
    public readonly items: TransactionItem[],
    public readonly totalAmount: number,
    public readonly timestamp: Date,
    public readonly id?: string
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.cardNumber || this.cardNumber.trim().length === 0) {
      throw new Error('Card number is required');
    }

    if (this.totalAmount < 0) {
      throw new Error('Total amount must be >= 0');
    }

    if (!Array.isArray(this.items)) {
      throw new Error('Items must be an array');
    }
  }

  static create(
    cardNumber: string,
    items: TransactionItem[],
    totalAmount: number,
    id?: string
  ): TransactionEntity {
    return new TransactionEntity(
      cardNumber.trim(),
      items,
      totalAmount,
      new Date(),
      id
    );
  }
}
