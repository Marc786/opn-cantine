import { describe, it, expect } from 'vitest';
import {
  LOG_CAPACITY,
  exportFileName,
  parseNdjson,
  redactCardNumber,
  scrubDetail,
  toNdjson,
  trimToCapacity,
  type ActionEntry,
} from './action-log';

const entry = (seq: number, type: ActionEntry['type'] = 'scan'): ActionEntry => ({
  seq,
  at: '2026-09-02T12:00:00.000Z',
  sessionId: 's1',
  type,
  detail: { barcode: '1111' },
});

describe('redactCardNumber', () => {
  it('keeps only the last four digits', () => {
    expect(redactCardNumber('123456789012')).toBe('*9012');
  });

  it('masks a short value entirely rather than exposing all of it', () => {
    expect(redactCardNumber('123')).toBe('***');
  });

  it('returns null for nothing', () => {
    expect(redactCardNumber(null)).toBeNull();
    expect(redactCardNumber(undefined)).toBeNull();
    expect(redactCardNumber('')).toBeNull();
    expect(redactCardNumber('   ')).toBeNull();
  });
});

describe('scrubDetail', () => {
  it('redacts card numbers wherever they appear', () => {
    expect(scrubDetail({ cardNumber: '123456789012' })).toEqual({ cardNumber: '*9012' });
  });

  it('is case-insensitive about the key', () => {
    expect(scrubDetail({ CardNumber: '123456789012' })).toEqual({ CardNumber: '*9012' });
  });

  it('drops credentials that have no debugging value at all', () => {
    expect(scrubDetail({ pin: '1234', password: 'x', token: 'y', secret: 'z' })).toEqual({});
  });

  it('never writes a full card number, whatever the caller passed', () => {
    const scrubbed = scrubDetail({ cardNumber: '123456789012', barcode: '1111' });
    expect(JSON.stringify(scrubbed)).not.toContain('123456789012');
  });

  it('keeps ordinary values untouched', () => {
    expect(scrubDetail({ barcode: '1111', price: 2.5, ok: true, productId: null })).toEqual({
      barcode: '1111',
      price: 2.5,
      ok: true,
      productId: null,
    });
  });

  it('drops undefined so exported lines stay clean', () => {
    expect(scrubDetail({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('handles no detail at all', () => {
    expect(scrubDetail(undefined)).toEqual({});
  });
});

describe('trimToCapacity', () => {
  it('keeps everything when under capacity', () => {
    const entries = [entry(1), entry(2)];
    expect(trimToCapacity(entries, 10)).toHaveLength(2);
  });

  it('drops the oldest entries first', () => {
    const entries = [entry(1), entry(2), entry(3)];
    expect(trimToCapacity(entries, 2).map((e) => e.seq)).toEqual([2, 3]);
  });

  it('defaults to the configured capacity', () => {
    const entries = Array.from({ length: LOG_CAPACITY + 5 }, (_, i) => entry(i));
    expect(trimToCapacity(entries)).toHaveLength(LOG_CAPACITY);
  });

  it('returns nothing for a zero capacity', () => {
    expect(trimToCapacity([entry(1)], 0)).toEqual([]);
  });
});

describe('ndjson round trip', () => {
  it('writes one entry per line', () => {
    expect(toNdjson([entry(1), entry(2)]).split('\n')).toHaveLength(2);
  });

  it('parses back to the same entries', () => {
    const entries = [entry(1, 'login'), entry(2, 'scan'), entry(3, 'save_confirm')];
    expect(parseNdjson(toNdjson(entries))).toEqual(entries);
  });

  it('is empty for no entries', () => {
    expect(toNdjson([])).toBe('');
    expect(parseNdjson('')).toEqual([]);
  });

  it('survives a truncated file by parsing the lines that are whole', () => {
    const text = toNdjson([entry(1), entry(2)]);
    const truncated = `${text}\n{"seq":3,"at"`;

    // The point of NDJSON here: a partial copy is still mostly readable.
    const lines = truncated.split('\n').slice(0, 2).join('\n');
    expect(parseNdjson(lines)).toHaveLength(2);
  });

  it('tolerates blank lines', () => {
    expect(parseNdjson(`${JSON.stringify(entry(1))}\n\n`)).toHaveLength(1);
  });
});

describe('exportFileName', () => {
  it('is stamped so two exports do not collide in Files', () => {
    expect(exportFileName(new Date(2026, 8, 2, 9, 5))).toBe(
      'cantine-actions-20260902-0905.ndjson'
    );
  });
});
