import { describe, it, expect } from 'vitest';
import {
  AUTO_SUBMIT_DELAY_MS,
  MIN_BARCODE_LENGTH,
  RAPID_INPUT_THRESHOLD_MS,
  RAPID_KEYSTROKES_REQUIRED,
  isCompleteScan,
  isRapidKeystroke,
  isSubmittableBarcode,
  normaliseBarcode,
} from './barcode-scan';

describe('normaliseBarcode', () => {
  it('keeps a plain numeric code untouched', () => {
    expect(normaliseBarcode('0064420001030')).toBe('0064420001030');
  });

  it('drops everything a scanner would never emit', () => {
    expect(normaliseBarcode('006-442 000\n1030')).toBe('0064420001030');
  });

  it('collapses input that carries no digits at all to nothing', () => {
    expect(normaliseBarcode('abc')).toBe('');
  });

  it('is idempotent, so re-normalising a stored value is safe', () => {
    const once = normaliseBarcode('12-34');
    expect(normaliseBarcode(once)).toBe(once);
  });
});

describe('isRapidKeystroke', () => {
  it('treats a gap under the threshold as machine speed', () => {
    expect(isRapidKeystroke(RAPID_INPUT_THRESHOLD_MS - 1)).toBe(true);
  });

  it('treats the threshold itself as human, so the bound is not accidental', () => {
    expect(isRapidKeystroke(RAPID_INPUT_THRESHOLD_MS)).toBe(false);
  });

  it('treats a slow gap as human', () => {
    expect(isRapidKeystroke(400)).toBe(false);
  });
});

describe('isCompleteScan', () => {
  it('accepts a long enough burst carrying a long enough code', () => {
    expect(isCompleteScan(RAPID_KEYSTROKES_REQUIRED, '1234')).toBe(true);
  });

  it('rejects a burst that is still too short to trust', () => {
    // Someone leaning on a key must not be mistaken for a scanner.
    expect(isCompleteScan(RAPID_KEYSTROKES_REQUIRED - 1, '1234')).toBe(false);
  });

  it('rejects a code shorter than a real barcode however fast it arrived', () => {
    expect(isCompleteScan(10, '1'.repeat(MIN_BARCODE_LENGTH - 1))).toBe(false);
  });

  it('accepts a long real-world barcode', () => {
    expect(isCompleteScan(13, '0064420001030')).toBe(true);
  });
});

describe('isSubmittableBarcode', () => {
  it('accepts a code at the minimum length', () => {
    expect(isSubmittableBarcode('1'.repeat(MIN_BARCODE_LENGTH))).toBe(true);
  });

  it('rejects a code one digit short', () => {
    expect(isSubmittableBarcode('1'.repeat(MIN_BARCODE_LENGTH - 1))).toBe(false);
  });

  it('rejects an empty value, which is what a cleared input holds', () => {
    expect(isSubmittableBarcode('')).toBe(false);
  });
});

describe('scanner timings', () => {
  it('waits longer for a burst to end than the gap that defines one', () => {
    // Otherwise the code would be submitted mid-scan and get truncated.
    expect(AUTO_SUBMIT_DELAY_MS).toBeGreaterThan(RAPID_INPUT_THRESHOLD_MS);
  });
});
