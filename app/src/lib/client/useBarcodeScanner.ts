import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import {
  AUTO_SUBMIT_DELAY_MS,
  isCompleteScan,
  isRapidKeystroke,
  isSubmittableBarcode,
  normaliseBarcode,
} from './barcode-scan';

interface Options {
  /**
   * Asked at each keystroke whether the fallback should act. A predicate rather
   * than a flag because callers know the answer only after hooks that run later
   * in the component, and because it keeps the listener from resubscribing
   * every time a dialog opens.
   */
  isEnabled?: () => boolean;
  /** Called when a scan was dropped, so the journal can record it. */
  onDropped?: (raw: string) => void;
}

/** True for elements that legitimately own the keyboard while focused. */
function ownsKeyboard(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/**
 * Wires a hidden input to a USB barcode scanner.
 *
 * Every screen that reads a barcode shares this so they all agree on what a
 * scan is: the tab, the cash register and the price check would otherwise each
 * carry their own copy of the burst-detection heuristics.
 *
 * A scanner types into whatever holds focus, so anything that takes focus away
 * — tapping "Café", dismissing a dialog — sends the following scan nowhere.
 * Refocusing on click or on blur only helps once such an event happens, and by
 * then the first characters are already gone. The document-level listener below
 * catches the keystrokes themselves, which is what actually makes a scan
 * impossible to lose.
 */
export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  { isEnabled, onDropped }: Options = {}
) {
  const [scanValue, setScanValue] = useState('');

  const scanInputRef = useRef<HTMLInputElement>(null);
  const lastKeystrokeRef = useRef(0);
  const rapidKeystrokesRef = useRef(0);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The code being assembled. Kept in a ref as well as in state because the
  // handlers must not depend on React having re-rendered: a scanner delivers a
  // whole barcode in a few milliseconds.
  const bufferRef = useRef('');

  // These fire later than the render that scheduled them, so they must reach
  // the current handlers rather than the ones captured at the time.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const onDroppedRef = useRef(onDropped);
  onDroppedRef.current = onDropped;
  const isEnabledRef = useRef(isEnabled);
  isEnabledRef.current = isEnabled;

  const setBuffer = useCallback((value: string) => {
    bufferRef.current = value;
    setScanValue(value);
  }, []);

  const submit = useCallback(
    (raw: string) => {
      const barcode = normaliseBarcode(raw);

      // Clear whatever the outcome, and before dispatching: the lookup is
      // async, and anything left behind would prefix the next scan.
      setBuffer('');
      rapidKeystrokesRef.current = 0;
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }

      if (!isSubmittableBarcode(barcode)) {
        // Nothing is shown to the user here, which is precisely why a lost scan
        // used to be invisible. Report it so it lands in the journal.
        if (barcode.length > 0) onDroppedRef.current?.(barcode);
        return;
      }
      onScanRef.current(barcode);
    },
    [setBuffer]
  );

  /** Records a keystroke and decides whether the burst is a finished code. */
  const registerKeystroke = useCallback(
    (value: string) => {
      const now = Date.now();
      rapidKeystrokesRef.current = isRapidKeystroke(now - lastKeystrokeRef.current)
        ? rapidKeystrokesRef.current + 1
        : 1;
      lastKeystrokeRef.current = now;

      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);

      if (isCompleteScan(rapidKeystrokesRef.current, value)) {
        autoSubmitTimerRef.current = setTimeout(() => submit(value), AUTO_SUBMIT_DELAY_MS);
        return;
      }

      // A burst that stops short of a barcode is a misread, and it never
      // reaches submit() on its own: no Enter comes, and the auto-submit above
      // needs a plausible length. Left alone those digits would sit in the
      // buffer, prefix the next scan into an unknown product, and make every
      // Enter on the page look like a scan. Drop them after the same pause.
      autoSubmitTimerRef.current = setTimeout(() => {
        if (isSubmittableBarcode(bufferRef.current)) return;
        const stale = bufferRef.current;
        setBuffer('');
        rapidKeystrokesRef.current = 0;
        if (stale.length > 0) onDroppedRef.current?.(stale);
      }, AUTO_SUBMIT_DELAY_MS);
    },
    [setBuffer, submit]
  );

  const handleScanChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = normaliseBarcode(event.target.value);
      setBuffer(value);
      registerKeystroke(value);
    },
    [registerKeystroke, setBuffer]
  );

  const handleScanKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      // Read the buffer, not state: state is a render behind by design.
      submit(bufferRef.current);
    },
    [submit]
  );

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isEnabledRef.current?.() === false) return;
      // The input may not exist yet: pages render nothing until their first
      // request comes back, and on a slow connection that is long enough to
      // scan into. Keep the keystrokes anyway and focus only if there is
      // something to focus.
      const input = scanInputRef.current;
      // The normal case is already covered by the input's own handlers.
      if (input && event.target === input) return;
      // Never take characters away from a field the user is typing in.
      if (ownsKeyboard(event.target)) return;

      if (event.key === 'Enter') {
        if (bufferRef.current.length === 0) return;
        event.preventDefault();
        input?.focus();
        submit(bufferRef.current);
        return;
      }

      if (event.key.length !== 1) return;
      const digit = normaliseBarcode(event.key);
      if (digit.length === 0) return;

      event.preventDefault();
      input?.focus();
      const next = bufferRef.current + digit;
      setBuffer(next);
      registerKeystroke(next);
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // A pending auto-submit would otherwise fire after the screen is gone,
      // recording a scan in the journal for an item no cart will ever hold.
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    };
  }, [registerKeystroke, setBuffer, submit]);

  return {
    scanValue,
    setScanValue: setBuffer,
    scanInputRef,
    handleScanChange,
    handleScanKeyDown,
  };
}
