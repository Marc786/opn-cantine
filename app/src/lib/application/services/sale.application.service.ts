import {
  InventoryLine,
  Transaction,
  TransactionEntity,
  TransactionItem,
} from '@/lib/domain/entities/transaction.entity';
import { ITransactionRepository } from '@/lib/domain/ports/transaction.repository.port';
import { IEmployeeRepository } from '@/lib/domain/ports/employee.repository.port';
import { IProductRepository } from '@/lib/domain/ports/product.repository.port';
import { isInventoryTracked } from '@/lib/domain/inventory-rules';
import { isCashSale } from '@/lib/domain/constants';

export interface SaleResult {
  transaction: Transaction;
  /** Null for a cash sale, which charges no tab because nobody owns it. */
  employee: { cardNumber: string; employeeNumber: string; tab: number } | null;
  inventory: InventoryLine[];
  /** Lines that moved no stock despite being sold. Empty means zero drift. */
  issues: InventoryLine[];
  /** Lines applied in full but leaving negative stock, i.e. a restock is due. */
  warnings: InventoryLine[];
  /** True when this call was a retry of an already-recorded sale. */
  replayed: boolean;
}

/** A line only counts as drift when stock did not move for a sold item. */
function isDrift(line: InventoryLine): boolean {
  return line.status === 'product_not_found' || line.status === 'failed';
}

export class EmployeeNotFoundError extends Error {
  constructor(cardNumber: string) {
    super(`No employee found for card ${cardNumber}`);
    this.name = 'EmployeeNotFoundError';
  }
}

/**
 * Records a sale as a single exactly-once unit of work.
 *
 * The ledger row is written *first* and keyed by the client-generated sale id,
 * so no money or stock can ever move without a transaction to account for it.
 * Every side effect afterwards is an atomic conditional update guarded by that
 * same sale id, which makes the whole operation safely retryable: replaying a
 * sale re-runs only the steps that had not been applied yet.
 */
export class SaleApplicationService {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly employeeRepository: IEmployeeRepository,
    private readonly productRepository: IProductRepository
  ) {}

  async recordSale(
    saleId: string,
    cardNumber: string,
    items: TransactionItem[],
    totalAmount: number
  ): Promise<SaleResult> {
    // A cash sale is paid on the spot, so there is no account to look up and no
    // tab to charge. The ledger entry and the stock decrement still happen, and
    // still exactly once — that is the whole point of routing cash through here.
    const cash = isCashSale(cardNumber);

    if (!cash) {
      const employee = await this.employeeRepository.findByCardNumber(cardNumber);
      if (!employee) throw new EmployeeNotFoundError(cardNumber);
    }

    const draft = TransactionEntity.create(cardNumber, items, totalAmount, saleId);
    const { created, transaction } = await this.transactionRepository.insertOnce(draft);

    // On a retry, settle against the originally recorded lines rather than
    // whatever the client just sent, so the ledger stays authoritative.
    const authoritativeItems = created ? items : transaction.items;
    const authoritativeTotal = created ? totalAmount : transaction.totalAmount;

    let charge: Awaited<
      ReturnType<IEmployeeRepository['applyTabChargeOnce']>
    > = null;
    if (!cash) {
      charge = await this.employeeRepository.applyTabChargeOnce(
        cardNumber,
        authoritativeTotal,
        saleId
      );
      if (!charge) throw new EmployeeNotFoundError(cardNumber);
    }

    const inventory = await this.applyInventory(authoritativeItems, saleId);
    const issues = inventory.filter(isDrift);
    const warnings = inventory.filter((line) => line.status === 'oversold');

    // A cash sale never charges a tab, so claiming it did would misreport it.
    const tabApplied = !cash;

    await this.transactionRepository.markSettlement(saleId, {
      tabApplied,
      inventory,
      settled: issues.length === 0,
    });

    return {
      transaction: {
        ...transaction,
        tabApplied,
        inventory,
        settled: issues.length === 0,
      },
      employee: charge ? charge.employee : null,
      inventory,
      issues,
      warnings,
      replayed: !created,
    };
  }

  /**
   * Decrements stock for every inventory-tracked line.
   *
   * Lines are grouped per product first: two cart lines can resolve to the same
   * product through different barcodes, and since the exactly-once guard is
   * keyed by sale id, they must become a single decrement of the summed
   * quantity rather than two writes where the second looks like a replay.
   */
  private async applyInventory(
    items: TransactionItem[],
    saleId: string
  ): Promise<InventoryLine[]> {
    const lines: InventoryLine[] = [];
    const grouped = new Map<
      string,
      { barcode: string; name: string; requested: number }
    >();

    for (const item of items) {
      const barcode = typeof item.barcode === 'string' ? item.barcode.trim() : '';
      const name = typeof item.name === 'string' ? item.name : barcode;
      const requested = Number(item.quantity);

      if (!isInventoryTracked(barcode) || !Number.isFinite(requested) || requested <= 0) {
        lines.push({
          barcode,
          name,
          productId: null,
          requested: Number.isFinite(requested) ? requested : 0,
          applied: 0,
          status: 'not_tracked',
        });
        continue;
      }

      try {
        // Prefer the id captured at scan time: editing or removing a barcode
        // afterwards must not orphan an already-sold line.
        const product =
          (item.productId
            ? await this.productRepository.findById(item.productId)
            : null) ?? (await this.productRepository.findByBarcode(barcode));

        if (!product) {
          lines.push({
            barcode,
            name,
            productId: item.productId ?? null,
            requested,
            applied: 0,
            status: 'product_not_found',
          });
          continue;
        }

        const existing = grouped.get(product.id);
        if (existing) existing.requested += requested;
        else grouped.set(product.id, { barcode, name: product.name, requested });
      } catch (error: unknown) {
        lines.push({
          barcode,
          name,
          productId: item.productId ?? null,
          requested,
          applied: 0,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    for (const [productId, group] of grouped) {
      try {
        const outcome = await this.productRepository.decrementQuantityOnce(
          productId,
          group.requested,
          saleId
        );

        if (!outcome) {
          lines.push({
            barcode: group.barcode,
            name: group.name,
            productId,
            requested: group.requested,
            applied: 0,
            status: 'product_not_found',
          });
          continue;
        }

        // Stock is never clamped, so an oversell shows up as a negative count
        // that an admin can see and restock, instead of hidden drift.
        const oversold = outcome.product.quantity < 0;
        lines.push({
          barcode: group.barcode,
          name: group.name,
          productId,
          requested: group.requested,
          applied: outcome.applied,
          status: oversold ? 'oversold' : 'applied',
          ...(oversold
            ? { message: `Stock is now ${outcome.product.quantity}; restock needed` }
            : {}),
        });
      } catch (error: unknown) {
        lines.push({
          barcode: group.barcode,
          name: group.name,
          productId,
          requested: group.requested,
          applied: 0,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return lines;
  }
}
