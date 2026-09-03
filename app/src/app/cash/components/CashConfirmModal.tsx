'use client';

import {
  Button,
  HStack,
  VStack,
  Text,
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
import { ScannedItemList } from '@/components/ScannedItemList';
import type { ScannedProduct } from '@/app/tab/[cardNumber]/types';
import { COUNTDOWN_SECONDS } from '../hooks/useCashSaveFlow';

interface CashConfirmModalProps {
  open: boolean;
  countdown: number;
  pendingTotal: number;
  scannedProducts: ScannedProduct[];
  onCancel: () => void;
  onConfirm: () => void;
}

export function CashConfirmModal({
  open,
  countdown,
  pendingTotal,
  scannedProducts,
  onCancel,
  onConfirm,
}: CashConfirmModalProps) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => { if (!e.open) onCancel(); }}
      placement="center"
      size="lg"
    >
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent p={8}>
          <DialogHeader pb={2}>
            <DialogTitle fontSize="2xl" fontWeight="700">
              Confirmer le paiement comptant
            </DialogTitle>
          </DialogHeader>
          <DialogBody py={6}>
            <VStack gap={5} w="full">
              {/* Cash is counted by hand against this list, so it has to show
                  what was scanned, not just the amount. */}
              {scannedProducts.length > 0 && (
                <ScannedItemList items={scannedProducts} maxH="40vh" />
              )}

              <HStack w="full" justify="space-between">
                <Text fontSize="lg" color="fg.muted">
                  Total à payer
                </Text>
                <Text fontSize="lg" fontWeight="700">
                  {pendingTotal.toFixed(2)}$
                </Text>
              </HStack>

              <Text fontSize="md" color="fg.muted" textAlign="center">
                Confirmez que le montant a bien été déposé dans la boite.
              </Text>

              <VStack gap={2} w="full">
                <ProgressRoot
                  value={(countdown / COUNTDOWN_SECONDS) * 100}
                  w="full"
                  size="lg"
                  colorPalette="gray"
                >
                  <ProgressTrack>
                    <ProgressRange />
                  </ProgressTrack>
                </ProgressRoot>
                <Text fontSize="sm" color="fg.muted">
                  Confirmation automatique dans {countdown}s
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
                onClick={onCancel}
              >
                Annuler
              </Button>
              <Button
                flex={1}
                colorPalette="gray"
                size="lg"
                fontSize="lg"
                onClick={onConfirm}
              >
                Confirmer le paiement
              </Button>
            </HStack>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
}
