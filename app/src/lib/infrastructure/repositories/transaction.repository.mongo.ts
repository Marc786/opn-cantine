import { Transaction } from '@/lib/domain/entities/transaction.entity';
import { ITransactionRepository, PaginatedOptions, PaginatedResult } from '@/lib/domain/ports/transaction.repository.port';
import { getDb } from '../db/mongo';

export class MongoTransactionRepository implements ITransactionRepository {
  private readonly collectionName = 'transactions';

  private async collection() {
    const db = await getDb();
    return db.collection<Transaction>(this.collectionName);
  }

  async save(transaction: Transaction): Promise<Transaction> {
    const col = await this.collection();
    const result = await col.insertOne({ ...transaction });
    return { ...transaction, id: result.insertedId.toString() };
  }

  async findAll(): Promise<Transaction[]> {
    const col = await this.collection();
    return col.find().sort({ timestamp: -1 }).toArray();
  }

  async findByCardNumber(cardNumber: string): Promise<Transaction[]> {
    const col = await this.collection();
    return col.find({ cardNumber }).sort({ timestamp: -1 }).limit(20).toArray();
  }

  async findPaginated({ page, pageSize, cardNumber, items }: PaginatedOptions): Promise<PaginatedResult> {
    const col = await this.collection();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (cardNumber) filter.cardNumber = cardNumber;
    if (items && items.length > 0) filter['items.name'] = { $in: items };

    const [total, data] = await Promise.all([
      col.countDocuments(filter),
      col.find(filter).sort({ timestamp: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    ]);
    return { data, total };
  }

  async findDistinctItems(): Promise<string[]> {
    const col = await this.collection();
    const names = await col.distinct('items.name');
    return (names as string[]).filter(Boolean).sort();
  }
}

export const transactionRepository = new MongoTransactionRepository();
