import { NextRequest, NextResponse } from 'next/server';
import { ProductApplicationService } from '@/lib/application/services/product.application.service';
import { productRepository } from '@/lib/infrastructure/repositories/product.repository.mongo';
import {
  verifyAdminRequest,
  unauthorizedResponse,
} from '@/lib/infrastructure/auth/admin-token';

const service = new ProductApplicationService(productRepository);

export async function GET(request: NextRequest) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  const products = await service.getAll();
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  const body = await request.json();
  const { barcodes, name, price, quantity } = body;

  if (!barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
    return NextResponse.json(
      { error: 'At least one barcode is required' },
      { status: 400 }
    );
  }

  if (!name || typeof name !== 'string') {
    return NextResponse.json(
      { error: 'Product name is required' },
      { status: 400 }
    );
  }

  if (typeof price !== 'number' || price < 0) {
    return NextResponse.json(
      { error: 'Valid price is required' },
      { status: 400 }
    );
  }

  if (typeof quantity !== 'number' || quantity < 0) {
    return NextResponse.json(
      { error: 'Valid quantity is required' },
      { status: 400 }
    );
  }

  try {
    const product = await service.createProduct(barcodes, name, price, quantity);
    return NextResponse.json(product, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
