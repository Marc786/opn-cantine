import { Transaction } from '../entities/transaction.entity';

export interface PaginatedOptions {
  page: number;
  pageSize: number;
  cardNumber?: string;
  items?: string[];
}

export interface PaginatedResult {
  data: Transaction[];
  total: number;
}

export interface ITransactionRepository {
  save(transaction: Transaction): Promise<Transaction>;
  findAll(): Promise<Transaction[]>;
  findByCardNumber(cardNumber: string): Promise<Transaction[]>;
  findPaginated(options: PaginatedOptions): Promise<PaginatedResult>;
  findDistinctItems(): Promise<string[]>;
}
