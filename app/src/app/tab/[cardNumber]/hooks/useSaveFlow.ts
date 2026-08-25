import { useState, useRef, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Employee, ScannedProduct } from '../types';

const INACTIVITY_TIMEOUT_MS = 15000;

interface Params {
  employee: Employee | null;
  cardNumber: string;
  pendingTotal: number;
  scannedProducts: ScannedProduct[];
  setLoading: Dispatch<SetStateAction<boolean>>;
  router: { push: (url: string) => void };
  resetOpen: boolean;
  unknownOpen: boolean;
  editProduct: ScannedProduct | null;
  historyOpen: boolean;
}

export function useSaveFlow({
  employee,
  cardNumber,
  pendingTotal,
  scannedProducts,
  setLoading,
  router,
  resetOpen,
  unknownOpen,
  editProduct,
  historyOpen,
}: Params) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const handleSaveRef = useRef<() => void>(() => {});
  const savingRef = useRef(false);

  const doSave = useCallback(async () => {
    if (!employee || pendingTotal === 0) return;
    // The countdown auto-fire and the manual "Sauvegarder" button can both land
    // here; without this guard the tab is charged twice and stock is
    // decremented twice for a single cart.
    if (savingRef.current) return;
    savingRef.current = true;

    setLoading(true);
    try {
      const res = await fetch('/api/employees/tab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber, amount: pendingTotal }),
      });

      if (!res.ok) return;

      if (scannedProducts.length > 0) {
        // The tab is already charged: this call is what records the transaction
        // and decrements inventory, so a failure here means real drift.
        try {
          const txRes = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cardNumber,
              totalAmount: pendingTotal,
              items: scannedProducts.map((p) => ({
                barcode: p.barcode,
                name: p.name,
                price: p.price,
                quantity: p.qty,
              })),
            }),
          });
          if (!txRes.ok) {
            console.error(
              `Tab charged but transaction log failed (${txRes.status}) for card ${cardNumber}`
            );
          }
        } catch (error) {
          console.error('Tab charged but transaction log failed', error);
        }
      }

      router.push('/');
    } finally {
      setLoading(false);
      savingRef.current = false;
    }
  }, [employee, cardNumber, pendingTotal, scannedProducts, setLoading, router]);

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
    if (!employee) return;
    if (pendingTotal === 0) {
      router.push('/');
      return;
    }
    startSaveCountdown();
  }, [employee, pendingTotal, router, startSaveCountdown]);

  // Keep refs current so effects always call the latest versions
  doSaveRef.current = doSave;
  handleSaveRef.current = handleSave;

  // Start countdown interval when save modal opens
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

  // Auto-save after 15 s of no new scan; paused while any modal is open
  useEffect(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    if (saveOpen || resetOpen || unknownOpen || editProduct || historyOpen) return;

    inactivityTimerRef.current = setTimeout(() => {
      handleSaveRef.current();
    }, INACTIVITY_TIMEOUT_MS);

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [scannedProducts, saveOpen, resetOpen, unknownOpen, editProduct, historyOpen]);

  return { saveOpen, countdown, handleSave, cancelSave, doSave };
}
