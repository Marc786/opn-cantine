'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Flex, Heading, Input, Text } from '@chakra-ui/react';
import { flushActionLog, logAction } from '@/lib/client/action-log.client';
import { useBarcodeScanner } from '@/lib/client/useBarcodeScanner';

/** Nobody is identified here, so returning home costs nothing and tidies up. */
const IDLE_RETURN_MS = 45000;

type Result =
  | { kind: 'idle' }
  | { kind: 'found'; name: string; price: number }
  | { kind: 'unknown'; barcode: string }
  | { kind: 'error' };

export default function PricePage() {
  const router = useRouter();
  const [result, setResult] = useState<Result>({ kind: 'idle' });
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goHome = useCallback(
    (reason: string) => {
      logAction('disconnect', { reason, mode: 'price_check' });
      flushActionLog().finally(() => router.push('/'));
    },
    [router]
  );

  const lookUp = useCallback(async (barcode: string) => {
    try {
      const res = await fetch(
        `/api/products/lookup?barcode=${encodeURIComponent(barcode)}`
      );
      const data = await res.json();

      if (!data.found) {
        logAction('price_check', { barcode, outcome: 'unknown' });
        setResult({ kind: 'unknown', barcode });
        return;
      }

      logAction('price_check', {
        barcode,
        outcome: 'found',
        productId: data.product.id ?? null,
        name: data.product.name,
        price: data.product.price,
      });
      setResult({ kind: 'found', name: data.product.name, price: data.product.price });
    } catch {
      logAction('price_check', { barcode, outcome: 'lookup_failed' });
      setResult({ kind: 'error' });
    }
  }, []);

  const scanner = useBarcodeScanner(lookUp, {
    onDropped: (barcode) =>
      logAction('scan_dropped', { barcode, length: barcode.length, mode: 'price_check' }),
  });

  // Send the kiosk home once it has been left alone, so the next person finds
  // the login screen rather than a stranger's last lookup.
  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => goHome('idle'), IDLE_RETURN_MS);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [result, goHome]);

  // Keep the scanner input focused; it is the only way to use this screen.
  useEffect(() => {
    const refocus = () => scanner.scanInputRef.current?.focus();
    document.addEventListener('click', refocus);
    return () => document.removeEventListener('click', refocus);
  }, [scanner.scanInputRef]);

  return (
    <Flex minH="100dvh" direction="column" px={8} py={6} align="center" gap={4}>
      <Heading size={{ base: '2xl', md: '4xl' }} fontWeight="800" letterSpacing="-0.02em">
        Vérifier un prix
      </Heading>

      <Input
        ref={scanner.scanInputRef}
        value={scanner.scanValue}
        onBlur={() => scanner.scanInputRef.current?.focus()}
        onChange={scanner.handleScanChange}
        onKeyDown={scanner.handleScanKeyDown}
        position="absolute"
        opacity={0}
        h={0}
        w={0}
        overflow="hidden"
        inputMode="none"
        autoFocus
      />

      <Flex flex={1} direction="column" justify="center" align="center" gap={6} w="full">
        <Box
          w="full"
          maxW="640px"
          py={10}
          px={6}
          borderRadius="2xl"
          bg="bg.subtle"
          textAlign="center"
        >
          {result.kind === 'idle' && (
            <Text fontSize={{ base: 'xl', md: '2xl' }} color="fg.muted" fontWeight="500">
              Scannez un article pour voir son prix
            </Text>
          )}

          {result.kind === 'found' && (
            <>
              <Text
                fontSize={{ base: 'xl', md: '2xl' }}
                fontWeight="600"
                color="fg.muted"
                mb={3}
              >
                {result.name}
              </Text>
              <Text fontSize={{ base: '7xl', md: '9xl' }} fontWeight="800" lineHeight="1">
                {result.price.toFixed(2)}$
              </Text>
            </>
          )}

          {result.kind === 'unknown' && (
            <>
              <Text fontSize={{ base: '2xl', md: '4xl' }} fontWeight="800" mb={2}>
                Article inconnu
              </Text>
              <Text fontSize={{ base: 'md', md: 'lg' }} color="fg.muted">
                Ce code-barres n&apos;est pas dans le système. Demandez à un responsable.
              </Text>
            </>
          )}

          {result.kind === 'error' && (
            <Text fontSize={{ base: '2xl', md: '4xl' }} fontWeight="800" color="red.500">
              Erreur de connexion
            </Text>
          )}
        </Box>

        <Text fontSize={{ base: 'sm', md: 'md' }} color="fg.muted">
          Rien n&apos;est facturé sur cet écran.
        </Text>
      </Flex>

      <Button
        variant="outline"
        size="lg"
        w="full"
        maxW="640px"
        py={6}
        h="auto"
        fontWeight="600"
        fontSize={{ base: 'lg', md: 'xl' }}
        onClick={() => goHome('user_exit')}
      >
        Retour
      </Button>
    </Flex>
  );
}
