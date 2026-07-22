import { NextRequest, NextResponse } from 'next/server';
import { TransactionApplicationService } from '@/lib/application/services/transaction.application.service';
import { transactionRepository } from '@/lib/infrastructure/repositories/transaction.repository.mongo';

const service = new TransactionApplicationService(transactionRepository);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cardNumber: string }> }
) {
  try {
    const { cardNumber } = await params;

    if (!cardNumber) {
      return NextResponse.json({ error: 'Card number required' }, { status: 400 });
    }

    const transactions = await service.getByCardNumber(cardNumber);
    return NextResponse.json(transactions);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
