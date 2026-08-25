import { Transaction, InventoryLine } from '@/lib/domain/entities/transaction.entity';
import {
  ITransactionRepository,
  InsertOnceResult,
  PaginatedOptions,
  PaginatedResult,
} from '@/lib/domain/ports/transaction.repository.port';
import { getDb } from '../db/mongo';
import { ObjectId } from 'mongodb';

/**
 * `_id` is the client-generated sale id for sales recorded through the sale
 * flow. Legacy rows created before idempotency still carry an ObjectId.
 */
interface TransactionDocument extends Omit<Transaction, 'id'> {
  _id: string | ObjectId;
}

function toTransaction(doc: TransactionDocument): Transaction {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id?.toString() };
}

export class MongoTransactionRepository implements ITransactionRepository {
  private readonly collectionName = 'transactions';

  private async collection() {
    const db = await getDb();
    return db.collection<TransactionDocument>(this.collectionName);
  }

  async save(transaction: Transaction): Promise<Transaction> {
    const col = await this.collection();
    const { id, ...rest } = transaction;
    if (id) {
      await col.insertOne({ ...rest, _id: id });
      return { ...transaction, id };
    }
    const result = await col.insertOne(rest as TransactionDocument);
    return { ...transaction, id: result.insertedId.toString() };
  }

  async insertOnce(transaction: Transaction): Promise<InsertOnceResult> {
    const col = await this.collection();
    const { id, ...rest } = transaction;
    if (!id) throw new Error('A sale id is required to record a transaction');

    try {
      await col.insertOne({ ...rest, _id: id });
      return { created: true, transaction: { ...transaction, id } };
    } catch (error: unknown) {
      // Duplicate key: this sale id was already recorded, so this is a retry.
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: number }).code === 11000
      ) {
        const existing = await col.findOne({ _id: id });
        if (existing) {
          return { created: false, transaction: toTransaction(existing) };
        }
      }
      throw error;
    }
  }

  async markSettlement(
    id: string,
    settlement: { tabApplied: boolean; inventory: InventoryLine[]; settled: boolean }
  ): Promise<void> {
    const col = await this.collection();
    await col.updateOne({ _id: id }, { $set: settlement });
  }

  async findById(id: string): Promise<Transaction | null> {
    const col = await this.collection();
    const doc = await col.findOne({ _id: id });
    return doc ? toTransaction(doc) : null;
  }

  async findAll(): Promise<Transaction[]> {
    const col = await this.collection();
    const docs = await col.find().sort({ timestamp: -1 }).toArray();
    return docs.map(toTransaction);
  }

  async findByCardNumber(cardNumber: string): Promise<Transaction[]> {
    const col = await this.collection();
    const docs = await col
      .find({ cardNumber })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
    return docs.map(toTransaction);
  }

  async findPaginated({ page, pageSize, cardNumber, items }: PaginatedOptions): Promise<PaginatedResult> {
    const col = await this.collection();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (cardNumber) filter.cardNumber = cardNumber;
    if (items && items.length > 0) filter['items.name'] = { $in: items };

    const [total, docs] = await Promise.all([
      col.countDocuments(filter),
      col.find(filter).sort({ timestamp: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ]);
    return { data: docs.map(toTransaction), total };
  }

  async findDistinctItems(): Promise<string[]> {
    const col = await this.collection();
    const names = await col.distinct('items.name');
    return (names as string[]).filter(Boolean).sort();
  }
}

export const transactionRepository = new MongoTransactionRepository();
