import { NextRequest, NextResponse } from 'next/server';
import { ProductApplicationService } from '@/lib/application/services/product.application.service';
import { productRepository } from '@/lib/infrastructure/repositories/product.repository.mongo';
import {
  verifyAdminRequest,
  unauthorizedResponse,
} from '@/lib/infrastructure/auth/admin-token';

const service = new ProductApplicationService(productRepository);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const { barcode } = body;

  if (!barcode || typeof barcode !== 'string') {
    return NextResponse.json(
      { error: 'barcode is required' },
      { status: 400 }
    );
  }

  try {
    const product = await service.addBarcodeToProduct(id, barcode);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(product);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
