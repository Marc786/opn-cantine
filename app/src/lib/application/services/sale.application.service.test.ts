import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { SaleApplicationService, EmployeeNotFoundError } from './sale.application.service';
import { transactionRepository } from '@/lib/infrastructure/repositories/transaction.repository.mongo';
import { employeeRepository } from '@/lib/infrastructure/repositories/employee.repository.mongo';
import { productRepository } from '@/lib/infrastructure/repositories/product.repository.mongo';
import { TransactionItem } from '@/lib/domain/entities/transaction.entity';
import { CASH_CARD_NUMBER } from '@/lib/domain/constants';
import {
  startTestDb,
  stopTestDb,
  resetCollections,
  seedProduct,
  seedEmployee,
  readQuantity,
  readTab,
  countTransactions,
  unitsRemovedPerProduct,
} from '@/test/db';

const service = new SaleApplicationService(
  transactionRepository,
  employeeRepository,
  productRepository
);

const CARD = 'card-1';

const line = (over: Partial<TransactionItem> & { barcode: string }): TransactionItem => ({
  name: 'Item',
  price: 1,
  quantity: 1,
  productId: null,
  ...over,
});

const sell = (items: TransactionItem[], total: number, saleId = randomUUID(), card = CARD) =>
  service.recordSale(saleId, card, items, total);

beforeAll(() => startTestDb('cantine_sale_tests'));
afterAll(() => stopTestDb());

beforeEach(async () => {
  await resetCollections();
  await seedProduct({ id: 'p-chips', barcodes: ['b-chips'], name: 'Chips', price: 2, quantity: 10 });
  await seedProduct({ id: 'p-soda', barcodes: ['b-soda'], name: 'Soda', price: 3, quantity: 2 });
  await seedProduct({ id: 'p-bar', barcodes: ['b-bar-1', 'b-bar-2'], name: 'Bar', price: 4, quantity: 8 });
  await seedEmployee({ cardNumber: CARD, employeeNumber: 'E1' });
});

describe('recording a sale', () => {
  it('writes the transaction, charges the tab and decrements stock together', async () => {
    const result = await sell(
      [line({ barcode: 'b-chips', name: 'Chips', price: 2, quantity: 3, productId: 'p-chips' })],
      6
    );

    expect(result.replayed).toBe(false);
    expect(result.issues).toEqual([]);
    expect(await readQuantity('p-chips')).toBe(7);
    expect(await readTab(CARD)).toBe(6);
    expect(await countTransactions()).toBe(1);
  });

  it('marks a fully applied sale as settled', async () => {
    const result = await sell(
      [line({ barcode: 'b-chips', quantity: 1, productId: 'p-chips' })],
      2
    );

    expect(result.transaction.settled).toBe(true);
    const stored = await transactionRepository.findById(result.transaction.id!);
    expect(stored?.settled).toBe(true);
    expect(stored?.tabApplied).toBe(true);
  });

  it('refuses an unknown card without recording or moving anything', async () => {
    await expect(
      sell([line({ barcode: 'b-chips', productId: 'p-chips' })], 2, randomUUID(), 'ghost-card')
    ).rejects.toBeInstanceOf(EmployeeNotFoundError);

    expect(await countTransactions()).toBe(0);
    expect(await readQuantity('p-chips')).toBe(10);
  });
});

