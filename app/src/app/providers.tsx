'use client';

import { useEffect } from 'react';
import { ChakraProvider, createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
import { usePathname } from 'next/navigation';
import { WeatherThemeProvider, useWeatherTheme } from '@/components/WeatherThemeContext';
import { WeatherBackground } from '@/components/WeatherBackground';

const system = createSystem(defaultConfig, defineConfig({
  conditions: {
    dark: '[data-theme=dark] &',
  },
}));

function AppShell({ children }: { children: React.ReactNode }) {
  const { theme } = useWeatherTheme();
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');
  return (
    <>
      {!isAdmin && <WeatherBackground theme={theme} />}
      {children}
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  return (
    <ChakraProvider value={system}>
      <WeatherThemeProvider>
        <AppShell>{children}</AppShell>
      </WeatherThemeProvider>
    </ChakraProvider>
  );
}
