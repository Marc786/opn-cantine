'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Flex,
  HStack,
  Text,
  VStack,
  DialogRoot,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogBackdrop,
  DialogTitle,
  DialogCloseTrigger,
} from '@chakra-ui/react';

interface TransactionItem {
  barcode: string;
  name: string;
  price: number;
  quantity: number;
}

interface Transaction {
  id?: string;
  cardNumber: string;
  items: TransactionItem[];
  totalAmount: number;
  timestamp: string;
}

interface HistoryModalProps {
  open: boolean;
  cardNumber: string;
  onClose: () => void;
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('fr-CA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryModal({ open, cardNumber, onClose }: HistoryModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/employees/${encodeURIComponent(cardNumber)}/transactions`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Transaction[]) => setTransactions(data))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [open, cardNumber]);

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => { if (!e.open) onClose(); }}
      placement="center"
      size="xl"
    >
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent maxH="85dvh" display="flex" flexDirection="column">
          <DialogHeader pb={2} flexShrink={0}>
            <DialogTitle fontSize="2xl" fontWeight="700">
              Historique des achats
            </DialogTitle>
            <DialogCloseTrigger />
          </DialogHeader>

          <DialogBody
            py={4}
            overflowY="auto"
            flex={1}
            css={{
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                background: 'var(--chakra-colors-border)',
                borderRadius: '4px',
              },
            }}
          >
            {loading ? (
              <Flex justify="center" py={12}>
                <Text fontSize="lg" color="fg.muted">
                  Chargement...
                </Text>
              </Flex>
            ) : transactions.length === 0 ? (
              <Flex justify="center" py={12}>
                <Text fontSize="lg" color="fg.muted">
                  Aucune transaction enregistrée.
                </Text>
              </Flex>
            ) : (
              <VStack gap={3} align="stretch">
                {transactions.map((tx, i) => (
                  <Box
                    key={tx.id ?? i}
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="xl"
                    px={5}
                    py={4}
                    bg="bg.subtle"
                  >
                    <HStack justify="space-between" mb={2} align="flex-start">
                      <Text fontSize={{ base: 'sm', md: 'md' }} color="fg.muted" flexShrink={0}>
                        {formatDate(tx.timestamp)}
                      </Text>
                      <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="800">
                        +{tx.totalAmount.toFixed(2)}$
                      </Text>
                    </HStack>

                    <VStack gap={1} align="stretch">
                      {tx.items.map((item, j) => (
                        <HStack key={j} justify="space-between">
                          <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="600">
                            {item.name}
                            {item.quantity > 1 && (
                              <Text as="span" color="fg.muted" fontWeight="400">
                                {' '}×{item.quantity}
                              </Text>
                            )}
                          </Text>
                          <Text fontSize={{ base: 'sm', md: 'md' }} color="fg.muted">
                            {(item.price * item.quantity).toFixed(2)}$
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                ))}
              </VStack>
            )}
          </DialogBody>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
}