describe('idempotency', () => {
  it('applies a repeated saleId exactly once', async () => {
    const saleId = randomUUID();
    const items = [line({ barcode: 'b-chips', quantity: 3, price: 2, productId: 'p-chips' })];

    const first = await sell(items, 6, saleId);
    const second = await sell(items, 6, saleId);
    const third = await sell(items, 6, saleId);

    expect([first.replayed, second.replayed, third.replayed]).toEqual([false, true, true]);
    expect(await readQuantity('p-chips')).toBe(7);
    expect(await readTab(CARD)).toBe(6);
    expect(await countTransactions()).toBe(1);
  });

  it('survives concurrent duplicate submissions of one cart', async () => {
    const saleId = randomUUID();
    const items = [line({ barcode: 'b-bar-1', quantity: 2, price: 4, productId: 'p-bar' })];

    await Promise.all(Array.from({ length: 12 }, () => sell(items, 8, saleId)));

    expect(await readQuantity('p-bar')).toBe(6);
    expect(await readTab(CARD)).toBe(8);
    expect(await countTransactions()).toBe(1);
  });

  it('keeps distinct concurrent sales independent', async () => {
    await Promise.all(
      Array.from({ length: 10 }, () =>
        sell([line({ barcode: 'b-chips', quantity: 1, price: 2, productId: 'p-chips' })], 2)
      )
    );

    expect(await readQuantity('p-chips')).toBe(0);
    expect(await readTab(CARD)).toBe(20);
    expect(await countTransactions()).toBe(10);
  });

  it('settles a replay against the recorded cart, not a mutated payload', async () => {
    const saleId = randomUUID();
    await sell([line({ barcode: 'b-chips', quantity: 1, price: 2, productId: 'p-chips' })], 2, saleId);

    // A retry that somehow carries different contents must not apply them.
    await sell([line({ barcode: 'b-soda', quantity: 2, price: 3, productId: 'p-soda' })], 6, saleId);

    expect(await readQuantity('p-chips')).toBe(9);
    expect(await readQuantity('p-soda')).toBe(2);
    expect(await readTab(CARD)).toBe(2);
  });
});

describe('multi-barcode products', () => {
  // Regression: the exactly-once guard is keyed by saleId, so two lines
  // resolving to one product used to make the second look like a replay and
  // silently skip its units.
  it('sums lines that resolve to the same product', async () => {
    await sell(
      [
        line({ barcode: 'b-bar-1', name: 'Bar', price: 4, quantity: 2, productId: 'p-bar' }),
        line({ barcode: 'b-bar-2', name: 'Bar', price: 4, quantity: 3, productId: 'p-bar' }),
      ],
      20
    );

    expect(await readQuantity('p-bar')).toBe(3);
  });

  it('sums them even when only barcodes identify the product', async () => {
    await sell(
      [
        line({ barcode: 'b-bar-1', name: 'Bar', price: 4, quantity: 1 }),
        line({ barcode: 'b-bar-2', name: 'Bar', price: 4, quantity: 4 }),
      ],
      20
    );

    expect(await readQuantity('p-bar')).toBe(3);
  });
});

describe('reporting instead of silent skipping', () => {
  it('records an oversell truthfully and warns rather than clamping', async () => {
    const result = await sell(
      [line({ barcode: 'b-soda', name: 'Soda', price: 3, quantity: 5, productId: 'p-soda' })],
      15
    );

    expect(await readQuantity('p-soda')).toBe(-3);
    expect(result.issues).toEqual([]);
    expect(result.warnings.map((w) => w.status)).toEqual(['oversold']);
    expect(result.inventory[0].applied).toBe(5);
  });

  it('reports a missing product instead of swallowing it', async () => {
    const result = await sell([line({ barcode: 'b-ghost', name: 'Ghost', quantity: 2 })], 2);

    expect(result.issues.map((i) => i.status)).toEqual(['product_not_found']);
    expect(result.transaction.settled).toBe(false);
    expect(await countTransactions()).toBe(1);
  });

  it('still decrements when a barcode was edited after the sale', async () => {
    await productRepository.update('p-chips', { barcodes: ['b-renamed'] });

    const result = await sell(
      [line({ barcode: 'b-chips', quantity: 2, price: 2, productId: 'p-chips' })],
      4
    );

    expect(result.issues).toEqual([]);
    expect(await readQuantity('p-chips')).toBe(8);
  });

  it('bills quick-add items without touching inventory', async () => {
    const result = await sell(
      [
        line({ barcode: '_cafe_', name: 'Cafe', price: 1, quantity: 2 }),
        line({ barcode: '_event_', name: 'Billet', price: 5, quantity: 1 }),
      ],
      7
    );

    expect(await readTab(CARD)).toBe(7);
    expect(result.issues).toEqual([]);
    expect(result.inventory.map((l) => l.status)).toEqual(['not_tracked', 'not_tracked']);
  });
});

