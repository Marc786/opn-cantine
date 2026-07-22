import { TransactionEntity, TransactionItem } from '@/lib/domain/entities/transaction.entity';
import { ITransactionRepository } from '@/lib/domain/ports/transaction.repository.port';

export class TransactionApplicationService {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async logTransaction(cardNumber: string, items: TransactionItem[], totalAmount: number) {
    const transaction = TransactionEntity.create(cardNumber, items, totalAmount);
    return this.transactionRepository.save(transaction);
  }

  async getAll() {
    return this.transactionRepository.findAll();
  }

  async getByCardNumber(cardNumber: string) {
    return this.transactionRepository.findByCardNumber(cardNumber);
  }
}
