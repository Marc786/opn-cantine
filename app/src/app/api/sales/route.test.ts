import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  startTestDb,
  stopTestDb,
  resetCollections,
  seedProduct,
  seedEmployee,
  readQuantity,
  readTab,
  countTransactions,
} from '@/test/db';
import { POST } from './route';

const CARD = '000000000000';

beforeAll(() => startTestDb('cantine_sales_route_tests'));
afterAll(() => stopTestDb());

beforeEach(async () => {
  await resetCollections();
  await seedProduct({ id: 'p1', barcodes: ['1111'], name: 'Chips', price: 2.5, quantity: 10 });
  await seedEmployee({ cardNumber: CARD, employeeNumber: 'E1' });
});

async function postSale(body: unknown) {
  const response = await POST(
    new NextRequest('http://localhost/api/sales', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
  );
  return { status: response.status, body: await response.json() };
}

const chips = (quantity: number) => ({
  barcode: '1111',
  name: 'Chips',
  price: 2.5,
  quantity,
  productId: 'p1',
});

describe('POST /api/sales total validation', () => {
  it('records a sale whose total matches its lines', async () => {
    const { status } = await postSale({
      saleId: 'sale-0001',
      cardNumber: CARD,
      items: [chips(2)],
      totalAmount: 5,
    });

    expect(status).toBe(200);
    expect(await readTab(CARD)).toBe(5);
    expect(await readQuantity('p1')).toBe(8);
  });

  it('refuses a total that disagrees with its lines, and moves nothing', async () => {
    const { status, body } = await postSale({
      saleId: 'sale-0002',
      cardNumber: CARD,
      items: [chips(2)],
      totalAmount: 25,
    });

    expect(status).toBe(400);
    expect(body.itemsTotal).toBe(5);

    // Nothing may move on a rejected sale — no ledger row, no tab, no stock.
    expect(await countTransactions()).toBe(0);
    expect(await readTab(CARD)).toBe(0);
    expect(await readQuantity('p1')).toBe(10);
  });

  it('refuses a total that undercharges the lines', async () => {
    const { status } = await postSale({
      saleId: 'sale-0003',
      cardNumber: CARD,
      items: [chips(4)],
      totalAmount: 1,
    });

    expect(status).toBe(400);
    expect(await countTransactions()).toBe(0);
  });

  it('tolerates sub-cent float drift in the submitted total', async () => {
    const { status } = await postSale({
      saleId: 'sale-0004',
      cardNumber: CARD,
      items: [chips(3)],
      totalAmount: 7.5 + 0.000001,
    });

    expect(status).toBe(200);
  });

  it('accepts two distinct events as separate lines', async () => {
    // The kiosk must not fold these together: same barcode, different price.
    const { status } = await postSale({
      saleId: 'sale-0005',
      cardNumber: CARD,
      items: [
        { barcode: '_event_', name: 'BBQ', price: 5, quantity: 1, productId: null },
        { barcode: '_event_', name: 'Gala', price: 20, quantity: 1, productId: null },
      ],
      totalAmount: 25,
    });

    expect(status).toBe(200);
    expect(await readTab(CARD)).toBe(25);
  });

  it('rejects the folded-event payload the old cart produced', async () => {
    const { status } = await postSale({
      saleId: 'sale-0006',
      cardNumber: CARD,
      items: [{ barcode: '_event_', name: 'BBQ', price: 5, quantity: 2, productId: null }],
      totalAmount: 25,
    });

    expect(status).toBe(400);
    expect(await readTab(CARD)).toBe(0);
  });
});
