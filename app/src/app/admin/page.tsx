'use client';

import { useEffect, useState } from 'react';
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
  cardNumber: string;
  employeeNumber: string;
  tab: number;
}


export default function AdminPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editError, setEditError] = useState('');

  const fetchEmployees = async () => {
    setLoading(true);
    const res = await fetch('/api/employees/all');
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    if (!Array.isArray(data)) { setLoading(false); return; }
    data.sort((a: Employee, b: Employee) => {
      if (b.tab !== a.tab) return b.tab - a.tab;
      return a.employeeNumber.localeCompare(b.employeeNumber);
    });
    setEmployees(data);
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleEditNumber = async () => {
    if (!editTarget || !editNumber.trim() || editNumber.trim() === editTarget.employeeNumber) return;
    setEditError('');
    const res = await fetch(`/api/employees/${editTarget.cardNumber}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeNumber: editNumber.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setEditError(data.error || 'Erreur');
      return;
    }
    setEditTarget(null);
    fetchEmployees();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch('/api/employees/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardNumber: deleteTarget.cardNumber }),
    });
    setDeleteTarget(null);
    fetchEmployees();
  };

  return (
    <>
      <Flex direction="column" px={8} py={6} pb={8}>
        {/* Total */}
        {!loading && employees.length > 0 && (
          <Flex
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
            <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="800">
              {employees.reduce((sum, e) => sum + e.tab, 0).toFixed(2)}$
            </Text>
          </Flex>
        )}

        {/* Table */}
        <VStack gap={0} w="full" mt={8}>
          {!loading && (
            <Text w="full" fontSize="sm" color="fg.muted" mb={2}>
              {employees.length} employé{employees.length !== 1 ? 's' : ''} enregistré{employees.length !== 1 ? 's' : ''}
            </Text>
          )}
          {/* Header row */}
          <Flex w="full" py={4} px={6} borderBottom="2px solid" borderColor="border">
            <Text flex={1} fontWeight="700" fontSize={{ base: 'sm', md: 'md' }} color="fg.muted">#</Text>
            <Text flex={3} fontWeight="700" fontSize={{ base: 'sm', md: 'md' }} color="fg.muted">Employé</Text>
            <Text flex={2} fontWeight="700" fontSize={{ base: 'sm', md: 'md' }} color="fg.muted" textAlign="right">Solde</Text>
            <Box flex={1} />
          </Flex>

          {loading && (
            <Flex py={12} justify="center" w="full">
              <Text color="fg.muted" fontSize="lg">Chargement...</Text>
            </Flex>
          )}

          {!loading && employees.length === 0 && (
            <Flex py={12} justify="center" w="full">
              <Text color="fg.muted" fontSize="lg">Aucun employé</Text>
            </Flex>
          )}

          {employees.map((emp) => (
            <Flex
              key={emp.cardNumber}
              w="full"
              py={5}
              px={6}
              borderBottom="1px solid"
              borderColor="border.muted"
              align="center"
              _hover={{ bg: 'bg.subtle' }}
            >
              <Text flex={1} fontSize={{ base: 'md', md: 'lg' }} color="fg.muted">
                {emp.cardNumber}
              </Text>
              <Text flex={3} fontSize={{ base: 'md', md: 'lg' }} fontWeight="600">
                {emp.employeeNumber}
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
              <Flex flex={1} justify="end" gap={1}>
                <IconButton
                  aria-label="Modifier le numéro"
                  variant="ghost"
                  size="sm"
                  fontSize="md"
                  onClick={() => { setEditTarget(emp); setEditNumber(emp.employeeNumber); setEditError(''); }}
                >
                  ✎
                </IconButton>
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

      {/* Edit employee number modal */}
      <DialogRoot
        open={!!editTarget}
        onOpenChange={(e) => { if (!e.open) { setEditTarget(null); setEditError(''); } }}
        placement="center"
        size="lg"
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent p={8}>
            <DialogHeader pb={4}>
              <DialogTitle fontSize="2xl" fontWeight="700">
                Modifier le numéro d&apos;employé
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <VStack gap={4} align="stretch">
                <Text fontSize="lg" color="fg.muted">Carte #{editTarget?.cardNumber}</Text>
                <Input
                  inputMode="numeric"
                  placeholder="Numéro d'employé"
                  value={editNumber}
                  onChange={(e) => { setEditNumber(e.target.value); setEditError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleEditNumber()}
                  fontSize={{ base: 'xl', md: '2xl' }}
                  fontWeight="600"
                  textAlign="center"
                  py={6}
                  h="auto"
                  autoFocus
                />
                {editError && <Text color="red.500" fontSize="md">{editError}</Text>}
              </VStack>
            </DialogBody>
            <DialogFooter pt={6}>
              <HStack gap={3} w="full">
                <Button flex={1} variant="outline" size="lg" fontSize="lg" onClick={() => { setEditTarget(null); setEditError(''); }}>
                  Annuler
                </Button>
                <Button
                  flex={1}
                  colorPalette="gray"
                  size="lg"
                  fontSize="lg"
                  onClick={handleEditNumber}
                  disabled={!editNumber.trim() || editNumber.trim() === editTarget?.employeeNumber}
                >
                  Sauvegarder
                </Button>
              </HStack>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>

      {/* Delete confirmation modal */}
      <DialogRoot
        open={!!deleteTarget}
        onOpenChange={(e) => { if (!e.open) setDeleteTarget(null); }}
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
                <Text as="span" fontWeight="700">{deleteTarget?.employeeNumber}</Text>{' '}
                (#{deleteTarget?.cardNumber}) sera supprimé définitivement.
                Cette action est irréversible.
              </Text>
            </DialogBody>
            <DialogFooter pt={6}>
              <HStack gap={3} w="full">
                <Button flex={1} variant="outline" size="lg" fontSize="lg" onClick={() => setDeleteTarget(null)}>
                  Annuler
                </Button>
                <Button flex={1} colorPalette="red" size="lg" fontSize="lg" onClick={handleDelete}>
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
