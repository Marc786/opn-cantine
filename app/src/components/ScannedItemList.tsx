'use client';

import { Flex, HStack, Text, VStack } from '@chakra-ui/react';
import type { ScannedProduct } from '@/app/tab/[cardNumber]/types';

interface ScannedItemListProps {
  items: ScannedProduct[];
  /** Omit to render a read-only recap: no tap target, no edit affordance. */
  onEdit?: (item: ScannedProduct) => void;
  maxH?: string;
}

/**
 * The list of what has been scanned so far.
 *
 * Shared between the kiosk screens and their confirmation dialogs so the recap
 * someone approves is the same list they were just looking at. Both screens
 * carried their own copy of this markup before, which is how they drifted.
 *
 * The text is deliberately large: it is read at arm's length, standing, on a
 * shared iPad, and the dialog is the last chance to notice a wrong item before
 * the sale is committed.
 */
export function ScannedItemList({ items, onEdit, maxH }: ScannedItemListProps) {
  const editable = Boolean(onEdit);

  return (
    <VStack
      w="full"
      maxH={maxH}
      overflowY={maxH ? 'auto' : undefined}
      gap={1.5}
      align="stretch"
      css={{
        '&::-webkit-scrollbar': { width: '4px' },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': {
          background: 'var(--chakra-colors-border)',
          borderRadius: '4px',
        },
      }}
    >
      {editable && items.length > 0 && (
        <Text fontSize="sm" color="fg.muted" textAlign="center" pb={0.5}>
          Touchez un article pour le modifier
        </Text>
      )}
      {items.map((item) => (
        <Flex
          key={item.lineId}
          w="full"
          py={3}
          px={4}
          align="center"
          justify="space-between"
          gap={3}
          borderRadius="lg"
          borderWidth="1px"
          borderColor="border"
          bg="bg.subtle"
          cursor={editable ? 'pointer' : 'default'}
          transition="all 0.15s"
          _hover={editable ? { bg: 'bg.muted' } : undefined}
          _active={editable ? { bg: 'bg.muted', transform: 'scale(0.98)' } : undefined}
          onClick={editable ? () => onEdit?.(item) : undefined}
        >
          <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="700" lineClamp={1}>
            {item.name} {item.qty > 1 ? `x${item.qty}` : ''}
          </Text>
          <HStack gap={2} flexShrink={0}>
            <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="700">
              {(item.price * item.qty).toFixed(2)}$
            </Text>
            {editable && (
              <Flex
                align="center"
                gap={1}
                px={2.5}
                py={1}
                borderRadius="full"
                bg="bg.muted"
                color="fg.muted"
                fontSize="sm"
                fontWeight="600"
                flexShrink={0}
              >
                ✎ Modifier
              </Flex>
            )}
          </HStack>
        </Flex>
      ))}
    </VStack>
  );
}
