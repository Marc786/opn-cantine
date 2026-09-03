import { useState, useRef, useCallback, useEffect } from 'react';
import type { ScannedProduct } from '../types';
import { addUnit } from '../cart-lines';
import { logAction } from '@/lib/client/action-log.client';
import { useBarcodeScanner } from '@/lib/client/useBarcodeScanner';

/**
 * A lookup must not be allowed to hang forever. The auto-logout is paused while
 * one is in flight, so a request that never settles would keep an employee's
 * tab on screen on a shared kiosk indefinitely.
 */
const LOOKUP_TIMEOUT_MS = 10000;

export function useCart(
  setUnknownOpen: (open: boolean) => void,
  {
    isScannerEnabled,
    isSaleInProgress,
  }: { isScannerEnabled?: () => boolean; isSaleInProgress?: () => boolean } = {}
) {
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [scanFeedback, setScanFeedback] = useState('');
  // True while a barcode is being looked up. On the kiosk's connection that can
  // take a couple of seconds, during which the screen used to show nothing at
  // all and the operator could not tell a slow scan from a missed one.
  const [scanPending, setScanPending] = useState(false);

  const lastAddRef = useRef(0);
  const pendingLookupsRef = useRef(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSaleInProgressRef = useRef(isSaleInProgress);
  isSaleInProgressRef.current = isSaleInProgress;

  // One timer for the whole screen. Two scans in quick succession each used to
  // arm their own, so the first one to expire wiped the second one's message
  // early.
  const showFeedback = useCallback((message: string) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setScanFeedback(message);
    feedbackTimerRef.current = setTimeout(() => {
      setScanFeedback('');
      feedbackTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  const handleProductScan = useCallback(
    async (value: string) => {
      // The sale payload is built when the save starts, so an item scanned
      // after that point would leave the shelf without ever being billed. Turn
      // it away visibly rather than adding it to a cart that is already gone.
      if (isSaleInProgressRef.current?.()) {
        logAction('scan_dropped', { barcode: value, reason: 'sale_in_progress' });
        showFeedback('Vente en cours — rescannez après');
        return;
      }

      // Counted, not a plain flag: scans can overlap, and the spinner must stay
      // up until the last one lands rather than the first.
      pendingLookupsRef.current += 1;
      setScanPending(true);
      const startedAt = Date.now();

      try {
        const res = await fetch(
          `/api/products/lookup?barcode=${encodeURIComponent(value)}`,
          { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) }
        );
        const data = await res.json();
        const durationMs = Date.now() - startedAt;

        if (!data.found) {
          logAction('scan_unknown', { barcode: value, durationMs });
          setUnknownOpen(true);
          return;
        }

        const product = data.product;

        setPendingTotal((prev) => prev + product.price);
        setScannedProducts((prev) =>
          addUnit(prev, {
            barcode: value,
            name: product.name,
            price: product.price,
            productId: product.id ?? null,
          })
        );

        // Recorded so a slow scan can be told apart from a missed one when
        // reading the journal after the fact.
        logAction('scan', {
          barcode: value,
          productId: product.id ?? null,
          name: product.name,
          price: product.price,
          durationMs,
        });

        showFeedback(`${product.name} — ${product.price.toFixed(2)}$`);
      } catch (error) {
        const timedOut = error instanceof Error && error.name === 'TimeoutError';
        logAction('scan', {
          barcode: value,
          error: timedOut ? 'lookup_timeout' : 'lookup_failed',
          durationMs: Date.now() - startedAt,
        });
        showFeedback('Erreur de connexion');
      } finally {
        pendingLookupsRef.current -= 1;
        if (pendingLookupsRef.current === 0) setScanPending(false);
      }
    },
    [setUnknownOpen, showFeedback]
  );

  const handleDroppedScan = useCallback((barcode: string) => {
    // Too short to be a product. Nothing is shown on screen, so record it:
    // an unexplained gap in the journal is what made this hard to diagnose.
    logAction('scan_dropped', { barcode, length: barcode.length });
  }, []);

  const { scanValue, scanInputRef, handleScanChange, handleScanKeyDown } =
    useBarcodeScanner(handleProductScan, {
      isEnabled: isScannerEnabled,
      onDropped: handleDroppedScan,
    });

  const addCoffee = () => {
    const now = Date.now();
    if (now - lastAddRef.current < 300) return;
    lastAddRef.current = now;

    logAction('quick_add', { barcode: '_cafe_', name: 'Café', price: 1.0 });
    setPendingTotal((prev) => prev + 1);
    setScannedProducts((prev) =>
      addUnit(prev, { barcode: '_cafe_', name: 'Café', price: 1.0 })
    );
  };

  const addEvent = (name: string, price: number) => {
    const now = Date.now();
    if (now - lastAddRef.current < 300) return;
    lastAddRef.current = now;

    logAction('quick_add', { barcode: '_event_', name, price });
    setPendingTotal((prev) => prev + price);
    setScannedProducts((prev) => addUnit(prev, { barcode: '_event_', name, price }));
  };

  return {
    scannedProducts,
    setScannedProducts,
    pendingTotal,
    setPendingTotal,
    scanFeedback,
    scanPending,
    scanValue,
    scanInputRef,
    addCoffee,
    addEvent,
    handleScanChange,
    handleScanKeyDown,
  };
}
