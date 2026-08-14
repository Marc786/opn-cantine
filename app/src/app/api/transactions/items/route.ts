import { NextRequest, NextResponse } from 'next/server';
import { TransactionApplicationService } from '@/lib/application/services/transaction.application.service';
import { transactionRepository } from '@/lib/infrastructure/repositories/transaction.repository.mongo';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/infrastructure/auth/admin-token';

const service = new TransactionApplicationService(transactionRepository);

export async function GET(request: NextRequest) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  try {
    const items = await service.getDistinctItems();
    return NextResponse.json(items);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
