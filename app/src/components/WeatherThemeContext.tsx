'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { WeatherTheme } from '@/lib/domain/entities/config.entity';

const LS_KEY = 'cantine-weather-theme';

interface WeatherThemeContextValue {
  theme: WeatherTheme;
}

const WeatherThemeContext = createContext<WeatherThemeContextValue>({ theme: 'default' });

export function useWeatherTheme() {
  return useContext(WeatherThemeContext);
}

export function WeatherThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<WeatherTheme>(() => {
    // Instant read from localStorage — no flash on navigation
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(LS_KEY) as WeatherTheme | null;
      if (cached === 'sunny' || cached === 'rainy' || cached === 'default') return cached;
    }
    return 'default';
  });

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.ok ? res.json() : null)
      .then((data: { theme?: WeatherTheme } | null) => {
        if (data?.theme) {
          setTheme(data.theme);
          localStorage.setItem(LS_KEY, data.theme);
        }
      })
      .catch(() => null);
  }, []);

  return (
    <WeatherThemeContext.Provider value={{ theme }}>
      {children}
    </WeatherThemeContext.Provider>
  );
}
