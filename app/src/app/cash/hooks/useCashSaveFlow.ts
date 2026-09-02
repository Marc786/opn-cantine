import { useState, useRef, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { CASH_CARD_NUMBER } from '@/lib/domain/constants';
import { flushActionLog, logAction } from '@/lib/client/action-log.client';
import type { ScannedProduct } from '../../tab/[cardNumber]/types';

const INACTIVITY_TIMEOUT_MS = 15000;
export const COUNTDOWN_SECONDS = 12;
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
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doSaveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const handleSaveRef = useRef<() => void>(() => {});
  const savingRef = useRef(false);
  const saleIdRef = useRef<string | null>(null);

  const doSave = useCallback(async () => {
    if (pendingTotal === 0 || scannedProducts.length === 0) {
      logAction('disconnect', { reason: 'empty_cart', mode: 'cash' });
      flushActionLog().finally(() => router.push('/'));
      return;
    }
    // The countdown auto-fire and the "Confirmer" button can both land here;
    // without this guard the same cart is submitted — and logged — twice.
    if (savingRef.current) return;
    savingRef.current = true;

    // One stable id per cart, reused across retries so the server applies the
    // sale exactly once however many attempts reach it.
    if (!saleIdRef.current) saleIdRef.current = newSaleId();
    const saleId = saleIdRef.current;

    logAction('save_confirm', {
      mode: 'cash',
      saleId,
      cardNumber: CASH_CARD_NUMBER,
      totalAmount: pendingTotal,
      lines: scannedProducts.length,
      units: scannedProducts.reduce((sum, p) => sum + p.qty, 0),
    });

    setLoading(true);
    try {
      // Cash goes through /api/sales, not /api/transactions: only the sale
      // endpoint decrements stock in the same exactly-once unit of work as the
      // ledger entry. Recording the sale without the decrement is drift.
      const payload = JSON.stringify({
        saleId,
        cardNumber: CASH_CARD_NUMBER,
        totalAmount: pendingTotal,
        items: scannedProducts.map((p) => ({
          barcode: p.barcode,
          name: p.name,
          price: p.price,
          quantity: p.qty,
          productId: p.productId ?? null,
        })),
      });

      let lastError: unknown = null;
      for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
        try {
          const res = await fetch('/api/sales', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          });

          if (res.ok) {
            logAction('save_result', {
              mode: 'cash',
              saleId,
              outcome: 'ok',
              attempt: attempt + 1,
              totalAmount: pendingTotal,
            });
            saleIdRef.current = null;
            setScannedProducts([]);
            setPendingTotal(0);
            // The log is the only record of what the kiosk did; make sure it
            // has landed before this screen goes away.
            await flushActionLog();
            router.push('/');
            return;
          }

          // A rejected payload will never succeed; retrying only delays the user.
          if (res.status >= 400 && res.status < 500) {
            logAction('save_error', {
              mode: 'cash',
              saleId,
              outcome: 'rejected',
              status: res.status,
              attempt: attempt + 1,
            });
            console.error(`Cash sale rejected (${res.status})`);
            await flushActionLog();
            return;
          }
          lastError = new Error(`Cash sale failed with status ${res.status}`);
        } catch (error) {
          lastError = error;
        }

        if (attempt < SAVE_ATTEMPTS - 1) {
          await delay(RETRY_BACKOFF_MS * (attempt + 1));
        }
      }

      logAction('save_error', {
        mode: 'cash',
        saleId,
        outcome: 'exhausted',
        attempts: SAVE_ATTEMPTS,
        message: lastError instanceof Error ? lastError.message : String(lastError),
      });
      console.error(`Cash sale ${saleId} could not be recorded`, lastError);
      await flushActionLog();
    } finally {
      // A stuck flag would silently block every later save on this kiosk.
      setLoading(false);
      savingRef.current = false;
    }
  }, [pendingTotal, scannedProducts, setScannedProducts, setPendingTotal, setLoading, router]);

  // Tears the countdown down without judging why. The auto-fire and the
  // confirm paths use this too, so it must not be recorded as a user
  // cancelling — otherwise every confirmed payment logs a cancel first.
  const closeSaveCountdown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSaveOpen(false);
    setCountdown(COUNTDOWN_SECONDS);
  }, []);

  const cancelSave = useCallback(() => {
    logAction('save_cancel', { mode: 'cash', totalAmount: pendingTotal });
    closeSaveCountdown();
  }, [closeSaveCountdown, pendingTotal]);

  const startSaveCountdown = useCallback(() => {
    logAction('save_open', { mode: 'cash', totalAmount: pendingTotal });
    setCountdown(COUNTDOWN_SECONDS);
    setSaveOpen(true);
  }, [pendingTotal]);

  const handleSave = useCallback(() => {
    if (pendingTotal === 0 || scannedProducts.length === 0) {
      logAction('disconnect', { reason: 'empty_cart', mode: 'cash' });
      flushActionLog().finally(() => router.push('/'));
      return;
    }
    startSaveCountdown();
  }, [pendingTotal, scannedProducts, router, startSaveCountdown]);

  // Keep refs current so effects always call the latest versions
  doSaveRef.current = doSave;
  handleSaveRef.current = handleSave;

  // A changed cart is a different sale: drop the id so a previously failed
  // attempt cannot be replayed with stale contents.
  useEffect(() => {
    if (!savingRef.current) saleIdRef.current = null;
  }, [scannedProducts]);

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
      closeSaveCountdown();
      doSaveRef.current();
    }
  }, [countdown, saveOpen, closeSaveCountdown]);

  // Auto-confirm after 15 s of no new scan; paused while any modal is open
  useEffect(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    if (saveOpen || unknownOpen || editProduct) return;

    inactivityTimerRef.current = setTimeout(() => {
      logAction('auto_logout', {
        mode: 'cash',
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
  }, [scannedProducts, saveOpen, unknownOpen, editProduct]);

  return { saveOpen, countdown, handleSave, cancelSave, closeSaveCountdown, doSave };
}
