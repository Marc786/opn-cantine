import { Transaction } from '@/lib/domain/entities/transaction.entity';
import { ITransactionRepository } from '@/lib/domain/ports/transaction.repository.port';
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
}

export const transactionRepository = new MongoTransactionRepository();
