import { NextRequest, NextResponse } from 'next/server';
import {
  SaleApplicationService,
  EmployeeNotFoundError,
} from '@/lib/application/services/sale.application.service';
import { transactionRepository } from '@/lib/infrastructure/repositories/transaction.repository.mongo';
import { employeeRepository } from '@/lib/infrastructure/repositories/employee.repository.mongo';
import { productRepository } from '@/lib/infrastructure/repositories/product.repository.mongo';
import { TransactionItem } from '@/lib/domain/entities/transaction.entity';
import { isValidSaleId } from '@/lib/domain/inventory-rules';

const service = new SaleApplicationService(
  transactionRepository,
  employeeRepository,
  productRepository
);

function parseItems(raw: unknown): TransactionItem[] | null {
  if (!Array.isArray(raw)) return null;

  const items: TransactionItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { barcode, name, price, quantity, productId } = entry as Record<string, unknown>;

    if (typeof barcode !== 'string' || barcode.trim().length === 0) return null;
    if (typeof name !== 'string') return null;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) return null;

    items.push({
      barcode: barcode.trim(),
      name,
      price,
      quantity,
      productId: typeof productId === 'string' ? productId : null,
    });
  }
  return items;
}

/**
 * Records a sale: ledger entry, tab charge and stock decrement in one call.
 *
 * Callers must supply a stable `saleId` and may safely retry with it; the
 * operation is idempotent, so a retry can never double-charge or double
 * decrement, and no side effect happens without a transaction recording it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saleId, cardNumber, items, totalAmount } = body;

    if (!isValidSaleId(saleId)) {
      return NextResponse.json({ error: 'A valid saleId is required' }, { status: 400 });
    }
    if (typeof cardNumber !== 'string' || cardNumber.trim().length === 0) {
      return NextResponse.json({ error: 'cardNumber is required' }, { status: 400 });
    }
    if (typeof totalAmount !== 'number' || !Number.isFinite(totalAmount)) {
      return NextResponse.json({ error: 'totalAmount must be a number' }, { status: 400 });
    }

    const parsedItems = parseItems(items);
    if (parsedItems === null) {
      return NextResponse.json({ error: 'Invalid items payload' }, { status: 400 });
    }

    const result = await service.recordSale(
      saleId,
      cardNumber.trim(),
      parsedItems,
      totalAmount
    );

    if (result.issues.length > 0) {
      console.error('[sales] inventory drift detected', {
        saleId,
        cardNumber,
        issues: result.issues,
      });
    }
    if (result.warnings.length > 0) {
      console.warn('[sales] negative stock after sale', {
        saleId,
        warnings: result.warnings,
      });
    }

    return NextResponse.json({
      success: true,
      replayed: result.replayed,
      transaction: result.transaction,
      employee: result.employee,
      inventory: result.inventory,
      issues: result.issues,
      warnings: result.warnings,
    });
  } catch (error: unknown) {
    if (error instanceof EmployeeNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('[sales] failed to record sale', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
