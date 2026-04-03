import { Product } from '@/lib/domain/entities/product.entity';
import { IProductRepository } from '@/lib/domain/ports/product.repository.port';
import { getDb } from '../db/mongo';
import { randomUUID } from 'crypto';

interface ProductDocument {
  _id: string;
  barcodes: string[];
  name: string;
  price: number;
  quantity: number;
}

function toProduct(doc: ProductDocument): Product {
  return {
    id: doc._id,
    barcodes: doc.barcodes,
    name: doc.name,
    price: doc.price,
    quantity: doc.quantity,
  };
}

export class MongoProductRepository implements IProductRepository {
  private readonly collectionName = 'products';

  private async collection() {
    const db = await getDb();
    return db.collection<ProductDocument>(this.collectionName);
  }

  async findById(id: string): Promise<Product | null> {
    const col = await this.collection();
    const doc = await col.findOne({ _id: id });
    if (!doc) return null;
    return toProduct(doc);
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    const col = await this.collection();
    const doc = await col.findOne({ barcodes: barcode });
    if (!doc) return null;
    return toProduct(doc);
  }

  async findAll(): Promise<Product[]> {
    const col = await this.collection();
    const docs = await col.find().toArray();
    return docs.map(toProduct);
  }

  async save(product: Product): Promise<Product> {
    const col = await this.collection();
    const id = randomUUID();
    const doc: ProductDocument = {
      _id: id,
      barcodes: product.barcodes,
      name: product.name,
      price: product.price,
      quantity: product.quantity,
    };
    await col.insertOne(doc);
    return { ...product, id };
  }

  async update(
    id: string,
    updates: Partial<Pick<Product, 'name' | 'price' | 'quantity' | 'barcodes'>>
  ): Promise<Product | null> {
    const col = await this.collection();
    const result = await col.findOneAndUpdate(
      { _id: id },
      { $set: updates },
      { returnDocument: 'after' }
    );
    if (!result) return null;
    return toProduct(result);
  }

  async addBarcode(id: string, barcode: string): Promise<Product | null> {
    const col = await this.collection();
    const result = await col.findOneAndUpdate(
      { _id: id },
      { $addToSet: { barcodes: barcode } },
      { returnDocument: 'after' }
    );
    if (!result) return null;
    return toProduct(result);
  }

  async decrementQuantity(
    id: string,
    amount: number
  ): Promise<Product | null> {
    const col = await this.collection();
    const result = await col.findOneAndUpdate(
      { _id: id, quantity: { $gte: amount } },
      { $inc: { quantity: -amount } },
      { returnDocument: 'after' }
    );
    if (!result) return null;
    return toProduct(result);
  }

  async delete(id: string): Promise<boolean> {
    const col = await this.collection();
    const result = await col.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }
}

export const productRepository = new MongoProductRepository();
