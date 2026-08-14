import { TransactionEntity, TransactionItem } from '@/lib/domain/entities/transaction.entity';
import { ITransactionRepository } from '@/lib/domain/ports/transaction.repository.port';

const PAGE_SIZE = 25;

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

  async getPaginated(page: number, cardNumber?: string, items?: string[]) {
    const { data, total } = await this.transactionRepository.findPaginated({
      page,
      pageSize: PAGE_SIZE,
      cardNumber,
      items,
    });
    return {
      data,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  }

  async getDistinctItems() {
    return this.transactionRepository.findDistinctItems();
  }
}
