import { TransactionEntity, TransactionItem } from '@/lib/domain/entities/transaction.entity';
import { ITransactionRepository } from '@/lib/domain/ports/transaction.repository.port';

export class TransactionApplicationService {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async logTransaction(employeeNumber: string, items: TransactionItem[], totalAmount: number) {
    const transaction = TransactionEntity.create(employeeNumber, items, totalAmount);
    return this.transactionRepository.save(transaction);
  }

  async getAll() {
    return this.transactionRepository.findAll();
  }
}
