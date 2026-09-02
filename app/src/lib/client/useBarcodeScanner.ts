import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import {
  AUTO_SUBMIT_DELAY_MS,
  isCompleteScan,
  isRapidKeystroke,
  isSubmittableBarcode,
  normaliseBarcode,
} from './barcode-scan';

/**
 * Wires a hidden input to a USB barcode scanner.
 *
 * Every screen that reads a barcode shares this so they all agree on what a
 * scan is: the tab, the cash register and the price check would otherwise each
 * carry their own copy of the burst-detection heuristics.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const [scanValue, setScanValue] = useState('');

  const scanInputRef = useRef<HTMLInputElement>(null);
  const lastKeystrokeRef = useRef(0);
  const rapidKeystrokesRef = useRef(0);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The auto-submit timer fires later than the render that scheduled it, so it
  // must reach the current handler rather than the one captured at the time.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const submit = useCallback((raw: string) => {
    const barcode = normaliseBarcode(raw);
    if (!isSubmittableBarcode(barcode)) return;

    // Clear before dispatching: the lookup is async, and a scanner can deliver
    // the next code while it is still in flight.
    setScanValue('');
    rapidKeystrokesRef.current = 0;
    onScanRef.current(barcode);
  }, []);

  const handleScanChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = normaliseBarcode(event.target.value);
      setScanValue(value);

      const now = Date.now();
      rapidKeystrokesRef.current = isRapidKeystroke(now - lastKeystrokeRef.current)
        ? rapidKeystrokesRef.current + 1
        : 1;
      lastKeystrokeRef.current = now;

      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);

      if (isCompleteScan(rapidKeystrokesRef.current, value)) {
        autoSubmitTimerRef.current = setTimeout(
          () => submit(value),
          AUTO_SUBMIT_DELAY_MS
        );
      }
    },
    [submit]
  );

  const handleScanKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
      submit(scanValue);
    },
    [submit, scanValue]
  );

  return { scanValue, setScanValue, scanInputRef, handleScanChange, handleScanKeyDown };
}
