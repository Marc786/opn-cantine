import { Product } from '../entities/product.entity';

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
  decrementQuantity(id: string, amount: number): Promise<Product | null>;
  delete(id: string): Promise<boolean>;
}