describe('reconciliation under load', () => {
  it('keeps stock, tab and ledger in agreement across randomised concurrent sales', async () => {
    const catalog = [
      { id: 'p-chips', barcodes: ['b-chips'], price: 2 },
      { id: 'p-soda', barcodes: ['b-soda'], price: 3 },
      { id: 'p-bar', barcodes: ['b-bar-1', 'b-bar-2'], price: 4 },
    ];
    const opening = {
      'p-chips': await readQuantity('p-chips'),
      'p-soda': await readQuantity('p-soda'),
      'p-bar': await readQuantity('p-bar'),
    };

    const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const carts = Array.from({ length: 60 }, () => {
      const items: TransactionItem[] = [];
      for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) {
        if (Math.random() < 0.2) {
          items.push(line({ barcode: pick(['_cafe_', '_event_']), price: 1, quantity: 1 }));
          continue;
        }
        const product = pick(catalog);
        items.push(
          line({
            barcode: pick(product.barcodes),
            price: product.price,
            quantity: 1 + Math.floor(Math.random() * 3),
            // exercise both the productId path and the barcode fallback
            productId: Math.random() < 0.7 ? product.id : null,
          })
        );
      }
      const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
      // a third of the carts are submitted more than once, as retries would
      const attempts = Math.random() < 0.33 ? 2 + Math.floor(Math.random() * 2) : 1;
      return { saleId: randomUUID(), items, total, attempts };
    });

    await Promise.all(
      carts.flatMap((cart) =>
        Array.from({ length: cart.attempts }, () => sell(cart.items, cart.total, cart.saleId))
      )
    );

    expect(await countTransactions()).toBe(carts.length);

    const removedPerLedger = await unitsRemovedPerProduct();
    for (const [productId, openingQty] of Object.entries(opening)) {
      const removedFromStock = openingQty - (await readQuantity(productId));
      expect(removedFromStock).toBe(removedPerLedger[productId] ?? 0);
    }

    const expectedTab = carts.reduce((sum, cart) => sum + cart.total, 0);
    expect(await readTab(CARD)).toBeCloseTo(expectedTab, 6);
  });
});

describe('cash sales', () => {
  const cash = (items: TransactionItem[], total: number, saleId = randomUUID()) =>
    service.recordSale(saleId, CASH_CARD_NUMBER, items, total);

  it('decrements stock even though no employee owns the sale', async () => {
    // The bug this guards: cash used to post to /api/transactions, which
    // records the sale but never touches stock — silent inventory drift.
    const result = await cash(
      [line({ barcode: 'b-chips', name: 'Chips', price: 2, quantity: 3, productId: 'p-chips' })],
      6
    );

    expect(result.issues).toEqual([]);
    expect(await readQuantity('p-chips')).toBe(7);
    expect(await countTransactions()).toBe(1);
  });

  it('charges no tab and reports no employee', async () => {
    const result = await cash([line({ barcode: 'b-soda', price: 3, productId: 'p-soda' })], 3);

    expect(result.employee).toBeNull();
    expect(result.transaction.tabApplied).toBe(false);
  });

  it('does not need a seeded employee for the cash card', async () => {
    await expect(
      cash([line({ barcode: 'b-chips', price: 2, productId: 'p-chips' })], 2)
    ).resolves.toBeDefined();
  });

  it('applies stock exactly once when a cash sale is retried', async () => {
    const saleId = randomUUID();
    const items = [line({ barcode: 'b-chips', price: 2, quantity: 2, productId: 'p-chips' })];

    await cash(items, 4, saleId);
    const replay = await cash(items, 4, saleId);

    expect(replay.replayed).toBe(true);
    expect(await readQuantity('p-chips')).toBe(8);
    expect(await countTransactions()).toBe(1);
    expect(await unitsRemovedPerProduct()).toEqual({ 'p-chips': 2 });
  });

  it('still refuses an unknown employee card', async () => {
    await expect(
      service.recordSale(randomUUID(), 'nobody', [line({ barcode: 'b-chips' })], 1)
    ).rejects.toBeInstanceOf(EmployeeNotFoundError);
  });
});
