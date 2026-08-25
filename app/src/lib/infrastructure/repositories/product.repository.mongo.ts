import { Product } from '@/lib/domain/entities/product.entity';
import { IProductRepository, DecrementOutcome } from '@/lib/domain/ports/product.repository.port';
import { getDb } from '../db/mongo';
import { APPLIED_SALES_HISTORY } from '@/lib/domain/inventory-rules';
import { randomUUID } from 'crypto';

interface AppliedSale {
  saleId: string;
  amount: number;
  at?: Date;
}

interface ProductDocument {
  _id: string;
  barcodes: string[];
  name: string;
  price: number;
  quantity: number;
  createdAt?: Date;
  /** Recent sales already applied to this product, for exactly-once retries. */
  appliedSales?: AppliedSale[];
}

function toProduct(doc: ProductDocument): Product {
  return {
    id: doc._id,
    barcodes: doc.barcodes,
    name: doc.name,
    price: doc.price,
    quantity: doc.quantity,
    createdAt: doc.createdAt,
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
    const createdAt = new Date();
    const doc: ProductDocument = {
      _id: id,
      barcodes: product.barcodes,
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      createdAt,
    };
    await col.insertOne(doc);
    return { ...product, id, createdAt };
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

  async decrementQuantityOnce(
    id: string,
    amount: number,
    saleId: string
  ): Promise<DecrementOutcome | null> {
    const col = await this.collection();

    // Single atomic conditional update: the guard on `appliedSales.saleId` and
    // the `$inc` commit together, so there is no window in which a crash could
    // apply the decrement twice or record it without applying it.
    const before = await col.findOneAndUpdate(
      { _id: id, 'appliedSales.saleId': { $ne: saleId } },
      {
        $inc: { quantity: -amount },
        $push: {
          appliedSales: {
            $each: [{ saleId, amount, at: new Date() }],
            $slice: -APPLIED_SALES_HISTORY,
          },
        },
      },
      { returnDocument: 'before' }
    );

    if (before) {
      const previousQuantity =
        typeof before.quantity === 'number' && Number.isFinite(before.quantity)
          ? before.quantity
          : 0;
      return {
        product: toProduct({ ...before, quantity: previousQuantity - amount }),
        requested: amount,
        applied: amount,
        alreadyApplied: false,
      };
    }

    // Guard failed: either the product is gone, or this sale was already applied.
    const current = await col.findOne({ _id: id });
    if (!current) return null;

    const previous = (current.appliedSales ?? []).find((s) => s.saleId === saleId);
    if (!previous) return null;

    return {
      product: toProduct(current),
      requested: amount,
      applied: previous.amount,
      alreadyApplied: true,
    };
  }

  async delete(id: string): Promise<boolean> {
    const col = await this.collection();
    const result = await col.deleteOne({ _id: id });
    return result.deletedCount === 1;
  }
}

export const productRepository = new MongoProductRepository();
