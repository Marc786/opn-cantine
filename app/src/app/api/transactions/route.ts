import { NextRequest, NextResponse } from 'next/server';
import { TransactionApplicationService } from '@/lib/application/services/transaction.application.service';
import { transactionRepository } from '@/lib/infrastructure/repositories/transaction.repository.mongo';
import { productRepository } from '@/lib/infrastructure/repositories/product.repository.mongo';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/infrastructure/auth/admin-token';

const service = new TransactionApplicationService(transactionRepository);

// Quick-add buttons (coffee, event tickets) use synthetic barcodes like
// `_cafe_` / `_event_`. They are billed but not inventory-tracked.
const INTERNAL_BARCODE_PREFIX = '_';

type InventoryIssueReason = 'product_not_found' | 'insufficient_stock' | 'decrement_failed';

interface InventoryIssue {
  barcode: string;
  name?: string;
  requested: number;
  applied: number;
  reason: InventoryIssueReason;
  message?: string;
}

/**
 * Decrements stock for every inventory-tracked line of a transaction.
 * Runs sequentially so two lines resolving to the same product cannot race,
 * and returns every discrepancy rather than swallowing it.
 */
async function applyInventoryDecrements(
  items: { barcode?: unknown; name?: unknown; quantity?: unknown }[]
): Promise<InventoryIssue[]> {
  const issues: InventoryIssue[] = [];

  for (const item of items) {
    const barcode = typeof item.barcode === 'string' ? item.barcode.trim() : '';
    if (!barcode || barcode.startsWith(INTERNAL_BARCODE_PREFIX)) continue;

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;

    const name = typeof item.name === 'string' ? item.name : undefined;

    try {
      const product = await productRepository.findByBarcode(barcode);
      if (!product) {
        issues.push({ barcode, name, requested: quantity, applied: 0, reason: 'product_not_found' });
        continue;
      }

      const outcome = await productRepository.decrementQuantity(product.id, quantity);
      if (!outcome) {
        issues.push({ barcode, name, requested: quantity, applied: 0, reason: 'product_not_found' });
        continue;
      }

      if (outcome.applied < outcome.requested) {
        issues.push({
          barcode,
          name: outcome.product.name,
          requested: outcome.requested,
          applied: outcome.applied,
          reason: 'insufficient_stock',
        });
      }
    } catch (error: unknown) {
      issues.push({
        barcode,
        name,
        requested: quantity,
        applied: 0,
        reason: 'decrement_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return issues;
}

export async function GET(request: NextRequest) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');

    // Paginated mode
    if (pageParam !== null) {
      const page = Math.max(1, parseInt(pageParam) || 1);
      const cardNumber = searchParams.get('cardNumber') ?? undefined;
      const itemsParam = searchParams.get('items');
      const items = itemsParam ? itemsParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

      const result = await service.getPaginated(page, cardNumber, items);
      return NextResponse.json(result);
    }

    // Legacy mode (no pagination param) — keep backward compat
    const transactions = await service.getAll();
    return NextResponse.json(transactions.slice(0, 50));
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardNumber, items, totalAmount } = body;

    if (!cardNumber || typeof totalAmount !== 'number' || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Invalid transaction payload' },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json({ success: true, message: 'No items to log' });
    }

    const result = await service.logTransaction(cardNumber, items, totalAmount);

    // Inventory is decremented in the same request that logs the transaction so
    // the two can never diverge from a lost client-side call. Any item that
    // could not be fully decremented is reported instead of silently ignored.
    const inventoryIssues = await applyInventoryDecrements(items);

    if (inventoryIssues.length > 0) {
      console.error('[transactions] inventory drift detected', {
        transactionId: result.id,
        cardNumber,
        issues: inventoryIssues,
      });
    }

    return NextResponse.json({ success: true, transaction: result, inventoryIssues });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
