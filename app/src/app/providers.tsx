'use client';

import { ChakraProvider, defaultSystem, Theme } from '@chakra-ui/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={defaultSystem}>
      <Theme>{children}</Theme>
    </ChakraProvider>
  );
}
