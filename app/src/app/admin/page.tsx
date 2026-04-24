'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  Text,
  VStack,
  DialogRoot,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogBackdrop,
  DialogTitle,
} from '@chakra-ui/react';

interface Employee {
  employeeNumber: string;
  fullName: string;
  tab: number;
}

interface AdminTransaction {
  id: string;
  employeeNumber: string;
  timestamp: string | Date;
  totalAmount: number;
  items: { name: string; quantity: number }[];
}

export default function AdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  useEffect(() => {
    setMounted(true);
    fetch('/api/admin/check').then((res) => {
      if (res.ok) setAuthenticated(true);
      setCheckingAuth(false);
    }).catch(() => {
      setCheckingAuth(false);
    });
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    const res = await fetch('/api/employees/all');
    if (!res.ok) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }
    data.sort((a: Employee, b: Employee) => {
      if (b.tab !== a.tab) return b.tab - a.tab;
      return a.fullName.localeCompare(b.fullName);
    });
    setEmployees(data);

    const transRes = await fetch('/api/transactions');
    if (transRes.ok) {
      const transData = await transRes.json();
      setTransactions(Array.isArray(transData) ? transData : []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (authenticated) fetchEmployees();
  }, [authenticated]);

  const handlePin = async () => {
    setPinError('');
    const res = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (data.valid) {
      setAuthenticated(true);
    } else {
      setPinError('NIP invalide.');
      setPin('');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const res = await fetch('/api/employees/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeNumber: deleteTarget.employeeNumber }),
    });

    setDeleteTarget(null);

    if (!res.ok) {
      setAuthenticated(false);
      return;
    }

    fetchEmployees();
  };

  if (!mounted || checkingAuth) {
    return <Flex minH="100dvh" />;
  }

  if (!authenticated) {
    return (
      <Flex minH="100dvh" align="center" justify="center" px={8} direction="column" gap={6}>
        <IconButton
          aria-label="Retour"
          variant="outline"
          size="lg"
          color="fg.muted"
          fontSize="xl"
          position="absolute"
          top={6}
          right={6}
          onClick={() => router.push('/')}
        >
          ✕
        </IconButton>

        <Heading size={{ base: '2xl', md: '4xl' }} fontWeight="800" letterSpacing="-0.02em">
          Administration
        </Heading>
        <Text color="fg.muted" fontSize={{ base: 'lg', md: 'xl' }}>
          Entrez le NIP
        </Text>

        <VStack gap={4} w="full" maxW="400px">
          <Input
            type="password"
            inputMode="numeric"
            placeholder="NIP"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setPinError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handlePin()}
            textAlign="center"
            fontSize={{ base: '3xl', md: '5xl' }}
            fontWeight="600"
            letterSpacing="0.2em"
            py={10}
            h="auto"
            autoFocus
          />
          {pinError && (
            <Text color="red.500" fontSize="lg">
              {pinError}
            </Text>
          )}
          <Button
            w="full"
            h="auto"
            py={6}
            colorPalette="gray"
            onClick={handlePin}
            fontWeight="600"
            fontSize={{ base: 'xl', md: '2xl' }}
          >
            Continuer
          </Button>
        </VStack>
      </Flex>
    );
  }

  return (
    <>
      <Flex minH="100dvh" direction="column" px={8} py={6}>
        {/* Top bar */}
        <Flex justify="space-between" align="center">
          <Heading
            size={{ base: '2xl', md: '4xl' }}
            fontWeight="800"
            letterSpacing="-0.02em"
          >
            Administration
          </Heading>
          <IconButton
            aria-label="Fermer"
            variant="outline"
            size="lg"
            color="fg.muted"
            fontSize="xl"
            onClick={() => router.push('/')}
          >
            ✕
          </IconButton>
        </Flex>

        {/* Products link */}
        <Button
          mt={8}
          w="full"
          h="auto"
          py={6}
          variant="outline"
          colorPalette="gray"
          onClick={() => router.push('/admin/products')}
          fontWeight="600"
          fontSize={{ base: 'lg', md: 'xl' }}
        >
          Gestion des produits
        </Button>

        {/* Total */}
        {!loading && employees.length > 0 && (
          <Flex
            mt={8}
            py={5}
            px={6}
            borderRadius="xl"
            bg="bg.subtle"
            justify="space-between"
            align="center"
          >
            <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="600">
              Total
            </Text>
            <Text
              fontSize={{ base: 'xl', md: '2xl' }}
              fontWeight="800"
            >
              {employees.reduce((sum, e) => sum + e.tab, 0).toFixed(2)}$
            </Text>
          </Flex>
        )}

        {/* Recent Transactions */}
        {!loading && transactions.length > 0 && (
          <Box w="full" mt={8}>
            <Heading size="lg" mb={4} fontWeight="700">Transactions récentes</Heading>
            <VStack gap={3} w="full" align="stretch">
              {transactions.slice(0, 5).map((t) => (
                <Flex key={t.id} p={4} borderRadius="md" bg="bg.subtle" justify="space-between" align="center">
                  <VStack align="start" gap={0}>
                    <Text fontWeight="600">
                      {employees.find((e) => e.employeeNumber === t.employeeNumber)?.fullName || t.employeeNumber}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {new Date(t.timestamp).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
                    </Text>
                  </VStack>
                  <VStack align="end" gap={0}>
                    <Text fontWeight="700">+{t.totalAmount.toFixed(2)}$</Text>
                    <Text fontSize="xs" color="fg.muted" textAlign="right">
                      {t.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                    </Text>
                  </VStack>
                </Flex>
              ))}
            </VStack>
          </Box>
        )}

        {/* Table */}
        <VStack gap={0} w="full" mt={8}>
          {/* Header row */}
          <Flex
            w="full"
            py={4}
            px={6}
            borderBottom="2px solid"
            borderColor="border"
          >
            <Text
              flex={1}
              fontWeight="700"
              fontSize={{ base: 'sm', md: 'md' }}
              color="fg.muted"
            >
              #
            </Text>
            <Text
              flex={3}
              fontWeight="700"
              fontSize={{ base: 'sm', md: 'md' }}
              color="fg.muted"
            >
              Employé
            </Text>
            <Text
              flex={2}
              fontWeight="700"
              fontSize={{ base: 'sm', md: 'md' }}
              color="fg.muted"
              textAlign="right"
            >
              Solde
            </Text>
            <Box flex={1} />
          </Flex>

          {loading && (
            <Flex py={12} justify="center" w="full">
              <Text color="fg.muted" fontSize="lg">
                Chargement...
              </Text>
            </Flex>
          )}

          {!loading && employees.length === 0 && (
            <Flex py={12} justify="center" w="full">
              <Text color="fg.muted" fontSize="lg">
                Aucun employé
              </Text>
            </Flex>
          )}

          {employees.map((emp) => (
            <Flex
              key={emp.employeeNumber}
              w="full"
              py={5}
              px={6}
              borderBottom="1px solid"
              borderColor="border.muted"
              align="center"
              _hover={{ bg: 'bg.subtle' }}
            >
              <Text
                flex={1}
                fontSize={{ base: 'md', md: 'lg' }}
                color="fg.muted"
              >
                {emp.employeeNumber}
              </Text>
              <Text
                flex={3}
                fontSize={{ base: 'md', md: 'lg' }}
                fontWeight="600"
              >
                {emp.fullName}
              </Text>
              <Text
                flex={2}
                fontSize={{ base: 'md', md: 'lg' }}
                fontWeight="700"
                textAlign="right"
                color={emp.tab > 0 ? 'red.500' : 'green.500'}
              >
                {emp.tab.toFixed(2)}$
              </Text>
              <Flex flex={1} justify="end">
                <IconButton
                  aria-label="Supprimer"
                  variant="ghost"
                  size="sm"
                  color="fg.muted"
                  onClick={() => setDeleteTarget(emp)}
                >
                  ✕
                </IconButton>
              </Flex>
            </Flex>
          ))}
        </VStack>
      </Flex>

      {/* Delete confirmation modal */}
      <DialogRoot
        open={!!deleteTarget}
        onOpenChange={(e) => {
          if (!e.open) setDeleteTarget(null);
        }}
        placement="center"
        size="lg"
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent p={8}>
            <DialogHeader pb={4}>
              <DialogTitle fontSize="2xl" fontWeight="700">
                Supprimer un employé
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text fontSize="lg">
                L&apos;employé{' '}
                <Text as="span" fontWeight="700">
                  {deleteTarget?.fullName}
                </Text>{' '}
                (#{deleteTarget?.employeeNumber}) sera supprimé définitivement.
                Cette action est irréversible.
              </Text>
            </DialogBody>
            <DialogFooter pt={6}>
              <HStack gap={3} w="full">
                <Button
                  flex={1}
                  variant="outline"
                  size="lg"
                  fontSize="lg"
                  onClick={() => setDeleteTarget(null)}
                >
                  Annuler
                </Button>
                <Button
                  flex={1}
                  colorPalette="red"
                  size="lg"
                  fontSize="lg"
                  onClick={handleDelete}
                >
                  Supprimer
                </Button>
              </HStack>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>
    </>
  );
}
