'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Heading,
  Button,
  VStack,
  Text,
  Input,
  HStack,
  Flex,
  Separator,
} from '@chakra-ui/react';
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

  const cart = useCart(setUnknownOpen);

  const save = useCashSaveFlow({
    pendingTotal: cart.pendingTotal,
    scannedProducts: cart.scannedProducts,
    setScannedProducts: cart.setScannedProducts,
    setPendingTotal: cart.setPendingTotal,
    setLoading,
    router,
    unknownOpen,
    editProduct,
  });

  // Keep scanner input focused when no modal is open
  useEffect(() => {
    const refocus = () => {
      if (!save.saveOpen && !unknownOpen && !editProduct) {
        cart.scanInputRef.current?.focus();
      }
    };
    document.addEventListener('click', refocus);
    return () => document.removeEventListener('click', refocus);
  }, [save.saveOpen, unknownOpen, editProduct, cart.scanInputRef]);

  const hasItems = cart.scannedProducts.length > 0;

  return (
    <>
      <Flex minH="100dvh" direction="column" px={8} py={6}>
        {/* Top bar */}
        <Heading
          size={{ base: '2xl', md: '4xl' }}
          fontWeight="800"
          letterSpacing="-0.02em"
        >
          Paiement comptant
        </Heading>

        {/* Hidden barcode scanner input */}
        <Input
          ref={cart.scanInputRef}
          value={cart.scanValue}
          onBlur={() => {
            if (!save.saveOpen && !unknownOpen && !editProduct) {
              cart.scanInputRef.current?.focus();
            }
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

        {/* Fixed height container for scan feedback and products list */}
        <Box minH="120px" w="full" position="relative" zIndex={10}>
          {/* Scan feedback */}
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
            opacity={cart.scanFeedback ? 1 : 0}
            visibility={cart.scanFeedback ? 'visible' : 'hidden'}
            transition="all 0.2s"
            zIndex={2}
          >
            <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="600">
              {cart.scanFeedback || ' '}
            </Text>
          </Box>

          {/* Scanned products list */}
          <VStack
            w="full"
            maxH="120px"
            overflowY="auto"
            gap={1}
            align="stretch"
            opacity={hasItems && !cart.scanFeedback ? 1 : 0}
            visibility={hasItems && !cart.scanFeedback ? 'visible' : 'hidden'}
            transition="all 0.2s"
            position="absolute"
            top={0}
            left={0}
            right={0}
            zIndex={1}
            css={{
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                background: 'var(--chakra-colors-border)',
                borderRadius: '4px',
              },
            }}
          >
            {hasItems && (
              <Text fontSize="xs" color="fg.muted" textAlign="center" pb={0.5}>
                Touchez un article pour le modifier
              </Text>
            )}
            {cart.scannedProducts.map((p) => (
              <Flex
                key={p.barcode}
                w="full"
                py={2}
                px={4}
                align="center"
                justify="space-between"
                borderRadius="lg"
                borderWidth="1px"
                borderColor="border"
                bg="bg.subtle"
                cursor="pointer"
                transition="all 0.15s"
                _hover={{ bg: 'bg.muted' }}
                _active={{ bg: 'bg.muted', transform: 'scale(0.98)' }}
                onClick={() => {
                  setEditProduct(p);
                  setEditQty(p.qty);
                }}
              >
                <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="700">
                  {p.name} {p.qty > 1 ? `x${p.qty}` : ''}
                </Text>
                <HStack gap={2}>
                  <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="700">
                    {(p.price * p.qty).toFixed(2)}$
                  </Text>
                  <Flex
                    align="center"
                    gap={1}
                    px={2}
                    py={0.5}
                    borderRadius="full"
                    bg="bg.muted"
                    color="fg.muted"
                    fontSize="xs"
                    fontWeight="600"
                    flexShrink={0}
                  >
                    ✎ Modifier
                  </Flex>
                </HStack>
              </Flex>
            ))}
          </VStack>
        </Box>

        {/* Main content */}
        <Flex flex={1} direction="column" justify="center" gap={6} py={4}>
          {/* Total */}
          <Box w="full" py={8} borderRadius="2xl" bg="bg.subtle" textAlign="center">
            <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="500" color="fg.muted" mb={3}>
              Total à payer
            </Text>
            <Text fontSize={{ base: '7xl', md: '9xl' }} fontWeight="800" lineHeight="1">
              {cart.pendingTotal.toFixed(2)}$
            </Text>
          </Box>

          {/* Quick-add */}
          <Button
            h="auto"
            py={6}
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
              py={6}
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
              py={6}
              variant="outline"
              colorPalette="red"
              onClick={() => router.push('/')}
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
        onCancel={save.cancelSave}
        onConfirm={() => {
          save.cancelSave();
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
          cart.setPendingTotal((prev) => prev - editProduct.qty * editProduct.price);
          cart.setScannedProducts((prev) =>
            prev.filter((p) => p.barcode !== editProduct.barcode)
          );
          setEditProduct(null);
        }}
        onConfirm={(newQty) => {
          if (!editProduct) return;
          const delta = newQty - editProduct.qty;
          cart.setPendingTotal((prev) => prev + delta * editProduct.price);
          cart.setScannedProducts((prev) =>
            prev.map((p) =>
              p.barcode === editProduct.barcode ? { ...p, qty: newQty } : p
            )
          );
          setEditProduct(null);
        }}
      />
    </>
  );
}
