'use client';

import { Button, Flex, Heading, Input, Text, VStack } from '@chakra-ui/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function RegisterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [employeeNumber, setEmployeeNumber] = useState(
    searchParams.get('employeeNumber') || ''
  );
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!employeeNumber.trim()) {
      setError("Le numéro de carte est requis.");
      return;
    }

    if (employeeNumber.trim().length < 4) {
      setError("Le numéro de carte doit contenir au moins 4 caractères.");
      return;
    }

    if (!fullName.trim()) {
      setError('Le nom complet est requis.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeNumber: employeeNumber.trim(),
          fullName: fullName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      router.push(`/tab/${encodeURIComponent(employeeNumber.trim())}`);
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
      px={8}
      py={10}
      direction="column"
      gap={10}
    >
      <VStack gap={2}>
        <Heading
          size={{ base: '3xl', md: '5xl' }}
          fontWeight="800"
          letterSpacing="-0.02em"
        >
          Nouveau compte
        </Heading>
        <Text color="fg.muted" fontSize={{ base: 'lg', md: 'xl' }}>
          Créez votre ardoise cantine
        </Text>
      </VStack>

      <VStack gap={8} w="full" maxW="600px">
        <VStack gap={2} w="full" align="start">
          <Text
            fontSize={{ base: 'md', md: 'lg' }}
            fontWeight="500"
            color="fg.muted"
          >
            Numéro de carte
          </Text>
          <Input
            placeholder="Ex: 12345"
            value={employeeNumber}
            minLength={4}
            onChange={e => {
              setEmployeeNumber(e.target.value);
              setError('');
            }}
            fontSize={{ base: 'xl', md: '2xl' }}
            fontWeight="500"
            py={8}
            h="auto"
          />
        </VStack>

        <VStack gap={2} w="full" align="start">
          <Text
            fontSize={{ base: 'md', md: 'lg' }}
            fontWeight="500"
            color="fg.muted"
          >
            Nom complet
          </Text>
          <Input
            placeholder="Ex: Jean Tremblay"
            value={fullName}
            onChange={e => {
              setFullName(e.target.value);
              setError('');
            }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            fontSize={{ base: 'xl', md: '2xl' }}
            fontWeight="500"
            py={8}
            h="auto"
            autoFocus
          />
        </VStack>

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
          Créer mon compte
        </Button>

        <Button
          w="full"
          variant="ghost"
          size="lg"
          color="fg.muted"
          fontSize="lg"
          onClick={() => router.push('/')}
        >
          Retour
        </Button>
      </VStack>
    </Flex>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
