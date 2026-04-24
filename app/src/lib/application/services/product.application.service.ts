import { ProductEntity } from '@/lib/domain/entities/product.entity';
import { IProductRepository } from '@/lib/domain/ports/product.repository.port';

export class ProductApplicationService {
  constructor(private readonly productRepository: IProductRepository) {}

  async lookupByBarcode(barcode: string) {
    return this.productRepository.findByBarcode(barcode);
  }

  async getAll() {
    return this.productRepository.findAll();
  }

  async getById(id: string) {
    return this.productRepository.findById(id);
  }

  async createProduct(
    barcodes: string[],
    name: string,
    price: number,
    quantity: number
  ) {
    for (const barcode of barcodes) {
      const existing = await this.productRepository.findByBarcode(barcode);
      if (existing) {
        throw new Error(`Barcode "${barcode}" is already used by "${existing.name}"`);
      }
    }
    const product = ProductEntity.create(barcodes, name, price, quantity);
    return this.productRepository.save(product);
  }

  async updateProduct(
    id: string,
    updates: { name?: string; price?: number; quantity?: number; barcodes?: string[] }
  ) {
    return this.productRepository.update(id, updates);
  }

  async addBarcodeToProduct(id: string, barcode: string) {
    const existing = await this.productRepository.findByBarcode(barcode);
    if (existing) {
      throw new Error(`Barcode "${barcode}" is already used by "${existing.name}"`);
    }
    return this.productRepository.addBarcode(id, barcode);
  }

  async restock(id: string, additionalQuantity: number) {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }
    return this.productRepository.update(id, {
      quantity: product.quantity + additionalQuantity,
    });
  }

  async bulkRestock(updates: { id: string; quantity: number }[]) {
    const results = [];
    for (const { id, quantity } of updates) {
      const result = await this.productRepository.update(id, { quantity });
      results.push(result);
    }
    return results;
  }

  async decrementQuantity(id: string, amount: number = 1) {
    return this.productRepository.decrementQuantity(id, amount);
  }

  async deleteProduct(id: string) {
    return this.productRepository.delete(id);
  }
}
