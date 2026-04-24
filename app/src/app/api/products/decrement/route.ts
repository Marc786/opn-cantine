import { NextRequest, NextResponse } from 'next/server';
import { ProductApplicationService } from '@/lib/application/services/product.application.service';
import { productRepository } from '@/lib/infrastructure/repositories/product.repository.mongo';

const service = new ProductApplicationService(productRepository);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { items } = body;

  if (!items || !Array.isArray(items)) {
    return NextResponse.json(
      { error: 'items array is required' },
      { status: 400 }
    );
  }

  const results = [];
  for (const item of items) {
    const { barcode, quantity } = item;
    if (!barcode || !quantity || quantity < 1) continue;

    const product = await service.lookupByBarcode(barcode);
    if (product) {
      const updated = await service.decrementQuantity(product.id, quantity);
      results.push(updated);
    }
  }

  return NextResponse.json({ results });
}
