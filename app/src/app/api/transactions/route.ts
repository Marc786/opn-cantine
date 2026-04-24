import { NextRequest, NextResponse } from 'next/server';
import { TransactionApplicationService } from '@/lib/application/services/transaction.application.service';
import { transactionRepository } from '@/lib/infrastructure/repositories/transaction.repository.mongo';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/infrastructure/auth/admin-token';

const service = new TransactionApplicationService(transactionRepository);

export async function GET(request: NextRequest) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  try {
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
    const { employeeNumber, items, totalAmount } = body;

    if (!employeeNumber || typeof totalAmount !== 'number' || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Invalid transaction payload' },
        { status: 400 }
      );
    }

    // Since this endpoint is just for logging, we return successfully immediately if there are no items
    // (e.g. if the user only added a custom amount in the past, though we removed that button, we still guard)
    if (items.length === 0) {
      return NextResponse.json({ success: true, message: 'No items to log' });
    }

    const result = await service.logTransaction(employeeNumber, items, totalAmount);

    return NextResponse.json({ success: true, transaction: result });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
