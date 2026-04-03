import { NextRequest, NextResponse } from 'next/server';
import { ProductApplicationService } from '@/lib/application/services/product.application.service';
import { productRepository } from '@/lib/infrastructure/repositories/product.repository.mongo';
import {
  verifyAdminRequest,
  unauthorizedResponse,
} from '@/lib/infrastructure/auth/admin-token';

const service = new ProductApplicationService(productRepository);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const { name, price, quantity, barcodes } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (price !== undefined) updates.price = price;
  if (quantity !== undefined) updates.quantity = quantity;
  if (barcodes !== undefined) updates.barcodes = barcodes;

  const product = await service.updateProduct(id, updates);

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  const { id } = await params;
  const deleted = await service.deleteProduct(id);

  if (!deleted) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
