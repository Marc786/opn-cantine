import { describe, it, expect } from 'vitest';
import {
  isInventoryTracked,
  isValidSaleId,
  isValidInventoryQuantity,
  parseInventoryQuantity,
} from '@/lib/domain/inventory-rules';

describe('isInventoryTracked', () => {
  it('tracks ordinary scanned barcodes', () => {
    expect(isInventoryTracked('1234567890')).toBe(true);
  });

  it.each(['_cafe_', '_event_'])(
    'does not track the quick-add pseudo barcode %s',
    (barcode) => {
      expect(isInventoryTracked(barcode)).toBe(false);
    }
  );

  it('does not track an empty barcode', () => {
    expect(isInventoryTracked('')).toBe(false);
  });
});

describe('isValidSaleId', () => {
  it('accepts a uuid', () => {
    expect(isValidSaleId('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true);
  });

  it.each([
    ['too short', 'abc'],
    ['illegal characters', 'not a valid id!'],
    ['not a string', 42],
    ['missing', undefined],
  ])('rejects %s', (_label, value) => {
    expect(isValidSaleId(value)).toBe(false);
  });

  it('rejects an over-long id', () => {
    expect(isValidSaleId('a'.repeat(65))).toBe(false);
  });
});

describe('parseInventoryQuantity', () => {
  it.each([
    ['0', 0],
    ['12', 12],
    [' 7 ', 7],
  ])('accepts a completed non-negative integer %j', (value, expected) => {
    expect(parseInventoryQuantity(value)).toBe(expected);
  });

  it.each(['', ' ', '-5', '1.5', 'abc'])(
    'rejects incomplete or invalid inventory correction %j',
    (value) => {
      expect(parseInventoryQuantity(value)).toBeNull();
    }
  );
});

describe('isValidInventoryQuantity', () => {
  it.each([0, 12])('accepts %i', (quantity) => {
    expect(isValidInventoryQuantity(quantity)).toBe(true);
  });

  it.each([-1, 1.5, NaN, '4', null])('rejects %j', (quantity) => {
    expect(isValidInventoryQuantity(quantity)).toBe(false);
  });
});
