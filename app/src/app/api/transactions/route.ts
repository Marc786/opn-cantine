import { NextRequest, NextResponse } from 'next/server';
import { TransactionApplicationService } from '@/lib/application/services/transaction.application.service';
import { transactionRepository } from '@/lib/infrastructure/repositories/transaction.repository.mongo';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/infrastructure/auth/admin-token';

const service = new TransactionApplicationService(transactionRepository);

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
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

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

    // Sales must go through POST /api/sales, which charges the tab and
    // decrements stock in the same idempotent unit of work. This path only
    // remains for admin backfills and deliberately touches neither.
    const result = await service.logTransaction(cardNumber, items, totalAmount);

    return NextResponse.json({ success: true, transaction: result });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
