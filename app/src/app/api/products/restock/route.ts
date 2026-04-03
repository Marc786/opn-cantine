import { NextRequest, NextResponse } from 'next/server';
import { ProductApplicationService } from '@/lib/application/services/product.application.service';
import { productRepository } from '@/lib/infrastructure/repositories/product.repository.mongo';
import {
  verifyAdminRequest,
  unauthorizedResponse,
} from '@/lib/infrastructure/auth/admin-token';

const service = new ProductApplicationService(productRepository);

export async function POST(request: NextRequest) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  const body = await request.json();
  const { updates } = body;

  if (!updates || !Array.isArray(updates)) {
    return NextResponse.json(
      { error: 'updates array is required' },
      { status: 400 }
    );
  }

  const results = await service.bulkRestock(updates);
  return NextResponse.json({ results });
}
