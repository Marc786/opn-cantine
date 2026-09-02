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
import { CASH_CARD_NUMBER } from '@/lib/domain/constants';

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

describe('POST /api/sales for a cash payment', () => {
  it('records the sale and decrements stock with no admin session', async () => {
    // The kiosk has no admin cookie. Cash previously posted to
    // /api/transactions, which demands one — so every cash sale 401'd and was
    // dropped silently, and the stock was never decremented either way.
    const { status, body } = await postSale({
      saleId: 'cash-sale-0001',
      cardNumber: CASH_CARD_NUMBER,
      totalAmount: 5,
      items: [chips(2)],
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.employee).toBeNull();
    expect(await readQuantity('p1')).toBe(8);
    expect(await countTransactions()).toBe(1);
  });

  it('leaves every employee tab untouched', async () => {
    await postSale({
      saleId: 'cash-sale-0002',
      cardNumber: CASH_CARD_NUMBER,
      totalAmount: 2.5,
      items: [chips(1)],
    });

    expect(await readTab(CARD)).toBe(0);
  });

  it('still rejects a cash total that disagrees with its items', async () => {
    const { status } = await postSale({
      saleId: 'cash-sale-0003',
      cardNumber: CASH_CARD_NUMBER,
      totalAmount: 99,
      items: [chips(1)],
    });

    expect(status).toBe(400);
    expect(await readQuantity('p1')).toBe(10);
  });
});
