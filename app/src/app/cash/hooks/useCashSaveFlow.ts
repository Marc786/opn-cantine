import { useState, useRef, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { CASH_CARD_NUMBER } from '@/lib/domain/constants';
import type { ScannedProduct } from '../../tab/[cardNumber]/types';

const INACTIVITY_TIMEOUT_MS = 15000;

interface Params {
  pendingTotal: number;
  scannedProducts: ScannedProduct[];
  setScannedProducts: Dispatch<SetStateAction<ScannedProduct[]>>;
  setPendingTotal: Dispatch<SetStateAction<number>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  router: { push: (url: string) => void };
  unknownOpen: boolean;
  editProduct: ScannedProduct | null;
}

export function useCashSaveFlow({
  pendingTotal,
  scannedProducts,
  setScannedProducts,
  setPendingTotal,
  setLoading,
  router,
  unknownOpen,
  editProduct,
}: Params) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const handleSaveRef = useRef<() => void>(() => {});

  const doSave = useCallback(async () => {
    if (pendingTotal === 0 || scannedProducts.length === 0) {
      router.push('/');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardNumber: CASH_CARD_NUMBER,
        totalAmount: pendingTotal,
        items: scannedProducts.map((p) => ({
          barcode: p.barcode,
          name: p.name,
          price: p.price,
          quantity: p.qty,
        })),
      }),
    }).catch(() => null);

    if (res && res.ok) {
      setScannedProducts([]);
      setPendingTotal(0);
      router.push('/');
    }
    setLoading(false);
  }, [pendingTotal, scannedProducts, setScannedProducts, setPendingTotal, setLoading, router]);

  const cancelSave = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSaveOpen(false);
    setCountdown(5);
  }, []);

  const startSaveCountdown = useCallback(() => {
    setCountdown(5);
    setSaveOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    if (pendingTotal === 0 || scannedProducts.length === 0) {
      router.push('/');
      return;
    }
    startSaveCountdown();
  }, [pendingTotal, scannedProducts, router, startSaveCountdown]);

  // Keep refs current so effects always call the latest versions
  doSaveRef.current = doSave;
  handleSaveRef.current = handleSave;

  // Start countdown interval when confirm modal opens
  useEffect(() => {
    if (!saveOpen) return;

    timerRef.current = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [saveOpen]);

  // Trigger save when countdown reaches 0
  useEffect(() => {
    if (countdown <= 0 && saveOpen) {
      cancelSave();
      doSaveRef.current();
    }
  }, [countdown, saveOpen, cancelSave]);

  // Auto-confirm after 15 s of no new scan; paused while any modal is open
  useEffect(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    if (saveOpen || unknownOpen || editProduct) return;

    inactivityTimerRef.current = setTimeout(() => {
      handleSaveRef.current();
    }, INACTIVITY_TIMEOUT_MS);

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [scannedProducts, saveOpen, unknownOpen, editProduct]);

  return { saveOpen, countdown, handleSave, cancelSave, doSave };
}
