'use client';

import { useEffect } from 'react';
import { ChakraProvider, defaultSystem, Theme } from '@chakra-ui/react';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  return (
    <ChakraProvider value={defaultSystem}>
      <Theme appearance="light">{children}</Theme>
    </ChakraProvider>
  );
}
