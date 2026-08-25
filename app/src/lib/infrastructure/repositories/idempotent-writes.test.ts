import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { productRepository } from '@/lib/infrastructure/repositories/product.repository.mongo';
import { employeeRepository } from '@/lib/infrastructure/repositories/employee.repository.mongo';
import {
  startTestDb,
  stopTestDb,
  resetCollections,
  seedProduct,
  seedEmployee,
  readQuantity,
  readTab,
  products,
} from '@/test/db';

/**
 * These cover the primitives the whole no-drift guarantee rests on. They run
 * against a real MongoDB because the guarantee *is* the atomicity of a single
 * conditional update; a fake repository would only test itself.
 */
beforeAll(() => startTestDb('cantine_repo_tests'));
afterAll(() => stopTestDb());
beforeEach(() => resetCollections());

describe('decrementQuantityOnce', () => {
  beforeEach(() =>
    seedProduct({ id: 'p1', barcodes: ['b1'], name: 'Chips', price: 2, quantity: 10 })
  );

  it('decrements stock and reports what it applied', async () => {
    const outcome = await productRepository.decrementQuantityOnce('p1', 3, 'sale-0001');

    expect(outcome).toMatchObject({ requested: 3, applied: 3, alreadyApplied: false });
    expect(await readQuantity('p1')).toBe(7);
  });

  it('applies a repeated sale id only once', async () => {
    await productRepository.decrementQuantityOnce('p1', 3, 'sale-0001');
    const replay = await productRepository.decrementQuantityOnce('p1', 3, 'sale-0001');

    expect(replay).toMatchObject({ applied: 3, alreadyApplied: true });
    expect(await readQuantity('p1')).toBe(7);
  });

  it('survives a burst of concurrent duplicates', async () => {
    await Promise.all(
      Array.from({ length: 25 }, () =>
        productRepository.decrementQuantityOnce('p1', 2, 'sale-0001')
      )
    );

    expect(await readQuantity('p1')).toBe(8);
  });

  it('applies distinct sale ids independently without losing updates', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        productRepository.decrementQuantityOnce('p1', 1, `sale-${String(i).padStart(4, '0')}`)
      )
    );

    expect(await readQuantity('p1')).toBe(0);
  });

  it('lets stock go negative rather than silently clamping an oversell', async () => {
    const outcome = await productRepository.decrementQuantityOnce('p1', 14, 'sale-0001');

    // Clamping here is what used to create permanent drift: the transaction
    // recorded 14 units sold while only 10 ever left the stock count.
    expect(outcome?.applied).toBe(14);
    expect(await readQuantity('p1')).toBe(-4);
  });

  it('treats a missing quantity field as zero instead of producing null', async () => {
    await (await products()).updateOne({ _id: 'p1' }, { $unset: { quantity: '' } });

    const outcome = await productRepository.decrementQuantityOnce('p1', 2, 'sale-0002');

    expect(outcome?.applied).toBe(2);
    expect(await readQuantity('p1')).toBe(-2);
  });

  it('returns null for a product that does not exist', async () => {
    expect(await productRepository.decrementQuantityOnce('nope', 1, 'sale-0001')).toBeNull();
  });
});

describe('applyTabChargeOnce', () => {
  beforeEach(() => seedEmployee({ cardNumber: 'c1', employeeNumber: 'E1' }));

  it('charges the tab and reports the new balance', async () => {
    const outcome = await employeeRepository.applyTabChargeOnce('c1', 7.5, 'sale-0001');

    expect(outcome).toMatchObject({ alreadyApplied: false });
    expect(outcome?.employee.tab).toBe(7.5);
    expect(await readTab('c1')).toBe(7.5);
  });

  it('charges a repeated sale id only once', async () => {
    await employeeRepository.applyTabChargeOnce('c1', 7.5, 'sale-0001');
    const replay = await employeeRepository.applyTabChargeOnce('c1', 7.5, 'sale-0001');

    expect(replay).toMatchObject({ alreadyApplied: true });
    expect(await readTab('c1')).toBe(7.5);
  });

  it('survives a burst of concurrent duplicates', async () => {
    await Promise.all(
      Array.from({ length: 25 }, () =>
        employeeRepository.applyTabChargeOnce('c1', 3, 'sale-0001')
      )
    );

    expect(await readTab('c1')).toBe(3);
  });

  it('does not lose concurrent charges from distinct sales', async () => {
    // The previous read-modify-write implementation lost updates here.
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        employeeRepository.applyTabChargeOnce('c1', 1, `sale-${String(i).padStart(4, '0')}`)
      )
    );

    expect(await readTab('c1')).toBe(20);
  });

  it('returns null for an unknown card', async () => {
    expect(await employeeRepository.applyTabChargeOnce('nope', 1, 'sale-0001')).toBeNull();
  });

  it('never leaks idempotency bookkeeping into the returned employee', async () => {
    await employeeRepository.applyTabChargeOnce('c1', 1, 'sale-0001');
    const employee = await employeeRepository.findByCardNumber('c1');

    expect(Object.keys(employee ?? {}).sort()).toEqual([
      'cardNumber',
      'employeeNumber',
      'tab',
    ]);
  });
});
