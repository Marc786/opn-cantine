'use client';

import { useEffect, useState, useRef, useCallback, use } from 'react';
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
  IconButton,
  DialogRoot,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogBackdrop,
  DialogTitle,
  ProgressRoot,
  ProgressTrack,
  ProgressRange,
} from '@chakra-ui/react';

interface Employee {
  employeeNumber: string;
  fullName: string;
  tab: number;
}

export default function TabPage({
  params,
}: {
  params: Promise<{ employeeNumber: string }>;
}) {
  const { employeeNumber } = use(params);
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingTotal, setPendingTotal] = useState(0);

  // Modal state
  const [resetOpen, setResetOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEmployee = async () => {
    const res = await fetch(
      `/api/employees/lookup?employeeNumber=${encodeURIComponent(employeeNumber)}`
    );
    const data = await res.json();
    if (data.found) {
      setEmployee(data.employee);
    } else {
      router.push('/');
    }
  };

  useEffect(() => {
    fetchEmployee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeNumber]);

  const lastAddRef = useRef(0);
  const addPending = (value: number) => {
    if (!value) return;
    const now = Date.now();
    if (now - lastAddRef.current < 300) return;
    lastAddRef.current = now;
    setPendingTotal((prev) => prev + value);
    setAmount('');
  };

  const doSave = useCallback(async () => {
    if (!employee || pendingTotal === 0) return;

    setLoading(true);
    const res = await fetch('/api/employees/tab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeNumber, amount: pendingTotal }),
    });

    if (res.ok) {
      router.push('/');
    }
    setLoading(false);
  }, [employee, employeeNumber, pendingTotal, router]);

  const startSaveCountdown = () => {
    setCountdown(5);
    setSaveOpen(true);
  };

  const cancelSave = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSaveOpen(false);
    setCountdown(5);
  };

  // Countdown effect
  useEffect(() => {
    if (!saveOpen) return;

    timerRef.current = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [saveOpen]);

  // When countdown reaches 0, save
  useEffect(() => {
    if (countdown <= 0 && saveOpen) {
      cancelSave();
      doSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, saveOpen]);

  const handleSave = () => {
    if (!employee) return;

    if (pendingTotal === 0) {
      router.push('/');
      return;
    }

    startSaveCountdown();
  };

  const handleConfirmReset = async () => {
    setResetOpen(false);
    setLoading(true);
    const res = await fetch('/api/employees/tab', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeNumber }),
    });

    if (res.ok) {
      const data = await res.json();
      setEmployee(data);
      setPendingTotal(0);
    }
    setLoading(false);
  };

  const getBalanceColor = (value: number) => {
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
  };

  // Custom amount modal state
  const [customOpen, setCustomOpen] = useState(false);

  const parsedAmount = parseFloat(amount);
  const hasValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;
  const hasPending = pendingTotal !== 0;
  const projectedTab = employee ? employee.tab + pendingTotal : 0;
  const balanceColor = getBalanceColor(projectedTab);
  const pendingColor = getBalanceColor(pendingTotal > 0 ? projectedTab : 0);

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
              {employee.fullName}
            </Heading>
          </VStack>
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
              {pendingTotal > 0 ? '+' : ''}
              {pendingTotal.toFixed(2)}$ depuis {employee.tab.toFixed(2)}$
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
          <HStack gap={3} w="full">
            <Button
              flex={1}
              h="auto"
              py={6}
              colorPalette="gray" variant="outline"
              onClick={() => addPending(0.5)}
              disabled={loading}
              fontWeight="600"
              fontSize={{ base: 'lg', md: 'xl' }}
            >
              +0.50$
            </Button>
            <Button
              flex={1}
              h="auto"
              py={6}
              colorPalette="gray" variant="outline"
              onClick={() => addPending(1)}
              disabled={loading}
              fontWeight="600"
              fontSize={{ base: 'lg', md: 'xl' }}
            >
              +1.00$
            </Button>
            <Button
              flex={1}
              h="auto"
              py={6}
              colorPalette="gray" variant="outline"
              onClick={() => addPending(2)}
              disabled={loading}
              fontWeight="600"
              fontSize={{ base: 'lg', md: 'xl' }}
            >
              +2.00$
            </Button>
          </HStack>

          {/* Custom amount button */}
          <Button
            w="full"
            h="auto"
            py={6}
            variant="outline"
            colorPalette="gray"
            onClick={() => { setAmount(''); setCustomOpen(true); }}
            disabled={loading}
            fontWeight="600"
            fontSize={{ base: 'lg', md: 'xl' }}
          >
            Autre montant
          </Button>

          <Separator />

          {/* Save + Reset */}
          <Flex direction={{ base: 'column', md: 'row' }} gap={4} w="full">
            <Button
              flex={{ md: 3 }}
              h="auto"
              py={6}
              colorPalette="gray"
              onClick={handleSave}
              loading={loading}
              fontWeight="600"
              fontSize={{ base: 'xl', md: '2xl' }}
            >
              {hasPending ? 'Sauvegarder' : 'Retour'}
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
              Remettre à zéro
            </Button>
          </Flex>
        </Flex>
      </Flex>

      {/* Reset confirmation modal */}
      <DialogRoot
        open={resetOpen}
        onOpenChange={(e) => setResetOpen(e.open)}
        placement="center"
        size="lg"
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent p={8}>
            <DialogHeader pb={4}>
              <DialogTitle fontSize="2xl" fontWeight="700">
                Remettre à zéro
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text fontSize="lg">
                Le solde de {employee?.fullName} sera remis à 0.00$. Cette
                action est irréversible.
              </Text>
            </DialogBody>
            <DialogFooter pt={6}>
              <HStack gap={3} w="full">
                <Button
                  flex={1}
                  variant="outline"
                  size="lg"
                  fontSize="lg"
                  onClick={() => setResetOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  flex={1}
                  colorPalette="red"
                  size="lg"
                  fontSize="lg"
                  onClick={handleConfirmReset}
                >
                  Confirmer
                </Button>
              </HStack>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>

      {/* Custom amount modal */}
      <DialogRoot
        open={customOpen}
        onOpenChange={(e) => setCustomOpen(e.open)}
        placement="center"
        size="lg"
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent p={8}>
            <DialogHeader pb={4}>
              <DialogTitle fontSize="2xl" fontWeight="700">
                Autre montant
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Input
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                fontSize={{ base: '2xl', md: '3xl' }}
                fontWeight="600"
                textAlign="center"
                py={8}
                h="auto"
                autoFocus
              />
            </DialogBody>
            <DialogFooter pt={6}>
              <HStack gap={3} w="full">
                <Button
                  flex={1}
                  colorPalette="red"
                  size="lg"
                  fontSize="lg"
                  onClick={() => {
                    if (hasValidAmount) addPending(-parsedAmount);
                    setCustomOpen(false);
                  }}
                  disabled={!hasValidAmount}
                >
                  Soustraire
                </Button>
                <Button
                  flex={1}
                  colorPalette="green"
                  size="lg"
                  fontSize="lg"
                  onClick={() => {
                    if (hasValidAmount) addPending(parsedAmount);
                    setCustomOpen(false);
                  }}
                  disabled={!hasValidAmount}
                >
                  Ajouter
                </Button>
              </HStack>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>

      {/* Save confirmation modal with countdown */}
      <DialogRoot
        open={saveOpen}
        onOpenChange={(e) => {
          if (!e.open) cancelSave();
        }}
        placement="center"
        size="lg"
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent p={8}>
            <DialogHeader pb={2}>
              <DialogTitle fontSize="2xl" fontWeight="700">
                Confirmation
              </DialogTitle>
            </DialogHeader>
            <DialogBody py={6}>
              <VStack gap={5} w="full">
                <VStack gap={1} w="full">
                  <HStack w="full" justify="space-between">
                    <Text fontSize="lg" color="fg.muted">
                      Modification
                    </Text>
                    <Text fontSize="lg" fontWeight="700">
                      {pendingTotal > 0 ? '+' : ''}
                      {pendingTotal.toFixed(2)}$
                    </Text>
                  </HStack>
                  <HStack w="full" justify="space-between">
                    <Text fontSize="lg" color="fg.muted">
                      Nouveau solde
                    </Text>
                    <Text fontSize="lg" fontWeight="700">
                      {projectedTab.toFixed(2)}$
                    </Text>
                  </HStack>
                </VStack>

                <VStack gap={2} w="full">
                  <ProgressRoot
                    value={(countdown / 5) * 100}
                    w="full"
                    size="lg"
                    colorPalette="gray"
                  >
                    <ProgressTrack>
                      <ProgressRange />
                    </ProgressTrack>
                  </ProgressRoot>
                  <Text fontSize="sm" color="fg.muted">
                    Sauvegarde automatique dans {countdown}s
                  </Text>
                </VStack>
              </VStack>
            </DialogBody>
            <DialogFooter pt={6}>
              <HStack gap={3} w="full">
                <Button
                  flex={1}
                  variant="outline"
                  size="lg"
                  fontSize="lg"
                  onClick={cancelSave}
                >
                  Annuler
                </Button>
                <Button
                  flex={1}
                  colorPalette="gray"
                  size="lg"
                  fontSize="lg"
                  onClick={() => {
                    cancelSave();
                    doSave();
                  }}
                >
                  Sauvegarder
                </Button>
              </HStack>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>
    </>
  );
}
