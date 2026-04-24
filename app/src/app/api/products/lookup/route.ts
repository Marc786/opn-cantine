import { NextRequest, NextResponse } from 'next/server';
import { ProductApplicationService } from '@/lib/application/services/product.application.service';
import { productRepository } from '@/lib/infrastructure/repositories/product.repository.mongo';

const service = new ProductApplicationService(productRepository);

export async function GET(request: NextRequest) {
  const barcode = request.nextUrl.searchParams.get('barcode');

  if (!barcode) {
    return NextResponse.json(
      { error: 'barcode is required' },
      { status: 400 }
    );
  }

  const product = await service.lookupByBarcode(barcode);

  if (!product) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({ found: true, product });
}
