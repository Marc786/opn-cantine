'use client';

import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const RAPID_INPUT_THRESHOLD_MS = 80;
const AUTO_SUBMIT_DELAY_MS = 300;
const MIN_LENGTH = 4;

export default function Home() {
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const lastKeystrokeRef = useRef(0);
  const rapidCountRef = useRef(0);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the hidden input focused at all times
  useEffect(() => {
    const refocus = () => inputRef.current?.focus();
    document.addEventListener('click', refocus);
    document.addEventListener('touchstart', refocus);
    return () => {
      document.removeEventListener('click', refocus);
      document.removeEventListener('touchstart', refocus);
    };
  }, []);

  const handleSubmit = useCallback(async (number?: string) => {
    const value = (number ?? employeeNumber).trim();
    if (submittingRef.current) return;

    if (!value) {
      setError('Veuillez entrer un numéro.');
      return;
    }

    if (value.length < MIN_LENGTH) {
      setError('Le numéro doit contenir au moins 4 caractères.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `/api/employees/lookup?employeeNumber=${encodeURIComponent(value)}`
      );

      if (!res.ok) {
        setError('Erreur du serveur. Réessayez.');
        return;
      }

      const data = await res.json();

      if (data.found) {
        router.push(`/tab/${encodeURIComponent(value)}`);
      } else {
        router.push(
          `/register?employeeNumber=${encodeURIComponent(value)}`
        );
      }
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [employeeNumber, router]);

  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, []);

  return (
    <Flex
      minH="100dvh"
      align="center"
      justify="center"
      position="relative"
      px={8}
      py={10}
      direction="column"
      gap={10}
    >
      <Box position="absolute" top={4} left={4}>
        <Image src="/bell.png" alt="Bell" width={64} height={64} priority />
      </Box>

      <VStack gap={2}>
        <Heading
          size={{ base: '4xl', md: '6xl' }}
          fontWeight="800"
          letterSpacing="-0.02em"
        >
          Cantine
        </Heading>
        <Text color="fg.muted" fontSize={{ base: 'lg', md: 'xl' }}>
          Scannez votre carte
        </Text>
      </VStack>

      {/* Hidden input to capture card reader scan */}
      <Input
        ref={inputRef}
        value={employeeNumber}
        onBlur={() => inputRef.current?.focus()}
        onChange={e => {
          const val = e.target.value.replace(/\D/g, '');
          setEmployeeNumber(val);
          setError('');

          const now = Date.now();
          if (now - lastKeystrokeRef.current < RAPID_INPUT_THRESHOLD_MS) {
            rapidCountRef.current++;
          } else {
            rapidCountRef.current = 1;
          }
          lastKeystrokeRef.current = now;

          if (autoSubmitTimerRef.current) {
            clearTimeout(autoSubmitTimerRef.current);
          }

          if (rapidCountRef.current >= 3 && val.length >= MIN_LENGTH) {
            autoSubmitTimerRef.current = setTimeout(() => {
              handleSubmit(val);
            }, AUTO_SUBMIT_DELAY_MS);
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
            handleSubmit();
          }
        }}
        position="absolute"
        opacity={0}
        h={0}
        w={0}
        overflow="hidden"
        inputMode="none"
        autoFocus
      />

      {error && (
        <Text color="red.500" fontSize="lg">
          {error}
        </Text>
      )}

      {loading && (
        <Text color="fg.muted" fontSize="lg">
          Chargement...
        </Text>
      )}

      <Button
        variant="ghost"
        size="sm"
        color="fg.muted"
        fontSize="md"
        position="absolute"
        bottom={6}
        right={6}
        onClick={() => router.push('/admin')}
      >
        Administration
      </Button>
    </Flex>
  );
}
