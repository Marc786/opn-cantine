import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { ScannedProduct } from '../types';
import { addUnit } from '../cart-lines';

const RAPID_INPUT_THRESHOLD_MS = 80;
const AUTO_SUBMIT_DELAY_MS = 300;
const MIN_BARCODE_LENGTH = 4;

export function useCart(setUnknownOpen: (open: boolean) => void) {
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [scanFeedback, setScanFeedback] = useState('');
  const [scanValue, setScanValue] = useState('');

  const scanInputRef = useRef<HTMLInputElement>(null);
  const lastScanKeystrokeRef = useRef(0);
  const rapidScanCountRef = useRef(0);
  const autoScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAddRef = useRef(0);

  const handleProductScan = useCallback(
    async (barcode: string) => {
      const value = barcode.trim();
      if (!value || value.length < MIN_BARCODE_LENGTH) return;

      try {
        const res = await fetch(
          `/api/products/lookup?barcode=${encodeURIComponent(value)}`
        );
        const data = await res.json();

        if (!data.found) {
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

        setScanFeedback(`${product.name} — ${product.price.toFixed(2)}$`);
        setTimeout(() => setScanFeedback(''), 3000);
      } catch {
        setScanFeedback('Erreur de connexion');
        setTimeout(() => setScanFeedback(''), 3000);
      }

      setScanValue('');
    },
    [setUnknownOpen]
  );

  const addCoffee = () => {
    const now = Date.now();
    if (now - lastAddRef.current < 300) return;
    lastAddRef.current = now;

    setPendingTotal((prev) => prev + 1);
    setScannedProducts((prev) =>
      addUnit(prev, { barcode: '_cafe_', name: 'Café', price: 1.0 })
    );
  };

  const addEvent = (name: string, price: number) => {
    const now = Date.now();
    if (now - lastAddRef.current < 300) return;
    lastAddRef.current = now;

    setPendingTotal((prev) => prev + price);
    setScannedProducts((prev) => addUnit(prev, { barcode: '_event_', name, price }));
  };

  const handleScanChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setScanValue(val);

    const now = Date.now();
    if (now - lastScanKeystrokeRef.current < RAPID_INPUT_THRESHOLD_MS) {
      rapidScanCountRef.current++;
    } else {
      rapidScanCountRef.current = 1;
    }
    lastScanKeystrokeRef.current = now;

    if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);

    if (rapidScanCountRef.current >= 3 && val.length >= MIN_BARCODE_LENGTH) {
      autoScanTimerRef.current = setTimeout(() => {
        handleProductScan(val);
      }, AUTO_SUBMIT_DELAY_MS);
    }
  };

  const handleScanKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (autoScanTimerRef.current) clearTimeout(autoScanTimerRef.current);
      handleProductScan(scanValue);
    }
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
