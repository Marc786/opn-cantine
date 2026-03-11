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

export default function AdminPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    const res = await fetch('/api/employees/all');
    const data = await res.json();
    data.sort((a: Employee, b: Employee) => b.tab - a.tab);
    setEmployees(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    await fetch('/api/employees/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeNumber: deleteTarget.employeeNumber }),
    });

    setDeleteTarget(null);
    fetchEmployees();
  };

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
