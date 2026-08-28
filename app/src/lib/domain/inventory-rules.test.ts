import { describe, it, expect } from 'vitest';
import {
  isInventoryTracked,
  isValidSaleId,
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
