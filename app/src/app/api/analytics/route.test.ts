import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { startTestDb, stopTestDb, resetCollections, seedProduct } from '@/test/db';
import { transactionRepository } from '@/lib/infrastructure/repositories/transaction.repository.mongo';
import { createAdminToken } from '@/lib/infrastructure/auth/admin-token';
import { GET } from './route';

/**
 * The dashboard reads this payload directly, so the shape is a contract. These
 * check the wiring — the weekly maths itself is covered by revenue-stats.test.
 */
beforeAll(async () => {
  process.env.ADMIN_PIN = '1234';
  process.env.BASIC_AUTH_PASSWORD = 'test-password';
  await startTestDb('cantine_analytics_tests');
});
afterAll(() => stopTestDb());
beforeEach(() => resetCollections());

function analyticsRequest(token: string | null): NextRequest {
  return new NextRequest('http://localhost/api/analytics', {
    headers: token ? { 'x-admin-token': token } : {},
  });
}

async function callAnalytics() {
  const response = await GET(analyticsRequest(createAdminToken()));
  return { status: response.status, body: await response.json() };
}

async function recordSale(id: string, daysAgo: number, totalAmount: number) {
  const timestamp = new Date();
  timestamp.setDate(timestamp.getDate() - daysAgo);
  await transactionRepository.insertOnce({
    id,
    cardNumber: '000000000000',
    items: [{ barcode: '1', name: 'Chips', price: totalAmount, quantity: 1 }],
    totalAmount,
    timestamp,
  });
}

describe('GET /api/analytics', () => {
  it('rejects a request without a valid admin token', async () => {
    const response = await GET(analyticsRequest(null));
    expect(response.status).toBe(401);
  });

  it('reports zero average revenue when nothing has been sold', async () => {
    const { status, body } = await callAnalytics();

    expect(status).toBe(200);
    expect(body.weeklyRevenue).toEqual({ average: 0, weeksCounted: 0, partial: false });
  });

  it('averages revenue over the completed weeks it spans', async () => {
    // Four weeks back and two weeks back, both safely in completed weeks.
    await recordSale('sale-0001', 28, 100);
    await recordSale('sale-0002', 14, 50);

    const { body } = await callAnalytics();
    const { average, weeksCounted, partial } = body.weeklyRevenue;

    expect(partial).toBe(false);
    expect(weeksCounted).toBeGreaterThanOrEqual(4);
    expect(average).toBeCloseTo(150 / weeksCounted, 2);
  });

  it('ignores this week when a completed week exists', async () => {
    await recordSale('sale-0003', 14, 70);
    const baseline = (await callAnalytics()).body.weeklyRevenue;

    await recordSale('sale-0004', 0, 999);
    const withToday = (await callAnalytics()).body.weeklyRevenue;

    expect(withToday).toEqual(baseline);
  });

  it('still returns the rest of the dashboard payload', async () => {
    await seedProduct({ id: 'p1', barcodes: ['1'], name: 'Chips', price: 2, quantity: 5 });
    await recordSale('sale-0005', 3, 10);

    const { body } = await callAnalytics();

    expect(body).toHaveProperty('transactionsByDay');
    expect(body).toHaveProperty('tabHistory');
    expect(body).toHaveProperty('inventoryHistory');
    expect(body).toHaveProperty('totalUnpaidTabs');
    expect(body).toHaveProperty('weeklyRevenue');
  });
});
