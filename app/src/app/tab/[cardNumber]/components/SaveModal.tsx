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
import type { ScannedProduct } from '../types';

interface SaveModalProps {
  open: boolean;
  countdown: number;
  pendingTotal: number;
  projectedTab: number;
  scannedProducts: ScannedProduct[];
  onCancel: () => void;
  onSave: () => void;
}

export function SaveModal({
  open,
  countdown,
  pendingTotal,
  projectedTab,
  scannedProducts,
  onCancel,
  onSave,
}: SaveModalProps) {
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
              Confirmation
            </DialogTitle>
          </DialogHeader>
          <DialogBody py={6}>
            <VStack gap={5} w="full">
              {/* What is about to be charged, in full: the totals below say
                  how much, not what for. */}
              {scannedProducts.length > 0 && (
                <ScannedItemList items={scannedProducts} maxH="40vh" />
              )}

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
                onClick={onCancel}
              >
                Annuler
              </Button>
              <Button
                flex={1}
                colorPalette="gray"
                size="lg"
                fontSize="lg"
                onClick={onSave}
              >
                Sauvegarder
              </Button>
            </HStack>
          </DialogFooter>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
}
