import { useState, useRef, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Employee, ScannedProduct } from '../types';
import { flushActionLog, logAction } from '@/lib/client/action-log.client';

const INACTIVITY_TIMEOUT_MS = 15000;
const SAVE_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 400;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function newSaleId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

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
  const saleIdRef = useRef<string | null>(null);

  const doSave = useCallback(async () => {
    if (!employee || pendingTotal === 0) return;
    // The countdown auto-fire and the manual "Sauvegarder" button can both land
    // here; without this guard the same cart is submitted twice.
    if (savingRef.current) return;
    savingRef.current = true;

    // One stable id per cart. Reused across retries so the server can apply the
    // sale exactly once no matter how many attempts reach it.
    if (!saleIdRef.current) saleIdRef.current = newSaleId();
    const saleId = saleIdRef.current;

    logAction('save_confirm', {
      saleId,
      cardNumber,
      totalAmount: pendingTotal,
      lines: scannedProducts.length,
      units: scannedProducts.reduce((sum, p) => sum + p.qty, 0),
    });

    setLoading(true);
    try {
      const payload = JSON.stringify({
        saleId,
        cardNumber,
        totalAmount: pendingTotal,
        items: scannedProducts.map((p) => ({
          barcode: p.barcode,
          name: p.name,
          price: p.price,
          quantity: p.qty,
          productId: p.productId ?? null,
        })),
      });

      // Retrying is safe because the call is idempotent, and it is the only way
      // to guarantee the tab charge and the stock decrement both land.
      let lastError: unknown = null;
      for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
        try {
          const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          });

          if (res.ok) {
            logAction('save_result', { saleId, outcome: 'ok', attempt: attempt + 1 });
            saleIdRef.current = null;
            // The log is the only record of what the kiosk did; make sure it
            // has landed before this screen goes away.
            await flushActionLog();
            router.push('/');
            return;
          }

          // A rejected payload will never succeed; retrying only delays the user.
          if (res.status >= 400 && res.status < 500) {
            logAction('save_error', {
              saleId,
              outcome: 'rejected',
              status: res.status,
              attempt: attempt + 1,
            });
            console.error(`Sale rejected (${res.status}) for card ${cardNumber}`);
            await flushActionLog();
            return;
          }
          lastError = new Error(`Sale failed with status ${res.status}`);
        } catch (error) {
          lastError = error;
        }

        if (attempt < SAVE_ATTEMPTS - 1) {
          await delay(RETRY_BACKOFF_MS * (attempt + 1));
        }
      }

      logAction('save_error', {
        saleId,
        outcome: 'exhausted',
        attempts: SAVE_ATTEMPTS,
        message: lastError instanceof Error ? lastError.message : String(lastError),
      });
      console.error(`Sale ${saleId} could not be recorded`, lastError);
      await flushActionLog();
    } finally {
      setLoading(false);
      savingRef.current = false;
    }
  }, [employee, cardNumber, pendingTotal, scannedProducts, setLoading, router]);

  // Tears the countdown down without judging why. The auto-fire path uses this
  // too, so it must not be recorded as a user cancelling.
  const closeSaveCountdown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSaveOpen(false);
    setCountdown(5);
  }, []);

  const cancelSave = useCallback(() => {
    logAction('save_cancel', { saleId: saleIdRef.current });
    closeSaveCountdown();
  }, [closeSaveCountdown]);

  const startSaveCountdown = useCallback(() => {
    logAction('save_open', { totalAmount: pendingTotal });
    setCountdown(5);
    setSaveOpen(true);
  }, [pendingTotal]);

  const handleSave = useCallback(() => {
    if (!employee) return;
    if (pendingTotal === 0) {
      logAction('disconnect', { reason: 'empty_cart' });
      flushActionLog().finally(() => router.push('/'));
      return;
    }
    startSaveCountdown();
  }, [employee, pendingTotal, router, startSaveCountdown]);

  // Keep refs current so effects always call the latest versions
  doSaveRef.current = doSave;
  handleSaveRef.current = handleSave;

  // A changed cart is a different sale: drop the id so a previously failed
  // attempt cannot be replayed with stale contents.
  useEffect(() => {
    if (!savingRef.current) saleIdRef.current = null;
  }, [scannedProducts]);

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
      closeSaveCountdown();
      doSaveRef.current();
    }
  }, [countdown, saveOpen, closeSaveCountdown]);

  // Auto-save after 15 s of no new scan; paused while any modal is open
  useEffect(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    if (saveOpen || resetOpen || unknownOpen || editProduct || historyOpen) return;

    inactivityTimerRef.current = setTimeout(() => {
      logAction('auto_logout', {
        afterMs: INACTIVITY_TIMEOUT_MS,
        lines: scannedProducts.length,
      });
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
