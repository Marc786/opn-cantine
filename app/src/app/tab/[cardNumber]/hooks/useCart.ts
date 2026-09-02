import { useState, useRef, useCallback } from 'react';
import type { ScannedProduct } from '../types';
import { addUnit } from '../cart-lines';
import { logAction } from '@/lib/client/action-log.client';
import { useBarcodeScanner } from '@/lib/client/useBarcodeScanner';

export function useCart(setUnknownOpen: (open: boolean) => void) {
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [scanFeedback, setScanFeedback] = useState('');

  const lastAddRef = useRef(0);

  const handleProductScan = useCallback(
    async (value: string) => {
      try {
        const res = await fetch(
          `/api/products/lookup?barcode=${encodeURIComponent(value)}`
        );
        const data = await res.json();

        if (!data.found) {
          logAction('scan_unknown', { barcode: value });
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

        logAction('scan', {
          barcode: value,
          productId: product.id ?? null,
          name: product.name,
          price: product.price,
        });

        setScanFeedback(`${product.name} — ${product.price.toFixed(2)}$`);
        setTimeout(() => setScanFeedback(''), 3000);
      } catch {
        logAction('scan', { barcode: value, error: 'lookup_failed' });
        setScanFeedback('Erreur de connexion');
        setTimeout(() => setScanFeedback(''), 3000);
      }
    },
    [setUnknownOpen]
  );

  const { scanValue, scanInputRef, handleScanChange, handleScanKeyDown } =
    useBarcodeScanner(handleProductScan);

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
    scanValue,
    scanInputRef,
    addCoffee,
    addEvent,
    handleScanChange,
    handleScanKeyDown,
  };
}
