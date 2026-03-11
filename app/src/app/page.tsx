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
import { useState } from 'react';

export default function Home() {
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!employeeNumber.trim()) {
      setError('Veuillez entrer un numéro.');
      return;
    }

    if (employeeNumber.trim().length < 4) {
      setError('Le numéro doit contenir au moins 4 caractères.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `/api/employees/lookup?employeeNumber=${encodeURIComponent(employeeNumber.trim())}`
      );
      const data = await res.json();

      if (data.found) {
        router.push(`/tab/${encodeURIComponent(employeeNumber.trim())}`);
      } else {
        router.push(
          `/register?employeeNumber=${encodeURIComponent(employeeNumber.trim())}`
        );
      }
    } catch {
      setError('Erreur de connexion. Réessayez.');
      setLoading(false);
    }
  };

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
          Entrez votre numéro d&apos;employé
        </Text>
      </VStack>

      <VStack gap={8} w="full" maxW="600px">
        <Input
          placeholder="Ex: 12345"
          value={employeeNumber}
          minLength={4}
          onChange={e => {
            setEmployeeNumber(e.target.value);
            setError('');
          }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          textAlign="center"
          fontSize={{ base: '3xl', md: '5xl' }}
          fontWeight="600"
          letterSpacing="0.1em"
          py={10}
          h="auto"
          autoFocus
        />

        {error && (
          <Text color="red.500" fontSize="lg">
            {error}
          </Text>
        )}

        <Button
          w="full"
          h="auto"
          py={6}
          colorPalette="gray"
          onClick={handleSubmit}
          loading={loading}
          fontWeight="600"
          fontSize={{ base: 'xl', md: '2xl' }}
        >
          Continuer
        </Button>
      </VStack>

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
