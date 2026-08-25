import { Product } from '../entities/product.entity';

/**
 * Result of an inventory decrement. `applied` may be lower than `requested`
 * when the product did not have enough stock, which is the signal that
 * inventory and the recorded transaction have drifted apart.
 */
export interface DecrementOutcome {
  product: Product;
  requested: number;
  applied: number;
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
  decrementQuantity(id: string, amount: number): Promise<DecrementOutcome | null>;
  delete(id: string): Promise<boolean>;
}
