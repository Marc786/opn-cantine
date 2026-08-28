import { Box, Text } from '@chakra-ui/react';

interface StatCardProps {
  label: string;
  value: string;
  /** Optional context shown under the value, e.g. what period it covers. */
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Box
      borderRadius="xl"
      border="1px solid"
      borderColor="border"
      p={6}
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      gap={2}
    >
      <Text fontWeight="700" fontSize="lg" color="fg.muted" textAlign="center">
        {label}
      </Text>
      <Text fontWeight="800" fontSize={{ base: '4xl', md: '5xl' }}>
        {value}
      </Text>
      {hint ? (
        <Text fontSize="sm" color="fg.muted" textAlign="center">
          {hint}
        </Text>
      ) : null}
    </Box>
  );
}
