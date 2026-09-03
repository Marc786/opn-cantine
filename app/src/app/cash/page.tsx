'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Heading,
  Button,
  Text,
  Input,
  HStack,
  Spinner,
  Flex,
  Separator,
} from '@chakra-ui/react';
import {
  flushActionLog,
  logAction,
  logActionOnce,
} from '@/lib/client/action-log.client';
import { ScannedItemList } from '@/components/ScannedItemList';
import { useCart } from '../tab/[cardNumber]/hooks/useCart';
import { useCashSaveFlow } from './hooks/useCashSaveFlow';
import { CashConfirmModal } from './components/CashConfirmModal';
import { EditProductModal } from '../tab/[cardNumber]/components/EditProductModal';
import { UnknownProductModal } from '../tab/[cardNumber]/components/UnknownProductModal';
import type { ScannedProduct } from '../tab/[cardNumber]/types';

export default function CashPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [unknownOpen, setUnknownOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ScannedProduct | null>(null);
  const [editQty, setEditQty] = useState(0);

  // Read at scan time rather than passed as a value: `save` is declared below,
  // and the ref keeps the answer current without re-running effects.
  const modalOpenRef = useRef(false);
  const savingRef = useRef(false);
  const cart = useCart(setUnknownOpen, {
    isScannerEnabled: () => !modalOpenRef.current,
    isSaleInProgress: () => savingRef.current,
  });

  const save = useCashSaveFlow({
    pendingTotal: cart.pendingTotal,
    scannedProducts: cart.scannedProducts,
    setScannedProducts: cart.setScannedProducts,
    setPendingTotal: cart.setPendingTotal,
    setLoading,
    router,
    unknownOpen,
    editProduct,
    scanPending: cart.scanPending,
  });

  const modalOpen = save.saveOpen || unknownOpen || editProduct !== null;
  modalOpenRef.current = modalOpen;
  savingRef.current = save.saving;

  // Cash has no login, but it is still a distinct visit. The session itself is
  // started by whoever navigates here, not by this effect: startSession() mints
  // a new id, and an effect can run twice, which would split the visit in two.
  useEffect(() => {
    logActionOnce('cash_open', 'cash_open', {});
  }, []);

  // Keep scanner input focused when no modal is open
  useEffect(() => {
    const refocus = () => {
      if (!modalOpen) cart.scanInputRef.current?.focus();
    };
    document.addEventListener('click', refocus);
    return () => document.removeEventListener('click', refocus);
  }, [modalOpen, cart.scanInputRef]);

  const hasItems = cart.scannedProducts.length > 0;

  return (
    <>
      <Flex
        h="100dvh"
        overflow="hidden"
        direction="column"
        px={8}
        py={5}
        gap={3}
      >
        {/* Top bar */}
        <Heading
          size={{ base: '2xl', md: '4xl' }}
          fontWeight="800"
          letterSpacing="-0.02em"
          flexShrink={0}
        >
          Paiement comptant
        </Heading>

        {/* Hidden barcode scanner input */}
        <Input
          ref={cart.scanInputRef}
          value={cart.scanValue}
          onBlur={() => {
            if (!modalOpen) cart.scanInputRef.current?.focus();
          }}
          onChange={cart.handleScanChange}
          onKeyDown={cart.handleScanKeyDown}
          position="absolute"
          opacity={0}
          h={0}
          w={0}
          overflow="hidden"
          inputMode="none"
          autoFocus
        />

        {/* Takes whatever height is left over, so the cart grows into the
            available space instead of pushing the page past the screen. */}
        <Box
          flex="1 1 auto"
          minH="128px"
          w="full"
          position="relative"
          zIndex={10}
        >
          {/* Scan feedback, and the lookup that precedes it. Sits above the
              cart because it is the newest thing that happened. */}
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            py={3}
            px={5}
            borderRadius="xl"
            bg="bg.subtle"
            textAlign="center"
            opacity={cart.scanFeedback || cart.scanPending ? 1 : 0}
            visibility={cart.scanFeedback || cart.scanPending ? 'visible' : 'hidden'}
            transition="all 0.2s"
            zIndex={2}
          >
            <HStack justify="center" gap={3}>
              {cart.scanPending && <Spinner size="sm" borderWidth="3px" />}
              <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="600">
                {cart.scanPending ? 'Recherche du produit…' : cart.scanFeedback || ' '}
              </Text>
            </HStack>
          </Box>

          {/* Scanned products list */}
          <Box
            w="full"
            opacity={hasItems && !cart.scanFeedback ? 1 : 0}
            visibility={hasItems && !cart.scanFeedback ? 'visible' : 'hidden'}
            transition="all 0.2s"
            position="absolute"
            inset={0}
            zIndex={1}
          >
            <ScannedItemList
              items={cart.scannedProducts}
              maxH="100%"
              onEdit={(item) => {
                setEditProduct(item);
                setEditQty(item.qty);
              }}
            />
          </Box>
        </Box>

        {/* Main content */}
        <Flex direction="column" gap={4} flexShrink={0}>
          {/* Total */}
          <Box
            w="full"
            py={{ base: 5, md: 6 }}
            borderRadius="2xl"
            bg="bg.subtle"
            textAlign="center"
          >
            <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="500" color="fg.muted" mb={1}>
              Total à payer
            </Text>
            <Text fontSize={{ base: '7xl', md: '8xl' }} fontWeight="800" lineHeight="1">
              {cart.pendingTotal.toFixed(2)}$
            </Text>
          </Box>

          {/* Quick-add */}
          <Button
            h="auto"
            py={4}
            colorPalette="gray"
            variant="outline"
            onClick={cart.addCoffee}
            disabled={loading}
            fontWeight="600"
            fontSize={{ base: 'lg', md: 'xl' }}
          >
            Café (+1.00$)
          </Button>

          <Separator />

          {/* Confirm + Cancel */}
          <Flex direction={{ base: 'column', md: 'row' }} gap={4} w="full">
            <Button
              flex={{ md: 3 }}
              h="auto"
              py={4}
              colorPalette="gray"
              onClick={save.handleSave}
              loading={loading}
              disabled={!hasItems}
              fontWeight="600"
              fontSize={{ base: 'xl', md: '2xl' }}
            >
              Confirmer le paiement
            </Button>
            <Button
              flex={{ md: 1 }}
              h="auto"
              py={4}
              variant="outline"
              colorPalette="red"
              onClick={() => {
                logAction('disconnect', {
                  reason: 'user_cancel',
                  mode: 'cash',
                  lines: cart.scannedProducts.length,
                  totalAmount: cart.pendingTotal,
                });
                flushActionLog().finally(() => router.push('/'));
              }}
              disabled={loading}
              fontWeight="600"
              fontSize={{ base: 'lg', md: 'xl' }}
            >
              Annuler
            </Button>
          </Flex>
        </Flex>
      </Flex>

      <CashConfirmModal
        open={save.saveOpen}
        countdown={save.countdown}
        pendingTotal={cart.pendingTotal}
        scannedProducts={cart.scannedProducts}
        onCancel={save.cancelSave}
        onConfirm={() => {
          save.closeSaveCountdown();
          save.doSave();
        }}
      />

      <UnknownProductModal
        open={unknownOpen}
        onOpenChange={setUnknownOpen}
      />

      <EditProductModal
        product={editProduct}
        qty={editQty}
        onQtyChange={setEditQty}
        onOpenChange={(open) => { if (!open) setEditProduct(null); }}
        onDelete={() => {
          if (!editProduct) return;
          logAction('remove_item', {
            mode: 'cash',
            barcode: editProduct.barcode,
            name: editProduct.name,
            qty: editProduct.qty,
            price: editProduct.price,
          });
          cart.setPendingTotal((prev) => prev - editProduct.qty * editProduct.price);
          cart.setScannedProducts((prev) =>
            prev.filter((p) => p.lineId !== editProduct.lineId)
          );
          setEditProduct(null);
        }}
        onConfirm={(newQty) => {
          if (!editProduct) return;
          const delta = newQty - editProduct.qty;
          logAction('modify_item', {
            mode: 'cash',
            barcode: editProduct.barcode,
            name: editProduct.name,
            fromQty: editProduct.qty,
            toQty: newQty,
            price: editProduct.price,
          });
          cart.setPendingTotal((prev) => prev + delta * editProduct.price);
          cart.setScannedProducts((prev) =>
            prev.map((p) =>
              p.lineId === editProduct.lineId ? { ...p, qty: newQty } : p
            )
          );
          setEditProduct(null);
        }}
      />
    </>
  );
}
