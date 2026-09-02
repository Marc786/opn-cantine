import { Product } from '../entities/product.entity';

/**
 * Result of an inventory decrement. `applied` may differ from `requested` and
 * `alreadyApplied` marks a replay of a sale that was already settled, so a
 * retry can never decrement the same product twice.
 */
export interface DecrementOutcome {
  product: Product;
  requested: number;
  applied: number;
  alreadyApplied: boolean;
}

export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findByBarcode(barcode: string): Promise<Product | null>;
  findAll(): Promise<Product[]>;
  save(product: Product): Promise<Product>;
  update(
    id: string,
    updates: Partial<Pick<Product, 'name' | 'price' | 'quantity' | 'barcodes'>>
  ): Promise<Product | null>;
  addBarcode(id: string, barcode: string): Promise<Product | null>;
  /**
   * Decrements stock exactly once for a given `saleId`, even across retries.
   * Stock is allowed to go negative: an accurate negative count is what makes
   * an oversell visible instead of silently clamping and creating drift.
   */
  decrementQuantityOnce(
    id: string,
    amount: number,
    saleId: string
  ): Promise<DecrementOutcome | null>;
  delete(id: string): Promise<boolean>;
}
