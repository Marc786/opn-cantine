'use client';

import { useEffect, useState, use } from 'react';
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
import { useCart } from './hooks/useCart';
import { useSaveFlow } from './hooks/useSaveFlow';
import { HistoryModal } from './components/HistoryModal';
import { SaveModal } from './components/SaveModal';
import { ResetModal } from './components/ResetModal';
import { EditProductModal } from './components/EditProductModal';
import { UnknownProductModal } from './components/UnknownProductModal';
import type { Employee, ScannedProduct } from './types';

type AnnouncementProduct = { name: string; price: number };
type AnnouncementEvent = {
  product?: AnnouncementProduct | null;
  salesStart?: string | null;
  salesEnd?: string | null;
  purchasedQty?: number;
};

function localDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isProductVisible(event: AnnouncementEvent): boolean {
  const today = localDateString();
  return !!event.product && !!event.salesStart && today >= event.salesStart &&
    (!event.salesEnd || today <= event.salesEnd);
}

function getBalanceColor(value: number) {
  const clamped = Math.max(0, Math.min(value, 80));
  const ratio = clamped / 80;

  // green (34,197,94) → yellow (234,179,8) → red (239,68,68)
  let r: number, g: number, b: number;
  if (ratio <= 0.5) {
    const t = ratio * 2;
    r = Math.round(34 + (234 - 34) * t);
    g = Math.round(197 + (179 - 197) * t);
    b = Math.round(94 + (8 - 94) * t);
  } else {
    const t = (ratio - 0.5) * 2;
    r = Math.round(234 + (239 - 234) * t);
    g = Math.round(179 + (68 - 179) * t);
    b = Math.round(8 + (68 - 8) * t);
  }

  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.1)`,
    fg: `rgb(${r}, ${g}, ${b})`,
  };
}

export default function TabPage({
  params,
}: {
  params: Promise<{ cardNumber: string }>;
}) {
  const { cardNumber } = use(params);
  const router = useRouter();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [announcementProduct, setAnnouncementProduct] = useState<AnnouncementProduct | null>(null);
  const [purchasedQty, setPurchasedQty] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [unknownOpen, setUnknownOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ScannedProduct | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);

  const cart = useCart(setUnknownOpen);

  const save = useSaveFlow({
    employee,
    cardNumber,
    pendingTotal: cart.pendingTotal,
    scannedProducts: cart.scannedProducts,
    setLoading,
    router,
    resetOpen,
    unknownOpen,
    editProduct,
  });

  useEffect(() => {
    const fetchEmployee = async () => {
      const res = await fetch(
        `/api/employees/lookup?cardNumber=${encodeURIComponent(cardNumber)}`
      );
      const data = await res.json();
      if (data.found) {
        setEmployee(data.employee);
      } else {
        router.push('/');
      }
    };
    fetchEmployee();

    fetch(`/api/announcement?cardNumber=${encodeURIComponent(cardNumber)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: AnnouncementEvent | null) => {
        if (data && isProductVisible(data) && data.product) {
          setAnnouncementProduct(data.product);
          setPurchasedQty(data.purchasedQty ?? 0);
        }
      })
      .catch(() => null);
  }, [cardNumber, router]);

  const handleConfirmReset = async () => {
    setResetOpen(false);
    setLoading(true);
    const res = await fetch('/api/employees/tab', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardNumber }),
    });
    if (res.ok) {
      const data = await res.json();
      setEmployee(data);
      cart.setPendingTotal(0);
      cart.setScannedProducts([]);
    }
    setLoading(false);
  };

  // Keep scanner input focused when no modal is open
  useEffect(() => {
    const refocus = () => {
      if (!save.saveOpen && !resetOpen && !unknownOpen && !editProduct && !historyOpen) {
        cart.scanInputRef.current?.focus();
      }
    };
    document.addEventListener('click', refocus);
    return () => document.removeEventListener('click', refocus);
  }, [save.saveOpen, resetOpen, unknownOpen, editProduct, historyOpen, cart.scanInputRef]);

  const hasPending = cart.pendingTotal !== 0;
  const projectedTab = employee ? employee.tab + cart.pendingTotal : 0;
  const balanceColor = getBalanceColor(projectedTab);
  const pendingColor = getBalanceColor(cart.pendingTotal > 0 ? projectedTab : 0);

  if (!employee) return null;

  return (
    <>
      <Flex minH="100dvh" direction="column" px={8} py={6}>
        {/* Top bar */}
        <Flex justify="space-between" align="center">
          <VStack align="start" gap={0}>
            <Heading
              size={{ base: '2xl', md: '4xl' }}
              fontWeight="800"
              letterSpacing="-0.02em"
            >
              {employee.employeeNumber}
            </Heading>
          </VStack>
          <Button
            aria-label="Voir historique"
            variant="outline"
            size="md"
            color="fg.muted"
            fontWeight="600"
            onClick={() => setHistoryOpen(true)}
          >
            Voir historique
          </Button>
        </Flex>

        {/* Hidden barcode scanner input */}
        <Input
          ref={cart.scanInputRef}
          value={cart.scanValue}
          onBlur={() => {
            if (!save.saveOpen && !resetOpen && !unknownOpen && !editProduct) {
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
            opacity={cart.scannedProducts.length > 0 && !cart.scanFeedback ? 1 : 0}
            visibility={
              cart.scannedProducts.length > 0 && !cart.scanFeedback
                ? 'visible'
                : 'hidden'
            }
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
            {cart.scannedProducts.length > 0 && (
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
          {/* Balance */}
          <Box
            w="full"
            py={8}
            borderRadius="2xl"
            bg={balanceColor.bg}
            textAlign="center"
          >
            <Text
              fontSize={{ base: 'lg', md: 'xl' }}
              fontWeight="500"
              color={balanceColor.fg}
              mb={3}
            >
              {hasPending ? 'Aperçu du solde' : 'Solde actuel'}
            </Text>
            <Text
              fontSize={{ base: '7xl', md: '9xl' }}
              fontWeight="800"
              lineHeight="1"
              color={balanceColor.fg}
            >
              {projectedTab.toFixed(2)}$
            </Text>

            <Text
              fontSize={{ base: 'md', md: 'lg' }}
              fontWeight="600"
              mt={4}
              color={pendingColor.fg}
              visibility={hasPending ? 'visible' : 'hidden'}
            >
              {cart.pendingTotal > 0 ? '+' : ''}
              {cart.pendingTotal.toFixed(2)}$ depuis {employee.tab.toFixed(2)}$
            </Text>

            {projectedTab > 75 && (
              <Text
                fontSize={{ base: 'sm', md: 'md' }}
                fontWeight="600"
                mt={4}
                color="red.500"
              >
                Votre solde dépasse 75$. Merci de payer votre dette.
              </Text>
            )}
          </Box>

          {/* Quick-add buttons */}
          <HStack gap={3} w="full" align="start">
            <Button
              flex={1}
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
            {announcementProduct && (
              <VStack flex={1} gap={1} align="stretch">
                <Button
                  h="auto"
                  py={6}
                  variant="outline"
                  borderColor="#0068A2"
                  color="#0068A2"
                  _hover={{ bg: '#0068A210' }}
                  onClick={() => cart.addEvent(announcementProduct.name, announcementProduct.price)}
                  disabled={loading}
                  fontWeight="600"
                  fontSize={{ base: 'lg', md: 'xl' }}
                >
                  {announcementProduct.name} (+{announcementProduct.price.toFixed(2)}$)
                </Button>
                {purchasedQty > 0 && (
                  <Text fontSize="sm" color="fg.muted" textAlign="center">
                    Vous avez déjà acheté {purchasedQty} billet{purchasedQty > 1 ? 's' : ''}
                  </Text>
                )}
              </VStack>
            )}
          </HStack>

          <Separator />

          {/* Save + Reset */}
          <Flex direction={{ base: 'column', md: 'row' }} gap={4} w="full">
            <Button
              flex={{ md: 3 }}
              h="auto"
              py={6}
              colorPalette="gray"
              onClick={save.handleSave}
              loading={loading}
              fontWeight="600"
              fontSize={{ base: 'xl', md: '2xl' }}
            >
              {hasPending ? 'Sauvegarder' : 'Déconnexion'}
            </Button>
            <Button
              flex={{ md: 1 }}
              h="auto"
              py={6}
              variant="outline"
              colorPalette="red"
              onClick={() => setResetOpen(true)}
              loading={loading}
              fontWeight="600"
              fontSize={{ base: 'lg', md: 'xl' }}
            >
              J&apos;ai payé ma dette
            </Button>
          </Flex>
        </Flex>
      </Flex>

      <ResetModal
        open={resetOpen}
        employeeName={employee.employeeNumber}
        onOpenChange={setResetOpen}
        onConfirm={handleConfirmReset}
      />

      <SaveModal
        open={save.saveOpen}
        countdown={save.countdown}
        pendingTotal={cart.pendingTotal}
        projectedTab={projectedTab}
        onCancel={save.cancelSave}
        onSave={() => {
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

      <HistoryModal
        open={historyOpen}
        cardNumber={cardNumber}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}
